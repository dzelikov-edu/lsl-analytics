from fastapi import FastAPI, HTTPException
from app.ingest import load_teams_index, ingest_preview_for_one_team, ingest_league, load_polls

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


def _latest_poll_week(rows: list[dict]) -> int | None:
    weeks = sorted({r["week"] for r in rows})
    return weeks[-1] if weeks else None


def _poll_payload(rows: list[dict], week: int, poll: str, name_map: dict) -> dict:
    poll = poll.upper()

    subset = [r for r in rows if r["week"] == week and r["poll"] == poll]

    top25 = sorted([r for r in subset if r["bucket"] == "TOP25"], key=lambda x: x["bucket_order"])
    next5 = sorted([r for r in subset if r["bucket"] == "NEXT5"], key=lambda x: x["bucket_order"])

    # TOP25 has official rank; NEXT5 does not.
    top25_out = [{
        "rank": r["bucket_order"],
        "team_id": r["team_id"],
        "team_name": name_map.get(r["team_id"], r["team_id"]),
        "notes": r.get("notes", ""),
    } for r in top25]

    next5_out = [{
        "order": r["bucket_order"],  # internal ordering only
        "team_id": r["team_id"],
        "team_name": name_map.get(r["team_id"], r["team_id"]),
        "notes": r.get("notes", ""),
    } for r in next5]

    return {
        "poll": poll,
        "week": week,
        "top25": top25_out,
        "next5": next5_out,
        "counts": {"top25": len(top25_out), "next5": len(next5_out)},
    }


@app.get("/polls")
def polls(week: int | None = None):
    """
    Returns both polls (LSL + LCAA) for a week.
    If week not provided, returns latest week present in Polls sheet.
    """
    rows = load_polls()
    if not rows:
        raise HTTPException(status_code=404, detail="No poll data found. Fill Polls tab first.")

    w = week if week is not None else _latest_poll_week(rows)
    if w is None:
        raise HTTPException(status_code=404, detail="No poll weeks found in Polls tab.")

    name_map = _team_name_map(active_only=False)

    return {
        "week": w,
        "polls": {
            "LSL": _poll_payload(rows, w, "LSL", name_map),
            "LCAA": _poll_payload(rows, w, "LCAA", name_map),
        }
    }


@app.get("/polls/{poll}")
def poll_single(poll: str, week: int | None = None):
    """
    Returns one poll (LSL or LCAA) for a week.
    If week not provided, returns latest week present in Polls sheet.
    """
    poll_u = poll.strip().upper()
    if poll_u not in ("LSL", "LCAA"):
        raise HTTPException(status_code=400, detail="poll must be LSL or LCAA")

    rows = load_polls()
    if not rows:
        raise HTTPException(status_code=404, detail="No poll data found. Fill Polls tab first.")

    w = week if week is not None else _latest_poll_week(rows)
    if w is None:
        raise HTTPException(status_code=404, detail="No poll weeks found in Polls tab.")

    name_map = _team_name_map(active_only=False)
    return _poll_payload(rows, w, poll_u, name_map)


