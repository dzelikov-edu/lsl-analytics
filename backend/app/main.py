from fastapi import FastAPI, HTTPException
from app.ingest import load_teams_index, ingest_preview_for_one_team, ingest_league

import json
import os
import threading
from datetime import datetime
from typing import Optional
from fastapi.responses import JSONResponse

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


@app.get("/teams")
def list_teams(active_only: bool = True):
    """
    Lists teams from TeamsIndex (master sheet).
    Query param:
      - active_only: if true, only return teams where active==TRUE (default True)
    """
    teams = load_teams_index()
    if active_only:
        teams = [t for t in teams if t.active]

    # stable ordering
    teams_sorted = sorted(teams, key=lambda t: (t.team_name.lower(), t.team_id))

    return {
        "count": len(teams_sorted),
        "teams": [
            {
                "team_id": t.team_id,
                "team_name": t.team_name,
                "active": t.active,
            }
            for t in teams_sorted
        ],
    }


@app.get("/teams/search")
def search_teams(q: str, limit: int = 25):
    """
    Search teams by partial name or team_id.
    Uses TeamsIndex + TeamMap fallback via _team_name_map(active_only=False).

    Query params:
      - q: search string (required)
      - limit: max results to return (default 25)
    """
    query = (q or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query param 'q' is required (e.g., /teams/search?q=boston).")

    limit = max(1, min(int(limit), 100))  # clamp 1..100
    q_lower = query.lower()

    # Build a unified name map: TEAM_ID -> display name (includes non-69 teams)
    name_map = _team_name_map(active_only=False)

    results = []
    for tid, name in name_map.items():
        tid_u = str(tid).strip().upper()
        name_s = str(name).strip()
        haystack = f"{tid_u} {name_s}".lower()

        if q_lower in haystack:
            results.append({
                "team_id": tid_u,
                "team_name": name_s if name_s else tid_u,
            })

    # stable ordering: name then id
    results_sorted = sorted(results, key=lambda x: (x["team_name"].lower(), x["team_id"]))

    return {
        "query": query,
        "count": len(results_sorted),
        "limit": limit,
        "results": results_sorted[:limit],
    }


@app.get("/teams/{team_id}")
def get_team(team_id: str):
    """
    Team card (from TeamsIndex) + useful links.
    """
    tid = team_id.strip().upper()
    teams = load_teams_index()

    match = next((t for t in teams if t.team_id.strip().upper() == tid), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Unknown team_id: {tid}")

    return {
        "team_id": tid,
        "team_name": match.team_name,
        "active": match.active,
        "links": {
            "schedule": f"/teams/{tid}/schedule",
            "summary": f"/teams/{tid}/summary",
            "results": f"/teams/{tid}/results",
            "upcoming": f"/teams/{tid}/upcoming",
        }
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

# --- refresh lock (prevents concurrent refresh runs) ---
_REFRESH_LOCK = threading.Lock()
REFRESH_LOCK_PATH = os.path.abspath(os.path.join(DATA_DIR, "refresh.lock"))


def _ensure_data_dir():
    os.makedirs(os.path.dirname(GAMES_JSON_PATH), exist_ok=True)


def _try_acquire_refresh_lock() -> bool:
    """
    Returns True if we successfully acquired the refresh lock, else False.
    Uses both an in-process lock and a lockfile (extra safety).
    """
    # in-process lock (fast path)
    if not _REFRESH_LOCK.acquire(blocking=False):
        return False

    # lockfile (cross-process-ish safety; also survives odd states)
    try:
        _ensure_data_dir()
        if os.path.exists(REFRESH_LOCK_PATH):
            # someone else left/holds the lockfile
            _REFRESH_LOCK.release()
            return False

        with open(REFRESH_LOCK_PATH, "w", encoding="utf-8") as f:
            f.write(datetime.utcnow().isoformat() + "Z")
        return True

    except Exception:
        # if anything goes wrong, don't keep the in-process lock held
        try:
            _REFRESH_LOCK.release()
        except Exception:
            pass
        raise


def _release_refresh_lock():
    """
    Release refresh lock + remove lockfile.
    """
    try:
        if os.path.exists(REFRESH_LOCK_PATH):
            os.remove(REFRESH_LOCK_PATH)
    finally:
        try:
            _REFRESH_LOCK.release()
        except Exception:
            pass


from app.ingest import load_team_map_names  # add to your existing ingest imports at top

def _team_name_map(active_only: bool = False) -> dict:
    """
    Returns {TEAM_ID: Team Name}.
    Priority:
      1) TeamsIndex (69 teams, better "official" names)
      2) TeamMap display_name (covers external opponents)
      3) fallback to TEAM_ID
    """
    # Start with TeamMap so external teams get names too
    out = {k.strip().upper(): v for k, v in load_team_map_names().items()}

    teams = load_teams_index()
    if active_only:
        teams = [t for t in teams if t.active]

    # TeamsIndex overrides TeamMap for the 69
    for t in teams:
        out[t.team_id.strip().upper()] = t.team_name

    return out


@app.post("/refresh")
def refresh_league():
    """
    Pulls all active team ScheduleExport tabs, dedupes to league-wide games, and writes to data/games.json
    """
    if not _try_acquire_refresh_lock():
        return JSONResponse(
            status_code=409,
            content={"ok": False, "detail": "Refresh already running. Try again in a moment."}
        )

    try:
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

    finally:
        _release_refresh_lock()


@app.get("/refresh/meta")
def refresh_meta():
    _ensure_data_dir()
    if not os.path.exists(REFRESH_META_PATH):
        raise HTTPException(status_code=404, detail="No refresh_meta.json found. Run POST /refresh first.")
    with open(REFRESH_META_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
    

@app.get("/status")
def status():
    """
    Quick operational status: last refresh + counts.
    """
    _ensure_data_dir()

    if not os.path.exists(REFRESH_META_PATH):
        return {
            "ok": True,
            "message": "No refresh_meta.json yet. Run POST /refresh first.",
            "has_games_json": os.path.exists(GAMES_JSON_PATH),
        }

    with open(REFRESH_META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    summary = meta.get("summary", {})

    return {
        "ok": True,
        "refreshed_at": meta.get("refreshed_at"),
        "games_count": meta.get("games_count"),
        "teams_processed": summary.get("teams_processed"),
        "teams_failed": summary.get("teams_failed"),
        "rows_total": summary.get("rows_total"),
        "observations_parsed": summary.get("observations_parsed"),
        "unique_games": summary.get("unique_games"),
        "duplicates_collapsed": summary.get("duplicates_collapsed"),
        "failures_count": summary.get("failures_count", 0),
    }


@app.get("/games")
def get_games(
    limit: int = 100,
    offset: int = 0,
    sort: str = "phase_week",
    order: str = "asc",
    team_id: Optional[str] = None,
    phase: Optional[str] = None,
    week: Optional[int] = None,
    played: Optional[bool] = None,
    date: Optional[str] = None,
):
    """
    Paginated + sortable + filterable games list from data/games.json

    Filters:
      - team_id: include games where team_id is team_a OR team_b (case-insensitive)
      - phase: exact match (REG_SEASON / CONF_TOURNEY / NAT_TOURNEY)
      - week: integer week
      - played: true/false (based on a_score & b_score present)
      - date: requires games to contain date_key (MMDD). Accepts "MMDD" or "MM/DD".

    Sorting:
      - sort: one of [phase_week, week, team, date, none]
      - order: asc|desc
    """
    games = _load_games_or_404()

    # ---- parse/clamp pagination ----
    try:
        limit = int(limit)
        offset = int(offset)
    except Exception:
        raise HTTPException(status_code=400, detail="limit and offset must be integers")

    limit = max(1, min(limit, 500))
    offset = max(0, offset)

    # ---- normalize filters ----
    tid = team_id.strip().upper() if team_id else None
    ph = phase.strip().upper() if phase else None
    wk = int(week) if week is not None else None

    # normalize date input to MMDD (string)
    date_key = None
    if date:
        d = date.strip()
        d = d.replace("/", "")
        if len(d) != 4 or not d.isdigit():
            raise HTTPException(status_code=400, detail="date must be MMDD or MM/DD (e.g., 0101 or 01/01)")
        date_key = d

        # If none of the games have date_key, date filtering can't work yet.
        if not any("date_key" in g for g in games):
            raise HTTPException(
                status_code=400,
                detail="date filtering requested, but games.json does not include date_key yet. Add date_key during refresh/ingest first."
            )

    # ---- filtering ----
    filtered = []
    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        g_phase = str(g.get("phase", "")).strip().upper()
        g_week = _to_int_or_none(g.get("week"))

        a_score = g.get("a_score")
        b_score = g.get("b_score")
        g_played = (a_score is not None) and (b_score is not None)

        if tid and tid not in (ta, tb):
            continue
        if ph and g_phase != ph:
            continue
        if wk is not None and g_week != wk:
            continue
        if played is not None and g_played != bool(played):
            continue

        if date_key is not None:
            g_dk = str(g.get("date_key", "")).strip()
            if g_dk != date_key:
                continue

        filtered.append(g)

    # ---- sorting ----
    sort = (sort or "phase_week").strip().lower()
    order = (order or "asc").strip().lower()
    reverse = (order == "desc")

    def _phase_rank(p: str) -> int:
        p = (p or "").strip().upper()
        return {"REG_SEASON": 1, "CONF_TOURNEY": 2, "NAT_TOURNEY": 3}.get(p, 9)

    def _to_week(v):
        w = _to_int_or_none(v)
        return w if w is not None else 9999

    def _season_date_sort_key(g):
        """
        Sort date_key (MMDD) in season order assuming season starts in Nov:
        11xx,12xx, then 01xx..10xx
        Returns a tuple (season_month_rank, day) where month_rank makes Nov=11 come before Jan=1.
        """
        dk = str(g.get("date_key", "")).strip()
        if len(dk) != 4 or not dk.isdigit():
            return (999, 999)

        mm = int(dk[:2])
        dd = int(dk[2:])

        # push Jan-Oct after Nov-Dec by adding 12 to months 1..10
        mm_rank = mm + 12 if mm <= 10 else mm
        return (mm_rank, dd)

    def sort_key(g):
        phase_v = str(g.get("phase", "")).strip().upper()
        week_v = _to_week(g.get("week"))
        home_id = str(g.get("home_id", "")).strip().upper()
        away_id = str(g.get("away_id", "")).strip().upper()
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()

        if sort == "none":
            return (0,)

        if sort == "week":
            return (week_v, _phase_rank(phase_v), home_id, away_id)

        if sort == "team":
            a = min(ta, tb)
            b = max(ta, tb)
            return (a, b, _phase_rank(phase_v), week_v)

        if sort == "date":
            return (_season_date_sort_key(g), _phase_rank(phase_v), week_v, home_id, away_id)

        # default: phase_week
        return (_phase_rank(phase_v), week_v, home_id, away_id)

    if sort not in ("phase_week", "week", "team", "date", "none"):
        raise HTTPException(status_code=400, detail="sort must be one of: phase_week, week, team, date, none")
    if order not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="order must be asc or desc")

    filtered_sorted = sorted(filtered, key=sort_key, reverse=reverse)

    # ---- paginate ----
    total = len(filtered_sorted)
    page = filtered_sorted[offset: offset + limit]

    next_offset = offset + limit
    if next_offset >= total:
        next_offset = None

    prev_offset = offset - limit
    if prev_offset < 0:
        prev_offset = None

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "count": len(page),
        "sort": sort,
        "order": order,
        "filters": {
            "team_id": tid,
            "phase": ph,
            "week": wk,
            "played": played,
            "date": date_key,
        },
        "next_offset": next_offset,
        "prev_offset": prev_offset,
        "results": page,
    }


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
    

@app.get("/games/{game_key}")
def get_game_by_key(game_key: str):
    games = _load_games_or_404()
    name_map = _team_name_map(active_only=False)
    key = game_key.strip()

    for g in games:
        if str(g.get("game_key", "")).strip() == key:
            ta = str(g.get("team_a", "")).strip().upper()
            tb = str(g.get("team_b", "")).strip().upper()
            home_id = str(g.get("home_id", "")).strip().upper()
            away_id = str(g.get("away_id", "")).strip().upper()

            return {
                **g,
                "team_a_name": name_map.get(ta, ta),
                "team_b_name": name_map.get(tb, tb),
                "home_name": name_map.get(home_id, home_id),
                "away_name": name_map.get(away_id, away_id),
            }

    raise HTTPException(status_code=404, detail=f"game_key not found: {key}")


@app.get("/matchup/{team1}/{team2}")
def matchup(team1: str, team2: str):
    games = _load_games_or_404()
    name_map = _team_name_map(active_only=False)
    t1 = team1.strip().upper()
    t2 = team2.strip().upper()

    out = []
    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()

        if {ta, tb} != {t1, t2}:
            continue

        a_score = g.get("a_score")
        b_score = g.get("b_score")
        played = (a_score is not None) and (b_score is not None)

        out.append({
            "game_key": g.get("game_key"),
            "phase": str(g.get("phase", "")).strip().upper(),
            "week": _to_int_or_none(g.get("week")),
            "venue": g.get("venue"),
            "home_id": g.get("home_id"),
            "home_name": name_map.get(str(g.get("home_id", "")).strip().upper(), str(g.get("home_id", "")).strip().upper()),
            "away_id": g.get("away_id"),
            "away_name": name_map.get(str(g.get("away_id", "")).strip().upper(), str(g.get("away_id", "")).strip().upper()),
            "team_a": ta,
            "team_a_name": name_map.get(ta, ta),
            "team_b": tb,
            "team_b_name": name_map.get(tb, tb),
            "a_score": a_score,
            "b_score": b_score,
            "played": played,
        })

    out_sorted = sorted(out, key=lambda x: (x["phase"], x["week"] if x["week"] is not None else 9999))
    return {
        "team1": t1,
        "team1_name": name_map.get(t1, t1),
        "team2": t2,
        "team2_name": name_map.get(t2, t2),
        "games_returned": len(out_sorted),
        "games": out_sorted
    }
    

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


@app.get("/teams/{team_id}/results")
def team_results(team_id: str, phase: Optional[str] = None):
    """
    Played games only (wrapper around /schedule).
    """
    return team_schedule(team_id=team_id, include_unplayed=False, phase=phase, week=None)


@app.get("/teams/{team_id}/upcoming")
def team_upcoming(team_id: str, phase: Optional[str] = None):
    """
    Unplayed games only.
    """
    games = _load_games_or_404()
    tid = team_id.strip().upper()

    out = []
    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        if tid not in (ta, tb):
            continue

        if phase is not None:
            if str(g.get("phase", "")).strip().upper() != phase.strip().upper():
                continue

        a_score = g.get("a_score")
        b_score = g.get("b_score")
        played = (a_score is not None) and (b_score is not None)
        if played:
            continue

        opponent = tb if tid == ta else ta
        out.append({
            "game_key": g.get("game_key"),
            "phase": str(g.get("phase", "")).strip().upper(),
            "week": _to_int_or_none(g.get("week")),
            "team_id": tid,
            "opponent_team_id": opponent,
            "venue": g.get("venue"),
            "home_id": g.get("home_id"),
            "away_id": g.get("away_id"),
        })

    out_sorted = sorted(
        out,
        key=lambda x: (
            x["phase"],
            x["week"] if x["week"] is not None else 9999,
            x["opponent_team_id"]
        )
    )

    return {"team_id": tid, "games_returned": len(out_sorted), "upcoming": out_sorted}


@app.get("/teams/{team_id}/summary")
def team_summary(team_id: str):
    """
    Summary for a team:
      - W/L/played/win_pct
      - last played game (if any)
      - next upcoming game (if any)
      - totals by phase
    """
    games = _load_games_or_404()
    tid = team_id.strip().upper()

    # pull this team's games using the same logic as schedule filtering (but internal)
    team_games = []
    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        if tid not in (ta, tb):
            continue

        week = _to_int_or_none(g.get("week"))
        phase = str(g.get("phase", "")).strip().upper()
        a_score = g.get("a_score")
        b_score = g.get("b_score")
        played = (a_score is not None) and (b_score is not None)

        # determine opponent + team/opp scores from perspective
        if tid == ta:
            opponent = tb
            team_score = a_score
            opp_score = b_score
        else:
            opponent = ta
            team_score = b_score
            opp_score = a_score

        team_games.append({
            "game_key": g.get("game_key"),
            "phase": phase,
            "week": week,
            "opponent_team_id": opponent,
            "played": played,
            "team_score": team_score,
            "opp_score": opp_score,
        })

    if not team_games:
        raise HTTPException(status_code=404, detail=f"team_id '{tid}' not found in games.json")

    # record
    wins = losses = played_ct = 0
    by_phase = {}

    for x in team_games:
        ph = x["phase"]
        by_phase.setdefault(ph, {"phase": ph, "played": 0, "wins": 0, "losses": 0})

        if not x["played"]:
            continue

        played_ct += 1
        by_phase[ph]["played"] += 1

        if x["team_score"] > x["opp_score"]:
            wins += 1
            by_phase[ph]["wins"] += 1
        elif x["team_score"] < x["opp_score"]:
            losses += 1
            by_phase[ph]["losses"] += 1

    win_pct = round(wins / played_ct, 4) if played_ct > 0 else 0.0

    # last played and next unplayed (by week)
    played_games = sorted([g for g in team_games if g["played"]], key=lambda r: (r["phase"], r["week"] or 9999))
    unplayed_games = sorted([g for g in team_games if not g["played"]], key=lambda r: (r["phase"], r["week"] or 9999))

    last_game = played_games[-1] if played_games else None
    next_game = unplayed_games[0] if unplayed_games else None

    return {
        "team_id": tid,
        "record": {"wins": wins, "losses": losses, "played": played_ct, "win_pct": win_pct},
        "by_phase": sorted(by_phase.values(), key=lambda r: r["phase"]),
        "last_game": last_game,
        "next_game": next_game,
        "games_total_in_file": len(team_games),
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

    name_map = _team_name_map(active_only=True)

    # standings keyed by team_id
    standings = {}

    def ensure_team(tid: str):
        tid = tid.strip().upper()
        if tid not in standings:
            standings[tid] = {
                "team_id": tid,
                "team_name": name_map.get(tid, tid),
                "wins": 0,
                "losses": 0,
                "played": 0,
                "win_pct": 0.0
            }

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


@app.get("/rankings/sos-lite")
def rankings_sos_lite(min_games: int = 0):
    """
    Rankings with SOS-lite:
      - win_pct based on played games
      - sos_lite = average opponent win_pct (played games only)
    Query params:
      - min_games: only include teams with at least this many played games (default 0)
    """
    games = _load_games_or_404()
    name_map = _team_name_map(active_only=True)

    # 1) Build W/L records from played games only
    rec = {}  # team_id -> {wins, losses, played}
    def ensure(tid: str):
        tid = tid.strip().upper()
        if tid not in rec:
            rec[tid] = {
                "team_id": tid,
                "team_name": name_map.get(tid, tid),
                "wins": 0,
                "losses": 0,
                "played": 0
            }

    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        a = g.get("a_score")
        b = g.get("b_score")

        if not ta or not tb:
            continue

        ensure(ta); ensure(tb)

        if a is None or b is None:
            continue

        rec[ta]["played"] += 1
        rec[tb]["played"] += 1

        if a > b:
            rec[ta]["wins"] += 1
            rec[tb]["losses"] += 1
        elif b > a:
            rec[tb]["wins"] += 1
            rec[ta]["losses"] += 1

    # compute win_pct
    for tid, r in rec.items():
        r["win_pct"] = round((r["wins"] / r["played"]), 4) if r["played"] > 0 else 0.0

    # 2) Compute SOS-lite: avg opponent win_pct (played games only)
    opp_lists = {}  # team_id -> list of opponent_ids from played games
    for tid in rec.keys():
        opp_lists[tid] = []

    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        a = g.get("a_score")
        b = g.get("b_score")

        if not ta or not tb:
            continue
        if a is None or b is None:
            continue
        if ta not in rec or tb not in rec:
            continue

        opp_lists[ta].append(tb)
        opp_lists[tb].append(ta)

    for tid, opps in opp_lists.items():
        if len(opps) == 0:
            rec[tid]["sos_lite"] = 0.0
            rec[tid]["opp_games_counted"] = 0
            continue

        # average of opponents' win_pct (each played game counts once)
        s = 0.0
        counted = 0
        for o in opps:
            if o in rec:
                s += rec[o]["win_pct"]
                counted += 1

        rec[tid]["opp_games_counted"] = counted
        rec[tid]["sos_lite"] = round((s / counted), 4) if counted > 0 else 0.0

    # 3) Filter + sort
    rows = [r for r in rec.values() if r["played"] >= min_games]
    rows_sorted = sorted(
        rows,
        key=lambda x: (-x["win_pct"], -x["sos_lite"], -x["wins"], x["team_id"])
    )

    return {
        "teams_ranked": len(rows_sorted),
        "min_games": min_games,
        "rankings": rows_sorted
    }