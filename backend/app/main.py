from fastapi import FastAPI, HTTPException
from app.ingest import load_teams_index, ingest_preview_for_one_team, ingest_league

import json
import os
from datetime import datetime
from typing import Optional

app = FastAPI(title="LSL Analytics Backend")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/teams-index/preview")
def teams_index_preview():
    teams = load_teams_index()
    active = [t for t in teams if t.active]
    return {
        "teams_total": len(teams),
        "teams_active": len(active),
        "first_5_active": [
            {
                "team_id": t.team_id,
                "team_name": t.team_name,
                "sheet_id": t.sheet_id,
                "export_tab": t.export_tab,
            }
            for t in active[:5]
        ],
    }


@app.get("/ingest/preview-first-team")
def ingest_preview_first_team():
    teams = load_teams_index()
    active = [t for t in teams if t.active]
    if not active:
        raise HTTPException(status_code=400, detail="No active teams in TeamsIndex.")

    t0 = active[0]
    try:
        report = ingest_preview_for_one_team(t0.sheet_id, t0.export_tab)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    report["team"] = {
        "team_id": t0.team_id,
        "team_name": t0.team_name,
        "sheet_id": t0.sheet_id,
        "export_tab": t0.export_tab,
    }
    return report


@app.get("/ingest/preview-all-teams")
def ingest_preview_all_teams():
    teams = load_teams_index()
    active = [t for t in teams if t.active]
    if not active:
        raise HTTPException(status_code=400, detail="No active teams in TeamsIndex.")

    totals = {
        "teams_processed": 0,
        "rows_total": 0,
        "observations_parsed": 0,
        "rows_skipped": 0,
    }

    global_unique = {}
    key_counts = {}   # how many times each game_key was observed across all sheets

    for t in active:
        report = ingest_preview_for_one_team(t.sheet_id, t.export_tab)

        totals["teams_processed"] += 1
        totals["rows_total"] += int(report["rows_total"])
        totals["observations_parsed"] += int(report["observations_parsed"])
        totals["rows_skipped"] += int(report["rows_skipped"])

        team_unique = report.get("unique_map", {})
        for game_key, game in team_unique.items():
            key_counts[game_key] = key_counts.get(game_key, 0) + 1

            if game_key not in global_unique:
                global_unique[game_key] = game
            else:
                # upsert missing scores
                if global_unique[game_key].get("a_score") is None and game.get("a_score") is not None:
                    global_unique[game_key] = game

    unique_games = len(global_unique)
    duplicates_collapsed = totals["observations_parsed"] - unique_games

    seen_once = sum(1 for k, c in key_counts.items() if c == 1)
    seen_twice = sum(1 for k, c in key_counts.items() if c == 2)
    seen_3plus = sum(1 for k, c in key_counts.items() if c >= 3)

    # sample any 3+ occurrences (if any)
    sample_3plus = [k for k, c in key_counts.items() if c >= 3][:10]

    return {
        **totals,
        "unique_games": unique_games,
        "duplicates_collapsed": duplicates_collapsed,
        "game_keys_seen_once": seen_once,
        "game_keys_seen_twice": seen_twice,
        "game_keys_seen_3plus": seen_3plus,
        "sample_game_keys_seen_3plus": sample_3plus,
        "sample_games": list(global_unique.items())[:10],
    }


DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
GAMES_JSON_PATH = os.path.abspath(os.path.join(DATA_DIR, "games.json"))
REFRESH_META_PATH = os.path.abspath(os.path.join(DATA_DIR, "refresh_meta.json"))


def _ensure_data_dir():
    os.makedirs(os.path.dirname(GAMES_JSON_PATH), exist_ok=True)