@app.get("/home")
def home(
    team_id: Optional[str] = None,
    days: int = 3,
    top_n: int = 25,
    phase: Optional[str] = None,
):
    """
    Mobile-friendly home payload:
      - status (last refresh)
      - next upcoming day(s) of games (calendar preview)
      - top rankings preview (SOS-lite)
    Optional filters:
      - team_id: scope calendar preview to a team
      - phase: scope calendar preview to a phase (e.g., REG_SEASON)
    """
    _ensure_data_dir()

    # ---- status/meta ----
    meta = None
    if os.path.exists(REFRESH_META_PATH):
        with open(REFRESH_META_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)

    games = _load_games_or_404()
    name_map = _team_name_map(active_only=False)

    # normalize inputs
    tid = team_id.strip().upper() if team_id else None
    ph = phase.strip().upper() if phase else None

    try:
        days = int(days)
        top_n = int(top_n)
    except Exception:
        raise HTTPException(status_code=400, detail="days and top_n must be integers")

    days = max(1, min(days, 14))
    top_n = max(5, min(top_n, 100))

    def _phase_rank(p: str) -> int:
        return {"REG_SEASON": 1, "CONF_TOURNEY": 2, "NAT_TOURNEY": 3}.get(p, 9)

    def _season_rank_from_date_key(dk: str) -> int:
        if not dk or len(dk) != 4 or not dk.isdigit():
            return 999999
        mm = int(dk[:2])
        dd = int(dk[2:])
        mm_rank = mm + 12 if mm <= 10 else mm
        return mm_rank * 100 + dd

    def _display_date(dk: str) -> str:
        if dk and len(dk) == 4 and dk.isdigit():
            return f"{dk[:2]}/{dk[2:]}"
        return ""

    # ---- build a "next days" calendar preview ----
    # pick upcoming games only (unplayed) to represent "what's next"
    buckets = {}
    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        g_phase = str(g.get("phase", "")).strip().upper()
        dk = str(g.get("date_key", "")).strip()

        a = g.get("a_score")
        b = g.get("b_score")
        played_flag = (a is not None) and (b is not None)

        if played_flag:
            continue
        if not dk:
            continue
        if tid and tid not in (ta, tb):
            continue
        if ph and g_phase != ph:
            continue

        buckets.setdefault(dk, []).append(g)

    date_keys_sorted = sorted(buckets.keys(), key=_season_rank_from_date_key)
    next_dates = date_keys_sorted[:days]

    calendar_preview = []
    for dk in next_dates:
        games_for_day = buckets.get(dk, [])

        def _game_sort_key(g):
            gp = str(g.get("phase", "")).strip().upper()
            gw = _to_int_or_none(g.get("week"))
            gw = gw if gw is not None else 9999
            home_id = str(g.get("home_id", "")).strip().upper()
            away_id = str(g.get("away_id", "")).strip().upper()
            return (_phase_rank(gp), gw, home_id, away_id)

        games_sorted = sorted(games_for_day, key=_game_sort_key)

        out_games = []
        for g in games_sorted:
            home_id = str(g.get("home_id", "")).strip().upper()
            away_id = str(g.get("away_id", "")).strip().upper()
            ta = str(g.get("team_a", "")).strip().upper()
            tb = str(g.get("team_b", "")).strip().upper()

            out_games.append({
                "game_key": g.get("game_key"),
                "phase": str(g.get("phase", "")).strip().upper(),
                "week": _to_int_or_none(g.get("week")),
                "venue": g.get("venue"),
                "home_id": home_id,
                "home_name": name_map.get(home_id, home_id),
                "away_id": away_id,
                "away_name": name_map.get(away_id, away_id),
                "team_a": ta,
                "team_a_name": name_map.get(ta, ta),
                "team_b": tb,
                "team_b_name": name_map.get(tb, tb),
            })

        calendar_preview.append({
            "date_key": dk,
            "display_date": _display_date(dk),
            "season_rank": _season_rank_from_date_key(dk),
            "games_count": len(out_games),
            "games": out_games,
        })

    # ---- rankings preview (SOS-lite) ----
    # compute quickly from games list (played games only)
    rec = {}
    def ensure(tid2: str):
        tid2 = tid2.strip().upper()
        if tid2 not in rec:
            rec[tid2] = {"team_id": tid2, "team_name": name_map.get(tid2, tid2), "wins": 0, "losses": 0, "played": 0}

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

    for tid2, r in rec.items():
        r["win_pct"] = round((r["wins"] / r["played"]), 4) if r["played"] > 0 else 0.0

    opp_lists = {tid2: [] for tid2 in rec.keys()}
    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        a = g.get("a_score")
        b = g.get("b_score")
        if a is None or b is None:
            continue
        if ta in opp_lists and tb in opp_lists:
            opp_lists[ta].append(tb)
            opp_lists[tb].append(ta)

    for tid2, opps in opp_lists.items():
        if not opps:
            rec[tid2]["sos_lite"] = 0.0
            continue
        s = 0.0
        for o in opps:
            s += rec.get(o, {"win_pct": 0.0})["win_pct"]
        rec[tid2]["sos_lite"] = round(s / len(opps), 4)

    ranked = sorted(rec.values(), key=lambda x: (-x["win_pct"], -x["sos_lite"], -x["wins"], x["team_id"]))
    rankings_preview = ranked[:top_n]

        # ---- team summary preview (only when team_id is provided) ----
    team_summary_preview = None
    if tid:
        team_games = []
        wins = losses = played_ct = 0

        for g in games:
            ta = str(g.get("team_a", "")).strip().upper()
            tb = str(g.get("team_b", "")).strip().upper()
            if tid not in (ta, tb):
                continue

            week_v = _to_int_or_none(g.get("week"))
            phase_v = str(g.get("phase", "")).strip().upper()
            dk = str(g.get("date_key", "")).strip()

            a_score = g.get("a_score")
            b_score = g.get("b_score")
            played_flag = (a_score is not None) and (b_score is not None)

            # perspective scores/opponent
            if tid == ta:
                opponent_id = tb
                team_score = a_score
                opp_score = b_score
            else:
                opponent_id = ta
                team_score = b_score
                opp_score = a_score

            if played_flag:
                played_ct += 1
                if team_score > opp_score:
                    wins += 1
                elif team_score < opp_score:
                    losses += 1

            team_games.append({
                "game_key": g.get("game_key"),
                "phase": phase_v,
                "week": week_v,
                "date_key": dk,
                "opponent_team_id": opponent_id,
                "opponent_name": name_map.get(opponent_id, opponent_id),
                "played": played_flag,
                "team_score": team_score,
                "opp_score": opp_score,
                "home_id": str(g.get("home_id", "")).strip().upper(),
                "away_id": str(g.get("away_id", "")).strip().upper(),
            })

        def _phase_rank(p: str) -> int:
            return {"REG_SEASON": 1, "CONF_TOURNEY": 2, "NAT_TOURNEY": 3}.get(p, 9)

        def _season_rank_from_date_key(dk: str) -> int:
            if not dk or len(dk) != 4 or not dk.isdigit():
                return 999999
            mm = int(dk[:2])
            dd = int(dk[2:])
            mm_rank = mm + 12 if mm <= 10 else mm
            return mm_rank * 100 + dd

        # last played game (latest by season-date, then phase/week)
        played_games = sorted(
            [x for x in team_games if x["played"]],
            key=lambda x: (_season_rank_from_date_key(x["date_key"]), _phase_rank(x["phase"]), x["week"] if x["week"] is not None else 9999)
        )
        last_game = played_games[-1] if played_games else None

        # next upcoming game (earliest by season-date, then phase/week)
        upcoming_games = sorted(
            [x for x in team_games if not x["played"]],
            key=lambda x: (_season_rank_from_date_key(x["date_key"]), _phase_rank(x["phase"]), x["week"] if x["week"] is not None else 9999)
        )
        next_game = upcoming_games[0] if upcoming_games else None

        win_pct = round(wins / played_ct, 4) if played_ct > 0 else 0.0

        team_summary_preview = {
            "team_id": tid,
            "team_name": name_map.get(tid, tid),
            "record": {"wins": wins, "losses": losses, "played": played_ct, "win_pct": win_pct},
            "games_total_in_file": len(team_games),
            "last_game": last_game,
            "next_game": next_game,
            "upcoming_count": len(upcoming_games),
        }

        # ---- my_team_next_3 (only when team_id is provided) ----
    my_team_next_3 = None
    if tid:
        upcoming = []

        for g in games:
            ta = str(g.get("team_a", "")).strip().upper()
            tb = str(g.get("team_b", "")).strip().upper()
            if tid not in (ta, tb):
                continue

            a = g.get("a_score")
            b = g.get("b_score")
            played_flag = (a is not None) and (b is not None)
            if played_flag:
                continue

            dk = str(g.get("date_key", "")).strip()
            if not dk:
                continue

            phase_v = str(g.get("phase", "")).strip().upper()
            week_v = _to_int_or_none(g.get("week"))

            home_id = str(g.get("home_id", "")).strip().upper()
            away_id = str(g.get("away_id", "")).strip().upper()
            venue = str(g.get("venue", "")).strip().upper()

            opponent_id = away_id if home_id == tid else home_id
            opponent_name = name_map.get(opponent_id, opponent_id)

            # site from perspective of tid
            if venue == "N":
                site = "NEUTRAL"
            else:
                site = "HOME" if home_id == tid else "AWAY"

            upcoming.append({
                "game_key": g.get("game_key"),
                "date_key": dk,
                "display_date": _display_date(dk),
                "phase": phase_v,
                "week": week_v,
                "site": site,
                "opponent_team_id": opponent_id,
                "opponent_name": opponent_name,
                "home_id": home_id,
                "home_name": name_map.get(home_id, home_id),
                "away_id": away_id,
                "away_name": name_map.get(away_id, away_id),
            })

        # sort by season date order, then phase, then week
        upcoming_sorted = sorted(
            upcoming,
            key=lambda x: (_season_rank_from_date_key(x["date_key"]), _phase_rank(x["phase"]), x["week"] if x["week"] is not None else 9999)
        )

        my_team_next_3 = {
            "team_id": tid,
            "team_name": name_map.get(tid, tid),
            "games_returned": min(3, len(upcoming_sorted)),
            "games": upcoming_sorted[:3],
        }

        # ---- my_team_recent_3 (only when team_id is provided) ----
    my_team_recent_3 = None
    if tid:
        recent = []

        for g in games:
            ta = str(g.get("team_a", "")).strip().upper()
            tb = str(g.get("team_b", "")).strip().upper()
            if tid not in (ta, tb):
                continue

            a = g.get("a_score")
            b = g.get("b_score")
            played_flag = (a is not None) and (b is not None)
            if not played_flag:
                continue

            dk = str(g.get("date_key", "")).strip()
            phase_v = str(g.get("phase", "")).strip().upper()
            week_v = _to_int_or_none(g.get("week"))

            home_id = str(g.get("home_id", "")).strip().upper()
            away_id = str(g.get("away_id", "")).strip().upper()
            venue = str(g.get("venue", "")).strip().upper()

            opponent_id = away_id if home_id == tid else home_id
            opponent_name = name_map.get(opponent_id, opponent_id)

            # site from tid perspective
            if venue == "N":
                site = "NEUTRAL"
            else:
                site = "HOME" if home_id == tid else "AWAY"

            # team/opp scores from tid perspective
            if tid == ta:
                team_score = a
                opp_score = b
            else:
                team_score = b
                opp_score = a

            result = "W" if team_score > opp_score else ("L" if team_score < opp_score else "T")

            prefix = "@ " if site == "AWAY" else "vs "
            neutral_tag = " (N)" if site == "NEUTRAL" else ""
            display_result_short = f"{result} {team_score}\u2013{opp_score} {prefix}{opponent_name}{neutral_tag}"

            recent.append({
                "game_key": g.get("game_key"),
                "date_key": dk,
                "display_date": _display_date(dk) if dk else "",
                "phase": phase_v,
                "week": week_v,
                "site": site,
                "opponent_team_id": opponent_id,
                "opponent_name": opponent_name,
                "team_score": team_score,
                "opp_score": opp_score,
                "result": result,
                "display_result_short": display_result_short,
                "home_id": home_id,
                "home_name": name_map.get(home_id, home_id),
                "away_id": away_id,
                "away_name": name_map.get(away_id, away_id),
            })

        # Most recent first: season date order, then phase, then week
        recent_sorted = sorted(
            recent,
            key=lambda x: (
                _season_rank_from_date_key(x["date_key"]) if x["date_key"] else 999999,
                _phase_rank(x["phase"]),
                x["week"] if x["week"] is not None else 9999
            ),
            reverse=True
        )

        my_team_recent_3 = {
            "team_id": tid,
            "team_name": name_map.get(tid, tid),
            "games_returned": min(3, len(recent_sorted)),
            "games": recent_sorted[:3],
        }

            # ---- featured_games ----
    # League mode: prioritize LSL Poll (TOP25 > NEXT5), then tie-break by quality + soonest date.
    # Team mode: show that team's next 5 upcoming games (still useful as "featured" for my team).
    featured_games = {
        "mode": "team" if tid else "league",
        "team_id": tid,
        "team_name": name_map.get(tid, tid) if tid else None,
        "games_returned": 0,
        "games": []
    }

    # Build LSL poll maps (latest week in Polls sheet)
    lsl_top25_rank = {}   # team_id -> 1..25
    lsl_next5_order = {}  # team_id -> 1..5 (not official rank)
    lsl_poll_week = None

    try:
        poll_rows = load_polls()
        if poll_rows:
            lsl_poll_week = max(r["week"] for r in poll_rows)
            lsl_rows = [r for r in poll_rows if r["week"] == lsl_poll_week and r["poll"] == "LSL"]
            for r in lsl_rows:
                t = str(r["team_id"]).strip().upper()
                if r["bucket"] == "TOP25":
                    lsl_top25_rank[t] = int(r["bucket_order"])
                elif r["bucket"] == "NEXT5":
                    lsl_next5_order[t] = int(r["bucket_order"])
    except Exception:
        # Polls optional: fall back to non-poll logic if something goes wrong
        lsl_top25_rank, lsl_next5_order, lsl_poll_week = {}, {}, None

    def _poll_points(team_id: str) -> int:
        """
        Internal scoring only:
        - TOP25: rank 1 gets 25, rank 25 gets 1
        - NEXT5: order 1 gets 5, order 5 gets 1 (not an official rank)
        - unranked: 0
        """
        if team_id in lsl_top25_rank:
            return 26 - lsl_top25_rank[team_id]
        if team_id in lsl_next5_order:
            return 6 - lsl_next5_order[team_id]
        return 0

    # Win% map for tie-break quality scoring (played games only)
    wl = {}
    def _ensure_wl(t):
        if t not in wl:
            wl[t] = {"wins": 0, "losses": 0, "played": 0}

    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        a = g.get("a_score")
        b = g.get("b_score")
        if not ta or not tb:
            continue
        _ensure_wl(ta); _ensure_wl(tb)
        if a is None or b is None:
            continue
        wl[ta]["played"] += 1
        wl[tb]["played"] += 1
        if a > b:
            wl[ta]["wins"] += 1
            wl[tb]["losses"] += 1
        elif b > a:
            wl[tb]["wins"] += 1
            wl[ta]["losses"] += 1

    winpct = {t: (r["wins"] / r["played"]) if r["played"] > 0 else 0.0 for t, r in wl.items()}

    def _quality(home_id: str, away_id: str) -> float:
        return round((winpct.get(home_id, 0.0) + winpct.get(away_id, 0.0)) / 2.0, 4)

    # Collect upcoming games pool (unplayed only)
    upcoming_pool = []
    for g in games:
        a = g.get("a_score")
        b = g.get("b_score")
        if (a is not None) and (b is not None):
            continue

        dk = str(g.get("date_key", "")).strip()
        if not dk:
            continue

        phase_v = str(g.get("phase", "")).strip().upper()
        if ph and phase_v != ph:
            continue

        home_id = str(g.get("home_id", "")).strip().upper()
        away_id = str(g.get("away_id", "")).strip().upper()
        venue = str(g.get("venue", "")).strip().upper()
        week_v = _to_int_or_none(g.get("week"))

        # team scope
        if tid:
            ta = str(g.get("team_a", "")).strip().upper()
            tb = str(g.get("team_b", "")).strip().upper()
            if tid not in (ta, tb):
                continue

            if venue == "N":
                site = "NEUTRAL"
            else:
                site = "HOME" if home_id == tid else "AWAY"
        else:
            site = "NEUTRAL" if venue == "N" else "HOME"

        upcoming_pool.append({
            "game_key": g.get("game_key"),
            "date_key": dk,
            "display_date": _display_date(dk),
            "phase": phase_v,
            "week": week_v,
            "venue": venue,
            "home_id": home_id,
            "home_name": name_map.get(home_id, home_id),
            "away_id": away_id,
            "away_name": name_map.get(away_id, away_id),
            "site": site,
            "quality": _quality(home_id, away_id),

            # LSL poll context (LSL only)
            "lsl_rank_home": lsl_top25_rank.get(home_id),
            "lsl_rank_away": lsl_top25_rank.get(away_id),
            "lsl_next5_home": lsl_next5_order.get(home_id),
            "lsl_next5_away": lsl_next5_order.get(away_id),
        })

    if tid:
        # Team mode: next 5 upcoming games by season date, then phase, then week
        upcoming_sorted = sorted(
            upcoming_pool,
            key=lambda x: (_season_rank_from_date_key(x["date_key"]), _phase_rank(x["phase"]), x["week"] if x["week"] is not None else 9999)
        )
        featured = upcoming_sorted[:5]
    else:
        # League mode: keep it "what's next" by focusing on earliest upcoming date(s),
        # but rank those games by LSL poll strength first.
        if upcoming_pool:
            day_ranks = sorted(set(_season_rank_from_date_key(x["date_key"]) for x in upcoming_pool))
            expanded = []
            i = 0
            while len(expanded) < 25 and i < len(day_ranks):  # expand a few days forward
                expanded.extend([x for x in upcoming_pool if _season_rank_from_date_key(x["date_key"]) == day_ranks[i]])
                i += 1

            featured = sorted(
                expanded,
                key=lambda x: (
                    -(_poll_points(x["home_id"]) + _poll_points(x["away_id"])),  # LSL poll first
                    -x["quality"],  # tie-break
                    _season_rank_from_date_key(x["date_key"]),
                    x["week"] if x["week"] is not None else 9999,
                    x["home_id"],
                    x["away_id"],
                )
            )[:5]
        else:
            featured = []

    featured_games["poll"] = "LSL"
    featured_games["poll_week"] = lsl_poll_week
    featured_games["games"] = featured
    featured_games["games_returned"] = len(featured)

    # ---- response ----
    status_block = {
        "ok": True,
        "refreshed_at": meta.get("refreshed_at") if meta else None,
        "games_count": meta.get("games_count") if meta else len(games),
        "summary": meta.get("summary") if meta else None,
    }

    return {
        "status": status_block,
        "filters": {"team_id": tid, "phase": ph},
        "team_summary_preview": team_summary_preview,
        "my_team_next_3": my_team_next_3,
        "my_team_recent_3": my_team_recent_3,
        "featured_games": featured_games,
        "calendar_preview": {
            "days_requested": days,
            "days_returned": len(calendar_preview),
            "days": calendar_preview,
        },
        "rankings_preview": {
            "type": "sos_lite",
            "top_n": top_n,
            "teams_returned": len(rankings_preview),
            "rankings": rankings_preview,
        },
        "links": {
            "status": "/status",
            "calendar": "/calendar",
            "rankings": "/rankings/sos-lite",
            "teams": "/teams",
            "refresh": "/refresh",
        },
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


@app.get("/calendar")
def calendar(
    team_id: Optional[str] = None,
    phase: Optional[str] = None,
    week: Optional[int] = None,
    played: Optional[bool] = None,
    limit_days: int = 30,
    offset_days: int = 0,
):
    """
    Calendar feed grouped by date_key (MMDD), optimized for mobile.
    Default: league-wide, all phases, includes played+unplayed.
    Filters: team_id, phase, week, played
    Pagination: limit_days, offset_days
    """
    games = _load_games_or_404()
    name_map = _team_name_map(active_only=False)

    # normalize filters
    tid = team_id.strip().upper() if team_id else None
    ph = phase.strip().upper() if phase else None
    wk = int(week) if week is not None else None

    # clamp day pagination
    try:
        limit_days = int(limit_days)
        offset_days = int(offset_days)
    except Exception:
        raise HTTPException(status_code=400, detail="limit_days and offset_days must be integers")

    limit_days = max(1, min(limit_days, 120))
    offset_days = max(0, offset_days)

    def _season_rank_from_date_key(dk: str) -> int:
        """
        Season-order rank for MMDD where season starts in November:
        Nov/Dec first, then Jan..Oct.
        Returns an integer that sorts correctly.
        """
        if not dk or len(dk) != 4 or not dk.isdigit():
            return 999999
        mm = int(dk[:2])
        dd = int(dk[2:])
        mm_rank = mm + 12 if mm <= 10 else mm  # Jan-Oct pushed after Nov-Dec
        return mm_rank * 100 + dd

    def _display_date(dk: str) -> str:
        if dk and len(dk) == 4 and dk.isdigit():
            return f"{dk[:2]}/{dk[2:]}"
        return ""

    # filter games first
    filtered = []
    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        g_phase = str(g.get("phase", "")).strip().upper()
        g_week = _to_int_or_none(g.get("week"))

        a = g.get("a_score")
        b = g.get("b_score")
        g_played = (a is not None) and (b is not None)

        dk = str(g.get("date_key", "")).strip()

        if tid and tid not in (ta, tb):
            continue
        if ph and g_phase != ph:
            continue
        if wk is not None and g_week != wk:
            continue
        if played is not None and g_played != bool(played):
            continue

        # If date_key is missing, we skip it for calendar view (calendar is date-based)
        if not dk:
            continue

        filtered.append(g)

    # group by date_key
    buckets = {}
    for g in filtered:
        dk = str(g.get("date_key", "")).strip()
        buckets.setdefault(dk, []).append(g)

    # sort date buckets in season order
    date_keys_sorted = sorted(buckets.keys(), key=_season_rank_from_date_key)

    # day pagination
    date_keys_page = date_keys_sorted[offset_days: offset_days + limit_days]

    # build day cards
    days = []
    for dk in date_keys_page:
        games_for_day = buckets.get(dk, [])

        # sort games within a day: phase rank -> week -> home/away
        def _phase_rank(p: str) -> int:
            return {"REG_SEASON": 1, "CONF_TOURNEY": 2, "NAT_TOURNEY": 3}.get(p, 9)

        def _game_sort_key(g):
            gp = str(g.get("phase", "")).strip().upper()
            gw = _to_int_or_none(g.get("week"))
            gw = gw if gw is not None else 9999
            home_id = str(g.get("home_id", "")).strip().upper()
            away_id = str(g.get("away_id", "")).strip().upper()
            return (_phase_rank(gp), gw, home_id, away_id)

        games_sorted = sorted(games_for_day, key=_game_sort_key)

        out_games = []
        for g in games_sorted:
            ta = str(g.get("team_a", "")).strip().upper()
            tb = str(g.get("team_b", "")).strip().upper()
            home_id = str(g.get("home_id", "")).strip().upper()
            away_id = str(g.get("away_id", "")).strip().upper()

            a = g.get("a_score")
            b = g.get("b_score")
            g_played = (a is not None) and (b is not None)

            out_games.append({
                "game_key": g.get("game_key"),
                "phase": str(g.get("phase", "")).strip().upper(),
                "week": _to_int_or_none(g.get("week")),
                "venue": g.get("venue"),
                "home_id": home_id,
                "home_name": name_map.get(home_id, home_id),
                "away_id": away_id,
                "away_name": name_map.get(away_id, away_id),
                "team_a": ta,
                "team_a_name": name_map.get(ta, ta),
                "team_b": tb,
                "team_b_name": name_map.get(tb, tb),
                "a_score": a,
                "b_score": b,
                "played": g_played,
            })

        days.append({
            "date_key": dk,
            "display_date": _display_date(dk),
            "season_rank": _season_rank_from_date_key(dk),
            "games_count": len(out_games),
            "games": out_games,
        })

    next_offset_days = offset_days + limit_days
    if next_offset_days >= len(date_keys_sorted):
        next_offset_days = None

    prev_offset_days = offset_days - limit_days
    if prev_offset_days < 0:
        prev_offset_days = None

    return {
        "count_days": len(days),
        "total_days": len(date_keys_sorted),
        "limit_days": limit_days,
        "offset_days": offset_days,
        "next_offset_days": next_offset_days,
        "prev_offset_days": prev_offset_days,
        "filters": {
            "team_id": tid,
            "phase": ph,
            "week": wk,
            "played": played,
        },
        "days": days,
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