@app.post("/refresh")
def refresh_league():
    """
    Pulls all active team ScheduleExport tabs, dedupes to league-wide games, and writes to data/games.json
    """
    _ensure_data_dir()

    teams = load_teams_index()
    result = ingest_league(teams)
    summary = result["summary"]
    games_by_key = result["games_by_key"]

    # write games.json as a list for easier downstream reading
    games_list = []
    for game_key, g in games_by_key.items():
        games_list.append({
            "game_key": game_key,
            **g
        })

    with open(GAMES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(games_list, f, indent=2)

    meta = {
        "refreshed_at": datetime.utcnow().isoformat() + "Z",
        "games_path": GAMES_JSON_PATH,
        "games_count": len(games_list),
        "summary": summary,
    }
    with open(REFRESH_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return meta


@app.get("/refresh/meta")
def refresh_meta():
    _ensure_data_dir()
    if not os.path.exists(REFRESH_META_PATH):
        raise HTTPException(status_code=404, detail="No refresh_meta.json found. Run POST /refresh first.")
    with open(REFRESH_META_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/games")
def get_games():
    _ensure_data_dir()
    if not os.path.exists(GAMES_JSON_PATH):
        raise HTTPException(status_code=404, detail="No games.json found. Run POST /refresh first.")
    with open(GAMES_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_games_or_404():
    _ensure_data_dir()
    if not os.path.exists(GAMES_JSON_PATH):
        raise HTTPException(status_code=404, detail="No games.json found. Run POST /refresh first.")
    with open(GAMES_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def _to_int_or_none(v):
    try:
        return int(v)
    except Exception:
        return None

@app.get("/teams/{team_id}/schedule")
def team_schedule(
    team_id: str,
    include_unplayed: bool = True,
    phase: Optional[str] = None,
    week: Optional[int] = None,
):
    """
    Returns all games involving team_id (either team_a or team_b) from data/games.json.
    Query params:
      - include_unplayed: include games with no scores (default True)
      - phase: filter by phase (e.g., REG_SEASON)
      - week: filter by week number (int)
    """
    games = _load_games_or_404()
    tid = team_id.strip().upper()

    out = []
    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        if tid not in (ta, tb):
            continue

        # filters
        if phase is not None:
            if str(g.get("phase", "")).strip().upper() != phase.strip().upper():
                continue

        if week is not None:
            w = _to_int_or_none(g.get("week"))
            if w != week:
                continue

        a_score = g.get("a_score")
        b_score = g.get("b_score")
        played = (a_score is not None) and (b_score is not None)

        if (not include_unplayed) and (not played):
            continue

        # build a friendly view from the team's perspective
        if tid == ta:
            team_score = a_score
            opp_score = b_score
            opponent_id = tb
            site = "HOME" if g.get("home_id") == ta and g.get("venue") == "H" else ("AWAY" if g.get("home_id") == tb and g.get("venue") == "H" else "NEUTRAL")
        else:
            team_score = b_score
            opp_score = a_score
            opponent_id = ta
            site = "HOME" if g.get("home_id") == tb and g.get("venue") == "H" else ("AWAY" if g.get("home_id") == ta and g.get("venue") == "H" else "NEUTRAL")

        out.append({
            "game_key": g.get("game_key"),
            "phase": g.get("phase"),
            "week": _to_int_or_none(g.get("week")),
            "site": site,
            "team_id": tid,
            "opponent_team_id": opponent_id,
            "team_score": team_score,
            "opp_score": opp_score,
            "played": played,
            # raw normalized identifiers (useful for debugging)
            "team_a": ta,
            "team_b": tb,
            "venue": g.get("venue"),
            "home_id": g.get("home_id"),
            "away_id": g.get("away_id"),
        })

    # sort by phase then week then opponent for stable display
    def sort_key(x):
        return (str(x.get("phase","")), x.get("week") if x.get("week") is not None else 9999, str(x.get("opponent_team_id","")))

    out_sorted = sorted(out, key=sort_key)

    return {
        "team_id": tid,
        "games_returned": len(out_sorted),
        "filters": {"include_unplayed": include_unplayed, "phase": phase, "week": week},
        "schedule": out_sorted,
    }
    

@app.get("/rankings")
def rankings():
    """
    Simple rankings: win/loss/win_pct from games with scores present.
    """
    _ensure_data_dir()
    if not os.path.exists(GAMES_JSON_PATH):
        raise HTTPException(status_code=404, detail="No games.json found. Run POST /refresh first.")

    with open(GAMES_JSON_PATH, "r", encoding="utf-8") as f:
        games = json.load(f)

    # standings keyed by team_id
    standings = {}

    def ensure_team(tid: str):
        if tid not in standings:
            standings[tid] = {"team_id": tid, "wins": 0, "losses": 0, "played": 0, "win_pct": 0.0}

    for g in games:
        team_a = g.get("team_a")
        team_b = g.get("team_b")
        a_score = g.get("a_score")
        b_score = g.get("b_score")

        if not team_a or not team_b:
            continue

        ensure_team(team_a)
        ensure_team(team_b)

        # Only count played games where BOTH scores are present
        if a_score is None or b_score is None:
            continue

        standings[team_a]["played"] += 1
        standings[team_b]["played"] += 1

        if a_score > b_score:
            standings[team_a]["wins"] += 1
            standings[team_b]["losses"] += 1
        elif b_score > a_score:
            standings[team_b]["wins"] += 1
            standings[team_a]["losses"] += 1
        else:
            # ties unlikely; ignore for now
            pass

    for tid, s in standings.items():
        if s["played"] > 0:
            s["win_pct"] = round(s["wins"] / s["played"], 4)
        else:
            s["win_pct"] = 0.0

    # sort: win_pct desc, then wins desc, then team_id asc for stability
    ranked = sorted(
        standings.values(),
        key=lambda x: (-x["win_pct"], -x["wins"], x["team_id"])
    )

    return {
        "teams_ranked": len(ranked),
        "rankings": ranked
    }