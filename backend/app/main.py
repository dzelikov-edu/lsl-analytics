from dotenv import load_dotenv
import pathlib, os
load_dotenv(pathlib.Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, HTTPException, Request, Response, BackgroundTasks
from starlette.middleware.base import BaseHTTPMiddleware
from app.ingest import (
    load_teams_index,
    ingest_preview_for_one_team,
    ingest_league,
    load_polls,
    load_preseason_power,
    load_players_snapshot,
    load_conference_membership,
    load_conferences_map,
    load_records_snapshot,
    load_conf_games_snapshot,
    load_week_phase_map,
)

import json
import os
from fastapi.middleware.cors import CORSMiddleware
import threading

from fastapi_limiter import FastAPILimiter
import redis.asyncio as redis  # New import for async Redis

from datetime import datetime
from typing import Optional
from fastapi.responses import JSONResponse
from functools import lru_cache

from app.db import init_db, engine
from app.db import AsyncSessionLocal
from app.models_devices import Game
from sqlmodel import select, or_  # Ensure or_ is here
from sqlalchemy import text # Add this to your sqlalchemy/sqlmodel imports
from app.ingest import save_games_to_db


from app.routers.devices_favorites import router as devices_favorites_router
from app.routers.auth import router as auth_router
from app.routers.admin import router as admin_router

GLOBAL_GAMES_LIST = []

app = FastAPI(title="LSL Analytics Backend")

@app.on_event("startup")
async def startup():
    global GLOBAL_GAMES_LIST
    print("Pre-loading games into global cache...")
    try:
        GLOBAL_GAMES_LIST = await _load_games_from_db()
        print(f"V1 core caches warmed from Postgres. Count: {len(GLOBAL_GAMES_LIST)}")
    except Exception as e:
        print(f"Failed to warm games cache: {e}")
        GLOBAL_GAMES_LIST = []
    # 1. Initialize the Cloud Database Tables
    try:
        # This creates your Users, Devices, and Favorites tables in Postgres
        await init_db()
        print("Database tables verified/created.")
    except Exception as e:
        print(f"Database init failed: {e}")

    # 2. Initialize Redis for Rate Limiting
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        # Use the 'redis' alias you imported at the top
        redis_client = redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        await FastAPILimiter.init(redis_client)
        print("Redis limiter initialized.")
    except Exception as e:
        print(f"Redis init failed: {e}")



@app.on_event("shutdown") 
async def shutdown():
    await FastAPILimiter.close()


# CORS: allow localhost by default; add more origins via env var CORS_EXTRA_ORIGINS
ALLOWED_ORIGINS = [
    "http://localhost:19006",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
print("CORS allowed origins:", ALLOWED_ORIGINS)

extra = os.getenv("CORS_EXTRA_ORIGINS")
if extra:
    ALLOWED_ORIGINS += [o.strip() for o in extra.split(",") if o.strip()]

class LimitUploadSize(BaseHTTPMiddleware):
    def __init__(self, app, max_upload_size: int) -> None:
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" or request.method == "PUT":
            content_length = request.headers.get("content-length")
            if content_length:
                if int(content_length) > self.max_upload_size:
                    return Response(content=b"Request body too large", status_code=413)
        return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(LimitUploadSize, max_upload_size=1_000_000) # 1MB limit


app.include_router(auth_router)
app.include_router(devices_favorites_router)
app.include_router(admin_router)


@app.on_event("startup")
async def _warm_v1_caches():
    try:
        # 1. Check if the Database actually has data before trying to warm
        async with AsyncSessionLocal() as session:
            statement = select(Game).limit(1)
            results = await session.exec(statement)
            has_data = results.first()
            
        if not has_data:
            print("V1 Cache warm skipped: Database is empty. Please run POST /refresh.")
            return

        # 2. Warm metadata caches (Teams, Conferences, Polls)
        # These usually pull from Sheets or are independent of the games file
        _cached_teams_index()
        _cached_team_name_map_all()
        _cached_conference_membership()
        _cached_conferences_map()
        _cached_records_snapshot()
        _cached_polls()
        _cached_week_phase_map()

        # 3. Warm analytics (wrapped in try/except)
        # These might still look for 'games.json'. By wrapping them,
        # we prevent the whole app from crashing if they can't find the file.
        try:
            _cached_preseason_power()
            _home_analytics_preview(0)
            _cached_analytics_overview(0)
            print("V1 Analytics caches warmed.")
        except Exception as analytics_err:
            print(f"Analytics warming deferred: {analytics_err}")

        print("V1 core caches warmed from Postgres.")
    except Exception as e:
        print(f"Cache warm skipped/failed: {e}")


@lru_cache(maxsize=1)
def _cached_teams_index():
    return load_teams_index()

@lru_cache(maxsize=1)
def _cached_players_snapshot():
    return load_players_snapshot()

@lru_cache(maxsize=1)
def _cached_conference_membership():
    return load_conference_membership()

@lru_cache(maxsize=1)
def _cached_conferences_map():
    return load_conferences_map()

@lru_cache(maxsize=1)
def _cached_polls():
    return load_polls()

@lru_cache(maxsize=1)
def _cached_week_phase_map():
    return load_week_phase_map()

@lru_cache(maxsize=256)
def _cached_team_analytics_summary(team_id: str, week: int = 0):
    tid = str(team_id).strip().upper()
    return _team_analytics_summary(tid, week)

@lru_cache(maxsize=1)
def _cached_team_name_map_all():
    return _team_name_map(active_only=False)

@lru_cache(maxsize=1)
def _cached_records_snapshot():
    return load_records_snapshot()

@lru_cache(maxsize=1)
def _cached_game_preview_support():
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    teams = _cached_teams_index()
    players = _cached_players_snapshot()
    team_conf_map = _cached_conference_membership()
    conf_names = _cached_conferences_map()
    polls_rows = _cached_polls()

    # ---- basic maps ----
    games_by_key = {
        str(g.get("game_key", "")).strip(): g
        for g in games
        if str(g.get("game_key", "")).strip()
    }

    team_index_map = {
        str(t.team_id).strip().upper(): t
        for t in teams
    }

    players_by_team = {}
    for p in players:
        tid = str(p.get("team_id", "")).strip().upper()
        if not tid:
            continue
        players_by_team.setdefault(tid, []).append(p)

    # ---- latest polls by team ----
    polls_block_by_team = {}
    try:
        if polls_rows:
            weeks = sorted({r["week"] for r in polls_rows})
            w = weeks[-1]

            by_team = {}
            for r in polls_rows:
                if r["week"] != w:
                    continue

                tid = str(r["team_id"]).strip().upper()
                poll_name = str(r["poll"]).strip().upper()

                if tid not in by_team:
                    by_team[tid] = {
                        "week": w,
                        "LSL": {"rank": None, "next5_order": None},
                        "LCAA": {"rank": None, "next5_order": None},
                    }

                if poll_name not in ("LSL", "LCAA"):
                    continue

                if r["bucket"] == "TOP25":
                    by_team[tid][poll_name]["rank"] = int(r["bucket_order"])
                    by_team[tid][poll_name]["next5_order"] = None
                elif r["bucket"] == "NEXT5":
                    by_team[tid][poll_name]["rank"] = None
                    by_team[tid][poll_name]["next5_order"] = int(r["bucket_order"])

            polls_block_by_team = by_team
    except Exception:
        polls_block_by_team = {}

    # ---- precompute team records in one pass over played games ----
    record_counts = {}

    def ensure_team_record(tid: str):
        if tid not in record_counts:
            record_counts[tid] = {
                "overall_w": 0,
                "overall_l": 0,
                "conf_w": 0,
                "conf_l": 0,
            }

    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()

        if not ta or not tb:
            continue

        a_score = g.get("a_score")
        b_score = g.get("b_score")
        if a_score is None or b_score is None:
            continue

        ensure_team_record(ta)
        ensure_team_record(tb)

        ta_conf = team_conf_map.get(ta)
        tb_conf = team_conf_map.get(tb)
        is_conf_game = ta_conf and tb_conf and ta_conf == tb_conf

        if a_score > b_score:
            record_counts[ta]["overall_w"] += 1
            record_counts[tb]["overall_l"] += 1
            if is_conf_game:
                record_counts[ta]["conf_w"] += 1
                record_counts[tb]["conf_l"] += 1
        elif a_score < b_score:
            record_counts[tb]["overall_w"] += 1
            record_counts[ta]["overall_l"] += 1
            if is_conf_game:
                record_counts[tb]["conf_w"] += 1
                record_counts[ta]["conf_l"] += 1

    records_by_team = {}
    all_team_ids = set(team_index_map.keys()) | set(team_conf_map.keys()) | set(players_by_team.keys())
    for tid in all_team_ids:
        counts = record_counts.get(
            tid,
            {"overall_w": 0, "overall_l": 0, "conf_w": 0, "conf_l": 0},
        )
        records_by_team[tid] = {
            "overall_record": f'{counts["overall_w"]}-{counts["overall_l"]}',
            "conference_record": f'{counts["conf_w"]}-{counts["conf_l"]}',
        }

    # ---- precompute leaders by team ----
    leaders_by_team = {}

    for tid, team_players in players_by_team.items():
        leaders_by_team[tid] = {}

        for stat_key in ("ppg", "rpg", "apg", "spg"):
            best = None
            best_value = None

            for p in team_players:
                value = p.get(stat_key)
                if value is None:
                    continue
                try:
                    numeric = float(value)
                except Exception:
                    continue

                if best is None or numeric > best_value:
                    best = p
                    best_value = numeric

            if best is None:
                leaders_by_team[tid][stat_key] = None
            else:
                leaders_by_team[tid][stat_key] = {
                    "player_id": best.get("player_id"),
                    "player_name": best.get("player_name"),
                    "jersey_number": best.get("jersey_number"),
                    "primary_position": best.get("primary_position"),
                    "value": best_value,
                }

    return {
        "games_by_key": games_by_key,
        "team_index_map": team_index_map,
        "players_by_team": players_by_team,
        "team_conf_map": team_conf_map,
        "conf_names": conf_names,
        "polls_block_by_team": polls_block_by_team,
        "records_by_team": records_by_team,
        "leaders_by_team": leaders_by_team,
    }

@lru_cache(maxsize=16)
def _has_played_games_through_week(week: int | None = None) -> bool:
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    w = 0 if week is None else week
    
    for g in games:
        gw = _to_int_or_none(g.get("week"))
        if gw is None or gw > w:
            continue

        if g.get("a_score") is not None and g.get("b_score") is not None:
            return True
    
    return False

@lru_cache(maxsize=1)
def _cached_preseason_power():
    return load_preseason_power()

@lru_cache(maxsize=16)
def _cached_analytics_power_payload(week: int | None = None):
    w = 0 if week is None else week

    rows = _cached_preseason_power()
    if not rows:
        return {
            "week": w,
            "metric": "power",
            "meta": {
                "title": "LSL Power",
                "subtitle": "Who would be favored on a neutral floor today",
                "source": "PreseasonPower",
                "source_detail": "week_0_preseason_only",
                "status": "no_data",
            },
            "count": 0,
            "items": [],
        }

    subset = [r for r in rows if r["week"] == w]

    if not subset:
        return {
            "week": w,
            "metric": "power",
            "meta": {
                "title": "LSL Power",
                "subtitle": "Who would be favored on a neutral floor today",
                "source": "PreseasonPower",
                "source_detail": "week_0_preseason_only",
                "status": "week_not_available",
            },
            "count": 0,
            "items": [],
        }

    name_map = _cached_team_name_map_all()
    record_map = _analytics_record_map(w)
    polls_map = _analytics_polls_map(w)

    ranked = sorted(
        subset,
        key=lambda x: (-x["power_value"], name_map.get(x["team_id"], x["team_id"]))
    )

    items = []
    for idx, row in enumerate(ranked, start=1):
        tid = row["team_id"]
        base = _analytics_base_row(
            team_id=tid,
            team_name=name_map.get(tid, tid),
            value=row["power_value"],
            rank=idx,
            week=w,
            tier=_power_tier_from_rank(idx),
            trend="flat",
            record_map=record_map,
            polls_map=polls_map,
        )

        base["power"] = {
            "source": "preseason",
            "notes": row.get("notes", ""),
        }

        items.append(base)

    return {
        "week": w,
        "metric": "power",
        "meta": {
            "title": "LSL Power",
            "subtitle": "Who would be favored on a neutral floor today",
            "source": "PreseasonPower",
            "source_detail": "week_0_preseason_only",
            "status": "ok",
        },
        "count": len(items),
        "items": items,
    }

@lru_cache(maxsize=1)
def _cached_team_conf_map_merged():
    team_conf_map = dict(_cached_conference_membership())

    for t in _cached_teams_index():
        conf = getattr(t, "conference", None)
        if conf:
            team_conf_map.setdefault(
                str(t.team_id).strip().upper(),
                str(conf).strip().upper(),
            )

    return team_conf_map

@lru_cache(maxsize=32)
def _cached_team_record_map(week: int | None = None):
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    team_conf_map = _cached_team_conf_map_merged()

    counts = {}

    def ensure(tid: str):
        if tid not in counts:
            counts[tid] = {
                "overall_wins": 0,
                "overall_losses": 0,
                "conference_wins": 0,
                "conference_losses": 0,
            }

    for g in games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()

        if not ta or not tb:
            continue

        game_week = _to_int_or_none(g.get("week"))
        if week is not None and game_week is not None and game_week > week:
            continue

        a_score = g.get("a_score")
        b_score = g.get("b_score")
        played = (a_score is not None) and (b_score is not None)
        if not played:
            continue

        ensure(ta)
        ensure(tb)

        ta_conf = team_conf_map.get(ta)
        tb_conf = team_conf_map.get(tb)
        is_conf_game = ta_conf and tb_conf and ta_conf == tb_conf

        if a_score > b_score:
            counts[ta]["overall_wins"] += 1
            counts[tb]["overall_losses"] += 1
            if is_conf_game:
                counts[ta]["conference_wins"] += 1
                counts[tb]["conference_losses"] += 1
        elif b_score > a_score:
            counts[tb]["overall_wins"] += 1
            counts[ta]["overall_losses"] += 1
            if is_conf_game:
                counts[tb]["conference_wins"] += 1
                counts[ta]["conference_losses"] += 1

    out = {}
    for tid, c in counts.items():
        out[tid] = {
            "overall_wins": c["overall_wins"],
            "overall_losses": c["overall_losses"],
            "overall_record": f'{c["overall_wins"]}-{c["overall_losses"]}',
            "conference_wins": c["conference_wins"],
            "conference_losses": c["conference_losses"],
            "conference_record": f'{c["conference_wins"]}-{c["conference_losses"]}',
        }

    return out

@lru_cache(maxsize=1)
def _cached_tracked_team_ids():
    return {
        t.team_id.strip().upper()
        for t in _cached_teams_index()
        if t.active
    }

@lru_cache(maxsize=1)
def _cached_conf_games_snapshot():
    return load_conf_games_snapshot()


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
def teams(week: int | None = None):
    """
    List teams (from TeamsIndex), plus LSL poll badge (latest poll week) for mobile list simplicity.
    """
    teams = _cached_teams_index()
    active = [t for t in teams if t.active]

    # ---- LSL poll badge maps (latest week) ----
    lsl_top25_rank = {}   # team_id -> 1..25
    lsl_next5_order = {}  # team_id -> 1..5 (display-only; not an official rank)
    poll_week = None

    try:
        rows = _cached_polls()
        if rows:
            available_weeks = sorted({r["week"] for r in rows})
            poll_week = week if week is not None else available_weeks[-1]

            if poll_week not in available_weeks:
                raise HTTPException(status_code=404, detail=f"Poll week {poll_week} not found")

            lsl_rows = [r for r in rows if r["week"] == poll_week and r["poll"] == "LSL"]
            for r in lsl_rows:
                tid = str(r["team_id"]).strip().upper()
                if r["bucket"] == "TOP25":
                    lsl_top25_rank[tid] = int(r["bucket_order"])
                elif r["bucket"] == "NEXT5":
                    lsl_next5_order[tid] = int(r["bucket_order"])
    except Exception:
        # polls are optional; if anything fails, we just return null badges
        lsl_top25_rank, lsl_next5_order, poll_week = {}, {}, None

    analytics_map = _team_list_analytics_map(week)

    # Build response
    out = []
    for t in active:
        tid = t.team_id.strip().upper()
        out.append({
            "team_id": tid,
            "team_name": t.team_name,
            "sheet_id": t.sheet_id,
            "export_tab": t.export_tab,
            "polls": {
                "week": poll_week,
                "LSL": {
                    "rank": lsl_top25_rank.get(tid),             # 1..25 or None
                    "next5_order": lsl_next5_order.get(tid),     # 1..5 or None
                }
            },
            "analytics": analytics_map.get(tid, {
                "power": None,
                "resume": None,
                "form": None,
                "sos": None,
            }),
        })

    # Sort list so ranked teams appear first, then alphabetical
    def _sort_key(x):
        rank = x["polls"]["LSL"]["rank"]
        next5 = x["polls"]["LSL"]["next5_order"]
        # ranked first (rank asc), then next5 (order asc), then name
        if rank is not None:
            return (0, rank, 999, x["team_name"])
        if next5 is not None:
            return (1, 999, next5, x["team_name"])
        return (2, 999, 999, x["team_name"])

    out_sorted = sorted(out, key=_sort_key)

    return {
        "teams_total": len(teams),
        "teams_active": len(active),
        "poll_week": poll_week,
        "teams": out_sorted
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


def _team_analytics_summary(team_id: str, week: int | None = None) -> dict:
    tid = str(team_id).strip().upper()
    w = 0 if week is None else week

    summary = {
        "power": None,
        "resume": None,
        "form": None,
        "sos": None,
    }

    # Power: real preseason week-0 data exists now
    try:
        power_resp = analytics_power(w)
        for item in power_resp.get("items", []):
            if item.get("team_id") == tid:
                summary["power"] = {
                    "rank": item.get("rank"),
                    "value": item.get("value"),
                    "tier": item.get("tier"),
                }
                break
    except Exception:
        pass

    # Preseason week 0: only Power has real value right now.
    # Skip Resume / Form / SOS entirely until in-season data
    if not _has_played_games_through_week(w):
        return summary

    # Resume / Form / SOS: keep additive and honest
    # Only populate if the route has real items and this team is present
    try:
        resume_resp = analytics_resume(w)
        for item in resume_resp.get("items", []):
            if item.get("team_id") == tid:
                summary["resume"] = {
                    "rank": item.get("rank"),
                    "value": item.get("value"),
                    "tier": item.get("tier"),
                }
                break
    except Exception:
        pass

    try:
        form_resp = analytics_form(w)
        for item in form_resp.get("items", []):
            if item.get("team_id") == tid:
                summary["form"] = {
                    "rank": item.get("rank"),
                    "value": item.get("value"),
                    "tier": item.get("tier"),
                }
                break
    except Exception:
        pass

    try:
        sos_resp = analytics_sos(w)
        for item in sos_resp.get("items", []):
            if item.get("team_id") == tid:
                summary["sos"] = {
                    "rank": item.get("rank"),
                    "value": item.get("value"),
                    "tier": item.get("tier"),
                }
                break
    except Exception:
        pass

    return summary


def _team_roster_count(team_id: str) -> int:
    tid = str(team_id).strip().upper()
    try:
        rows = load_players_snapshot()
        return sum(1 for r in rows if str(r.get("team_id", "")).strip().upper() == tid)
    except Exception:
        return 0
    

def _phase_display_name(
    phase: str | None,
    week: int | None = None,
    phase_map: dict[int, dict] | None = None,
) -> str | None:
    if not phase:
        return None

    phase_norm = str(phase).strip().upper()
    pm = phase_map or {}

    if week is not None:
        row = pm.get(week)
        if row and str(row.get("phase", "")).strip().upper() == phase_norm:
            return row.get("phase_display_name") or phase_norm

    for row in pm.values():
        if str(row.get("phase", "")).strip().upper() == phase_norm:
            return row.get("phase_display_name") or phase_norm

    fallback = {
        "REG_SEASON": "Regular Season",
        "CONF_TOURNEY": "Conference Tournament",
        "NAT_TOURNEY": "National Tournament",
    }
    return fallback.get(phase_norm, phase_norm.replace("_", " ").title())


def _format_date_key_mmdd(date_key) -> str | None:
    if date_key is None:
        return None

    s = str(date_key).strip()
    if len(s) != 4 or not s.isdigit():
        return s or None

    return f"{s[:2]}/{s[2:]}"


@lru_cache(maxsize=1)
def _load_lsl_polls_grouped_by_week() -> dict[int, list[dict]]:
    grouped: dict[int, list[dict]] = {}
    try:
        poll_rows = _cached_polls()
        for r in poll_rows or []:
            if str(r.get("poll", "")).strip().upper() != "LSL":
                continue

            week = r.get("week")
            if week is None:
                continue

            try:
                week_int = int(week)
            except Exception:
                continue

            grouped.setdefault(week_int, []).append(r)
    except Exception:
        return {}

    return grouped


def _latest_poll_week_at_or_before(target_week: int | None, grouped_polls: dict[int, list[dict]]) -> int | None:
    if target_week is None or not grouped_polls:
        return None

    eligible_weeks = [w for w in grouped_polls.keys() if w <= target_week]
    if not eligible_weeks:
        return None

    return max(eligible_weeks)


def _lsl_rank_context_for_team_at_week(
    team_id: str | None,
    target_week: int | None,
    grouped_polls: dict[int, list[dict]],
) -> dict:
    tid = str(team_id or "").strip().upper()
    if not tid:
        return {
            "poll_week": None,
            "rank": None,
            "next5_order": None,
        }

    poll_week = _latest_poll_week_at_or_before(target_week, grouped_polls)
    if poll_week is None:
        return {
            "poll_week": None,
            "rank": None,
            "next5_order": None,
        }

    rows = grouped_polls.get(poll_week, [])
    rank = None
    next5_order = None

    for r in rows:
        row_tid = str(r.get("team_id", "")).strip().upper()
        if row_tid != tid:
            continue

        bucket = str(r.get("bucket", "")).strip().upper()
        bucket_order = r.get("bucket_order")

        try:
            bucket_order_int = int(bucket_order)
        except Exception:
            bucket_order_int = None

        if bucket == "TOP25":
            rank = bucket_order_int
        elif bucket == "NEXT5":
            next5_order = bucket_order_int

    return {
        "poll_week": poll_week,
        "rank": rank,
        "next5_order": next5_order,
    }


@lru_cache(maxsize=16)
def _team_list_analytics_map(week: int | None = None) -> dict[str, dict]:
    w = 0 if week is None else week

    out: dict[str, dict] = {}

    def ensure_team(tid: str):
        tid = str(tid).strip().upper()
        if tid not in out:
            out[tid] = {
                "power": None,
                "resume": None,
                "form": None,
                "sos": None,
            }

    try:
        power_resp = analytics_power(w)
        for item in power_resp.get("items", []):
            tid = str(item.get("team_id", "")).strip().upper()
            if not tid:
                continue
            ensure_team(tid)
            out[tid]["power"] = {
                "rank": item.get("rank"),
                "value": item.get("value"),
                "tier": item.get("tier"),
            }
    except Exception:
        pass

    # Preseason / no played results yet:
    # only Power is meaningful, so skip Resume/Form/SOS entirely.
    if not _has_played_games_through_week(w):
        return out

    try:
        resume_resp = analytics_resume(w)
        for item in resume_resp.get("items", []):
            tid = str(item.get("team_id", "")).strip().upper()
            if not tid:
                continue
            ensure_team(tid)
            out[tid]["resume"] = {
                "rank": item.get("rank"),
                "value": item.get("value"),
                "tier": item.get("tier"),
            }
    except Exception:
        pass

    try:
        form_resp = analytics_form(w)
        for item in form_resp.get("items", []):
            tid = str(item.get("team_id", "")).strip().upper()
            if not tid:
                continue
            ensure_team(tid)
            out[tid]["form"] = {
                "rank": item.get("rank"),
                "value": item.get("value"),
                "tier": item.get("tier"),
            }
    except Exception:
        pass

    try:
        sos_resp = analytics_sos(w)
        for item in sos_resp.get("items", []):
            tid = str(item.get("team_id", "")).strip().upper()
            if not tid:
                continue
            ensure_team(tid)
            out[tid]["sos"] = {
                "rank": item.get("rank"),
                "value": item.get("value"),
                "tier": item.get("tier"),
            }
    except Exception:
        pass

    return out


@app.get("/teams/{team_id}")
def get_team(team_id: str, week: int | None = None):
    """
    Team card (from TeamsIndex) + useful links + poll badges (LSL primary, LCAA secondary).
    If week not provided, uses latest poll week present in Polls sheet.
    Also includes overall and conference records from played games through the selected week.
    """
    tid = team_id.strip().upper()
    teams = _cached_teams_index()

    match = next((t for t in teams if t.team_id.strip().upper() == tid), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Unknown team_id: {tid}")

    name_map = _cached_team_name_map_all()
    team_conf_map = _cached_team_conf_map_merged()

    team_conf = team_conf_map.get(tid)
    conf_names = _cached_conferences_map()
    team_conf_name = conf_names.get(team_conf) if team_conf else None

    # ---- poll badge lookup ----
    polls_block = {
        "week": None,
        "LSL": {"rank": None, "next5_order": None},
        "LCAA": {"rank": None, "next5_order": None},
    }

    selected_week = week

    try:
        rows = _cached_polls()
        if rows:
            weeks = sorted({r["week"] for r in rows})
            w = week if week is not None else weeks[-1]
            selected_week = w
            polls_block["week"] = w

            def find_badge(poll_name: str):
                subset = [r for r in rows if r["week"] == w and r["poll"] == poll_name]
                for r in subset:
                    if r["team_id"] != tid:
                        continue
                    if r["bucket"] == "TOP25":
                        return {"rank": int(r["bucket_order"]), "next5_order": None}
                    if r["bucket"] == "NEXT5":
                        return {"rank": None, "next5_order": int(r["bucket_order"])}
                return {"rank": None, "next5_order": None}

            polls_block["LSL"] = find_badge("LSL")
            polls_block["LCAA"] = find_badge("LCAA")

    except Exception:
        # Polls optional; keep nulls if anything goes wrong
        pass

    # ---- record lookup from cached record map ----
    record_block = {
        "overall_wins": 0,
        "overall_losses": 0,
        "overall_record": "0-0",
        "conference_wins": 0,
        "conference_losses": 0,
        "conference_record": "0-0",
    }

    try:
        record_block = _cached_team_record_map(selected_week).get(tid, record_block)
    except Exception:
        pass

    # ---- conference standing calculation (Tie-Aware & Full Conference) ----
    conf_rank = None
    is_tied = False
    if team_conf:
        try:
            all_records = _cached_team_record_map(selected_week)
            
            # 1. Include EVERY team in the conference from the master map
            conf_team_ids = [t_id for t_id, c_id in team_conf_map.items() if c_id == team_conf]
            
            conf_standings = []
            for t_id in conf_team_ids:
                rec = all_records.get(t_id, {"conference_wins": 0, "conference_losses": 0})
                conf_standings.append({
                    "id": t_id, 
                    "w": rec.get("conference_wins", 0), 
                    "l": rec.get("conference_losses", 0)
                })
            
            # 2. Sort: wins desc, losses asc
            conf_standings.sort(key=lambda x: (-x["w"], x["l"]))
            
            # 3. Assign Ranks with Tie Handling
            current_rank = 1
            for i, entry in enumerate(conf_standings):
                # If not the first team, check if record matches the previous team
                if i > 0:
                    prev = conf_standings[i-1]
                    if entry["w"] != prev["w"] or entry["l"] != prev["l"]:
                        # Records are different, rank becomes current position
                        current_rank = i + 1
                
                if entry["id"] == tid:
                    conf_rank = current_rank
                    # 4. Check if others share this same rank
                    # (Simplified: if neighbors have same record, it's a tie)
                    match_count = sum(1 for x in conf_standings if x["w"] == entry["w"] and x["l"] == entry["l"])
                    is_tied = match_count > 1
                    break
        except Exception:
            pass

    # ---- form calculation (last 5 games, W/L only) ----
    form_results = []
    try:
        # 1. Filter global cache for played games involving this team
        played_games = [
            g for g in GLOBAL_GAMES_LIST
            if (g.get("team_a") == tid or g.get("team_b") == tid)
            and g.get("a_score") is not None
            and g.get("b_score") is not None
        ]

        # 2. Sort by date_key (newest first)
        played_games.sort(key=lambda x: str(x.get("date_key", "0000")), reverse=True)

        # 3. Take last 5 and assign W/L
        for g in played_games[:5]:
            ta = g.get("team_a")
            ascore = g.get("a_score")
            bscore = g.get("b_score")

            if tid == ta:
                res = "W" if ascore > bscore else "L"
            else:
                res = "W" if bscore > ascore else "L"

            form_results.append(res)

    except Exception:
        pass

    return {
        "team_id": tid,
        "team_name": match.team_name,
        "active": match.active,
        "conference_id": team_conf,
        "conference_name": team_conf_name,
        "conference_rank": conf_rank,
        "conference_is_tied": is_tied,
        "form": form_results,

        # ESPN-style poll badges (LSL primary, LCAA secondary)
        "polls": polls_block,

        "record": record_block,

        "analytics": _team_analytics_summary(tid, week),

        "roster_summary": {
            "players_count": _team_roster_count(tid),
        },

        "links": {
            "schedule": f"/teams/{tid}/schedule",
            "summary": f"/teams/{tid}/summary",
            "results": f"/teams/{tid}/results",
            "upcoming": f"/teams/{tid}/upcoming",
            "roster": f"/teams/{tid}/roster",
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
async def refresh_league(background_tasks: BackgroundTasks):
    """
    Pulls team data from Google Sheets and saves it permanently to the Postgres Database.
    Runs as a background task to prevent timeouts.
    """
    if not _try_acquire_refresh_lock():
        return JSONResponse(
            status_code=409,
            content={"ok": False, "detail": "Refresh already running. Try again in a moment."}
        )

    async def run_ingest():
        try:
            print("Starting background ingest...")
            teams = load_teams_index()
            result = await ingest_league(teams)
            games_by_key = result["games_by_key"]
            
            # Save the results to the permanent Postgres Database
            await save_games_to_db(games_by_key)

            # --- SURGERY: Update the RAM Cache in real-time ---
            global GLOBAL_GAMES_LIST
            GLOBAL_GAMES_LIST = await _load_games_from_db()

            # IMPORTANT: Clear the LRU caches so they rebuild with the new RAM data
            _cached_team_record_map.cache_clear()
            _has_played_games_through_week.cache_clear()
            # --------------------------------------------------
            
            print(f"Background ingest complete. {len(games_by_key)} games are now permanent in DB.")
        except Exception as e:
            print(f"Background ingest failed: {e}")
        finally:
            _release_refresh_lock()

    # This tells FastAPI to start the work and return the response below immediately
    background_tasks.add_task(run_ingest)

    return {
        "ok": True, 
        "detail": "Ingest started in background. Data will appear on iPad shortly. Watch Render logs for progress."
    }



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

    rows = _cached_polls()
    if not rows:
        raise HTTPException(status_code=404, detail="No poll data found. Fill Polls tab first.")

    w = week if week is not None else _latest_poll_week(rows)
    if w is None:
        raise HTTPException(status_code=404, detail="No poll weeks found in Polls tab.")

    name_map = _team_name_map(active_only=False)
    return _poll_payload(rows, w, poll_u, name_map)


@app.get("/rankings/polls")
def rankings_polls(week: int | None = None):
    """
    ESPN-style poll rankings view:
    - LSL Poll first (AP equivalent)
    - LCAA Poll second (Coaches equivalent)
    Returns Top 25 + Next 5 Out for each.
    """
    rows = _cached_polls()
    if not rows:
        raise HTTPException(status_code=404, detail="No poll data found. Fill Polls tab first.")

    # Choose week: requested or latest available
    weeks = sorted({r["week"] for r in rows})
    w = week if week is not None else (weeks[-1] if weeks else None)
    if w is None:
        raise HTTPException(status_code=404, detail="No poll weeks found in Polls tab.")

    name_map = _team_name_map(active_only=False)

    # Reuse the same formatting as /polls does (Top25 has official rank; Next5 has order only)
    lsl = _poll_payload(rows, w, "LSL", name_map)
    lcaa = _poll_payload(rows, w, "LCAA", name_map)

    return {
        "meta": {
            "title_primary": "LSL Poll",
            "title_secondary": "LCAA Poll",
            "primary_is_main": True,
            "secondary_is_main": False,
            "note_next5": "Next 5 Out is not an official rank; order is display-only."
        },
        "week": w,
        "primary": lsl,     # LSL Poll (AP equivalent)
        "secondary": lcaa,  # LCAA Poll (Coaches equivalent)
    }


def _latest_records_week(rows: list[dict]) -> int | None:
    weeks = sorted({r["week"] for r in rows})
    return weeks[-1] if weeks else None


@lru_cache(maxsize=32)
def _build_poll_maps_for_week(poll: str, week: int | None = None):
    """
    Returns: (poll_week, top25_rank_map, next5_order_map)
      - top25_rank_map: team_id -> 1..25
      - next5_order_map: team_id -> 1..5 (display-only)
    Uses latest poll week if week is None.
    """
    poll_u = str(poll).strip().upper()
    if poll_u not in ("LSL", "LCAA"):
        return (week, {}, {})

    rows = _cached_polls()
    if not rows:
        return (None, {}, {})

    available_weeks = sorted({r["week"] for r in rows})
    poll_week = week if week is not None else available_weeks[-1]
    if poll_week not in available_weeks:
        return (poll_week, {}, {})

    poll_rows = [r for r in rows if r["week"] == poll_week and r["poll"] == poll_u]

    top25 = {}
    next5 = {}
    for r in poll_rows:
        tid = str(r["team_id"]).strip().upper()
        if r["bucket"] == "TOP25":
            top25[tid] = int(r["bucket_order"])
        elif r["bucket"] == "NEXT5":
            next5[tid] = int(r["bucket_order"])

    return (poll_week, top25, next5)


@app.get("/conferences")
def conferences(week: int | None = None):
    """
    List conferences with team counts + LSL Poll counts (Top 25 + Next 5 Out).
    Week is for RecordsSnapshot context only (optional).
    """
    membership = load_conference_membership()
    conf_names = load_conferences_map()
    records = load_records_snapshot()

    w = week if week is not None else _latest_records_week(records)

    # LSL poll maps (latest poll week by default)
    poll_week, lsl_top25_rank, lsl_next5_order = _build_poll_maps_for_week("LSL")

    # group team_ids by conference
    conf_to_teams: dict[str, list[str]] = {}
    for team_id, conf_id in membership.items():
        conf_to_teams.setdefault(conf_id, []).append(team_id)

    out = []
    for conf_id, team_ids in conf_to_teams.items():
        top25_ct = sum(1 for tid in team_ids if tid in lsl_top25_rank)
        next5_ct = sum(1 for tid in team_ids if tid in lsl_next5_order)

        out.append({
            "conference_id": conf_id,
            "conference_name": conf_names.get(conf_id, conf_id),
            "teams_count": len(team_ids),
            "week": w,
            "polls": {
                "LSL": {
                    "week": poll_week,
                    "top25_count": top25_ct,
                    "next5_count": next5_ct,
                }
            }
        })

    out_sorted = sorted(out, key=lambda x: (x["conference_name"], x["conference_id"]))
    return {"conferences_count": len(out_sorted), "conferences": out_sorted}


@app.get("/conferences/{conf_id}")
def conference_detail(conf_id: str, week: int | None = None, debug: bool = False):
    """
    Full conference membership + standings from RecordsSnapshot.
    Includes teams without sheets.
    """
    cid = conf_id.strip().upper()

    membership = _cached_conference_membership()
    conf_names = _cached_conferences_map()
    records = _cached_records_snapshot()

    if not records:
        raise HTTPException(status_code=404, detail="No RecordsSnapshot data found. Fill RecordsSnapshot first.")

    w = week if week is not None else _latest_records_week(records)
    if w is None:
        raise HTTPException(status_code=404, detail="No record weeks found in RecordsSnapshot.")

    # build team list for this conference
    members = [tid for tid, c in membership.items() if c == cid]
    if not members:
        raise HTTPException(status_code=404, detail=f"No teams found for conference: {cid}")

    # build records map for the week
    rec_map = {r["team_id"]: r for r in records if r["week"] == w}

    name_map = _cached_team_name_map_all()

    # Identify tracked teams (has sheet) for UX
    tracked = _cached_tracked_team_ids()

    lsl_poll_week, lsl_top25_rank, lsl_next5_order = _build_poll_maps_for_week("LSL", w)
    lcaa_poll_week, lcaa_top25_rank, lcaa_next5_order = _build_poll_maps_for_week("LCAA", w)

    conf_team_ids = set(members)

    lsl_top25_count = sum(1 for tid in conf_team_ids if tid in lsl_top25_rank)
    lsl_next5_count = sum(1 for tid in conf_team_ids if tid in lsl_next5_order)
    lcaa_top25_count = sum(1 for tid in conf_team_ids if tid in lcaa_top25_rank)
    lcaa_next5_count = sum(1 for tid in conf_team_ids if tid in lcaa_next5_order)

    standings = []
    missing = []
    for tid in sorted(members):
        r = rec_map.get(tid)
        if not r:
            missing.append(tid)
            continue

        wins = r["wins"]; losses = r["losses"]
        cw = r["conf_wins"]; cl = r["conf_losses"]

        standings.append({
            "team_id": tid,
            "team_name": name_map.get(tid, tid),
            "is_tracked": tid in tracked,
            "overall": {"wins": wins, "losses": losses},
            "conference": {"wins": cw, "losses": cl},
            "win_pct": round(wins / (wins + losses), 4) if (wins + losses) > 0 else 0.0,
            "conf_win_pct": round(cw / (cw + cl), 4) if (cw + cl) > 0 else 0.0,
            "last_updated": r.get("last_updated", ""),
            "polls": {
                "LSL": {
                    "week": lsl_poll_week,
                    "rank": lsl_top25_rank.get(tid),
                    "next5_order": lsl_next5_order.get(tid),
                    "is_ranked": tid in lsl_top25_rank,
                    "is_next5": tid in lsl_next5_order,
                },
                "LCAA": {
                    "week": lcaa_poll_week,
                    "rank": lcaa_top25_rank.get(tid),
                    "next5_order": lcaa_next5_order.get(tid),
                    "is_ranked": tid in lcaa_top25_rank,
                    "is_next5": tid in lcaa_next5_order,
                },
                "primary_display": (
                    f"#{lsl_top25_rank[tid]}"
                    if tid in lsl_top25_rank
                    else ("Next 5" if tid in lsl_next5_order else None)
                ),
            },
            "links": {
                "team": f"/teams/{tid}",
                "schedule": f"/teams/{tid}/schedule",
                "summary": f"/teams/{tid}/summary",
            } if tid in tracked else {},
        })

    # ---- Head-to-head tie-breakers (universal) ----
    # Only applied within tie groups that share the same (conf_wins, conf_losses).
    conf_games_all = _cached_conf_games_snapshot()
    conf_games = [
        g for g in conf_games_all
        if g["conference_id"] == cid and g["week"] <= w
    ]

    def _deterministic_key(x):
        return (
            -x["conf_win_pct"],
            -x["conference"]["wins"],
            x["conference"]["losses"],
            -x["win_pct"],
            -x["overall"]["wins"],
            x["overall"]["losses"],
            x["team_name"],
        )

    # Group by exact conference record (wins/losses) to form tie groups
    tie_groups = {}
    for row in standings:
        key = (row["conference"]["wins"], row["conference"]["losses"])
        tie_groups.setdefault(key, []).append(row)

        # Preserve within-group head-to-head ordering.
    # Order the conference-record groups themselves, but do not re-sort inside each group.
    ordered_group_keys = sorted(
        tie_groups.keys(),
        key=lambda k: (-k[0], k[1])  # conf wins desc, conf losses asc
    )

    resolved_sorted = []
    for group_key in ordered_group_keys:
        group = tie_groups[group_key]

        if len(group) == 1:
            resolved_sorted.extend(group)
            continue

        tied_ids = {t["team_id"] for t in group}
        h2h_w = {tid: 0 for tid in tied_ids}
        h2h_l = {tid: 0 for tid in tied_ids}

        h2h_games_found = False

        for g in conf_games:
            h = g["home_id"]
            a = g["away_id"]
            if h not in tied_ids or a not in tied_ids:
                continue
            
            h2h_games_found = True

            hs = g["home_score"]
            as_ = g["away_score"]

            if hs > as_:
                h2h_w[h] += 1
                h2h_l[a] += 1
            elif as_ > hs:
                h2h_w[a] += 1
                h2h_l[h] += 1

        def h2h_pct(tid):
            gp = h2h_w[tid] + h2h_l[tid]
            return (h2h_w[tid] / gp) if gp > 0 else 0.0

        group_sorted = sorted(
            group,
            key=lambda x: (
                -h2h_pct(x["team_id"]),
                -h2h_w[x["team_id"]],
                _deterministic_key(x),
            )
        )

        if debug and h2h_games_found:
            for x in group_sorted:
                tid2 = x["team_id"]
                x["tiebreak"] = {
                    "h2h_wins": h2h_w.get(tid2, 0),
                    "h2h_losses": h2h_l.get(tid2, 0),
                    "h2h_win_pct": round(h2h_pct(tid2), 4),
                }

        resolved_sorted.extend(group_sorted)

    return {
        "conference_id": cid,
        "conference_name": conf_names.get(cid, cid),
        "week": w,
        "teams_count": len(members),
        "standings_count": len(resolved_sorted),
        "missing_records_count": len(missing),
        "missing_team_ids": missing[:50],
        "poll_summary": {
            "LSL": {
                "week": lsl_poll_week,
                "top25_count": lsl_top25_count,
                "next5_count": lsl_next5_count,
            },
            "LCAA": {
                "week": lcaa_poll_week,
                "top25_count": lcaa_top25_count,
                "next5_count": lcaa_next5_count,
            },
        },
        "standings": resolved_sorted,
    }


@lru_cache(maxsize=16)
def _analytics_record_map(week: int | None = None) -> dict[str, dict]:
    records = _cached_records_snapshot()
    if not records:
        return {}

    rec_week = week if week is not None else _latest_records_week(records)
    if rec_week is None:
        return {}

    out = {}
    for r in records:
        if r["week"] != rec_week:
            continue
        tid = str(r["team_id"]).strip().upper()
        out[tid] = {
            "wins": int(r["wins"]),
            "losses": int(r["losses"]),
        }
    return out


@lru_cache(maxsize=16)
def _analytics_polls_map(week: int | None = None) -> dict[str, dict]:
    lsl_week, lsl_top25, lsl_next5 = _build_poll_maps_for_week("LSL", week)
    lcaa_week, lcaa_top25, lcaa_next5 = _build_poll_maps_for_week("LCAA", week)

    team_ids = set(lsl_top25) | set(lsl_next5) | set(lcaa_top25) | set(lcaa_next5)
    out = {}

    for tid in team_ids:
        out[tid] = {
            "LSL": {
                "week": lsl_week,
                "rank": lsl_top25.get(tid),
                "is_ranked": tid in lsl_top25,
                "is_next5": tid in lsl_next5,
            },
            "LCAA": {
                "week": lcaa_week,
                "rank": lcaa_top25.get(tid),
                "is_ranked": tid in lcaa_top25,
                "is_next5": tid in lcaa_next5,
            },
        }

    return out


def _analytics_team_links(team_id: str) -> dict:
    tid = str(team_id).strip().upper()
    return {
        "team": f"/teams/{tid}",
    }


def _analytics_record_block(team_id: str, week: int | None = None) -> dict:
    tid = str(team_id).strip().upper()
    records = load_records_snapshot()
    if not records:
        return {"wins": 0, "losses": 0}

    rec_week = week if week is not None else _latest_records_week(records)
    if rec_week is None:
        return {"wins": 0, "losses": 0}

    for r in records:
        if r["week"] == rec_week and r["team_id"] == tid:
            return {
                "wins": int(r["wins"]),
                "losses": int(r["losses"]),
            }

    return {"wins": 0, "losses": 0}


def _analytics_polls_block(team_id: str, week: int | None = None) -> dict:
    tid = str(team_id).strip().upper()

    lsl_week, lsl_top25, lsl_next5 = _build_poll_maps_for_week("LSL", week)
    lcaa_week, lcaa_top25, lcaa_next5 = _build_poll_maps_for_week("LCAA", week)

    return {
        "LSL": {
            "week": lsl_week,
            "rank": lsl_top25.get(tid),
            "is_ranked": tid in lsl_top25,
            "is_next5": tid in lsl_next5,
        },
        "LCAA": {
            "week": lcaa_week,
            "rank": lcaa_top25.get(tid),
            "is_ranked": tid in lcaa_top25,
            "is_next5": tid in lcaa_next5,
        },
    }


def _analytics_base_row(
    team_id: str,
    team_name: str,
    value: float,
    rank: int,
    week: int | None = None,
    tier: str | None = None,
    trend: str = "flat",
    record_map: dict | None = None,
    polls_map: dict | None = None,
) -> dict:
    tid = str(team_id).strip().upper()

    if record_map is None:
        record = _analytics_record_block(tid, week)
    else:
        record = record_map.get(tid, {"wins": 0, "losses": 0})

    if polls_map is None:
        polls = _analytics_polls_block(tid, week)
    else:
        polls = polls_map.get(
            tid,
            {
                "LSL": {
                    "week": week,
                    "rank": None,
                    "is_ranked": False,
                    "is_next5": False,
                },
                "LCAA": {
                    "week": week,
                    "rank": None,
                    "is_ranked": False,
                    "is_next5": False,
                },
            },
        )

    row = {
        "rank": rank,
        "team_id": tid,
        "team_name": team_name,
        "value": round(float(value), 4),
        "trend": trend,
        "record": record,
        "polls": polls,
        "links": _analytics_team_links(tid),
    }

    if tier is not None:
        row["tier"] = tier

    return row


def _analytics_featured_insights(week: int | None = None) -> list[dict]:
    power = analytics_power(week)
    resume = analytics_resume(week)
    form = analytics_form(week)
    sos = analytics_sos(week)

    def first_item(resp: dict) -> dict | None:
        items = resp.get("items", [])
        return items[0] if items else None

    insights = []

    top_power = first_item(power)
    if top_power:
        insights.append({
            "type": "power_leader",
            "title": "Power Leader",
            "team_id": top_power.get("team_id"),
            "team_name": top_power.get("team_name"),
            "summary": f"#{top_power.get('rank')} in LSL Power",
            "value": top_power.get("value"),
            "links": {
                "team": top_power.get("links", {}).get("team"),
                "analytics": "/analytics/power",
            },
        })

    top_resume = first_item(resume)
    if top_resume:
        insights.append({
            "type": "resume_leader",
            "title": "Resume Leader",
            "team_id": top_resume.get("team_id"),
            "team_name": top_resume.get("team_name"),
            "summary": f"#{top_resume.get('rank')} in LSL Resume",
            "value": top_resume.get("value"),
            "links": {
                "team": top_resume.get("links", {}).get("team"),
                "analytics": "/analytics/resume",
            },
        })

    top_form = first_item(form)
    if top_form:
        insights.append({
            "type": "form_leader",
            "title": "Hottest Team",
            "team_id": top_form.get("team_id"),
            "team_name": top_form.get("team_name"),
            "summary": f"#{top_form.get('rank')} in LSL Form",
            "value": top_form.get("value"),
            "links": {
                "team": top_form.get("links", {}).get("team"),
                "analytics": "/analytics/form",
            },
        })

    top_sos = first_item(sos)
    if top_sos:
        insights.append({
            "type": "sos_leader",
            "title": "Toughest Schedule",
            "team_id": top_sos.get("team_id"),
            "team_name": top_sos.get("team_name"),
            "summary": f"#{top_sos.get('rank')} in SOS",
            "value": top_sos.get("value"),
            "links": {
                "team": top_sos.get("links", {}).get("team"),
                "analytics": "/analytics/sos",
            },
        })

    return insights


@lru_cache(maxsize=16)
def _cached_analytics_overview(week: int | None = None):
    w = 0 if week is None else week

    power = analytics_power(w)

    def leader_from(resp: dict) -> dict | None:
        items = resp.get("items", [])
        if not items:
            return None
        top = items[0]
        return {
            "rank": top.get("rank"),
            "team_id": top.get("team_id"),
            "team_name": top.get("team_name"),
            "value": top.get("value"),
            "links": {
                "team": top.get("links", {}).get("team"),
                "analytics": f"/analytics/{resp.get('metric')}",
            },
        }

    # Preseason / no played games yet:
    # only Power is meaningful, so skip Resume/Form/SOS and featured insights.
    if not _has_played_games_through_week(w):
        return {
            "week": w,
            "meta": {
                "title": "Analytics",
                "subtitle": "League-wide advanced team metrics",
                "metrics_available": ["power", "resume", "form", "sos"],
            },
            "leaders": {
                "power": leader_from(power),
                "resume": None,
                "form": None,
                "sos": None,
            },
            "featured_insights": [],
            "top_tables": {
                "power": power.get("items", [])[:5],
                "resume": [],
                "form": [],
                "sos": [],
            },
        }

    resume = analytics_resume(w)
    form = analytics_form(w)
    sos = analytics_sos(w)

    return {
        "week": w,
        "meta": {
            "title": "Analytics",
            "subtitle": "League-wide advanced team metrics",
            "metrics_available": ["power", "resume", "form", "sos"],
        },
        "leaders": {
            "power": leader_from(power),
            "resume": leader_from(resume),
            "form": leader_from(form),
            "sos": leader_from(sos),
        },
        "featured_insights": _analytics_featured_insights(w),
        "top_tables": {
            "power": power.get("items", [])[:5],
            "resume": resume.get("items", [])[:5],
            "form": form.get("items", [])[:5],
            "sos": sos.get("items", [])[:5],
        },
    }

@app.get("/analytics")
def analytics_overview(week: int | None = None):
    return _cached_analytics_overview(week)


def _power_tier_from_rank(rank: int) -> str:
    if rank <= 10:
        return "elite"
    if rank <= 25:
        return "strong"
    if rank <= 40:
        return "solid"
    return "tracked"


@app.get("/analytics/power")
def analytics_power(week: int | None = None):
    return _cached_analytics_power_payload(week)


def _resume_tier_from_rank(rank: int) -> str:
    if rank <= 10:
        return "elite"
    if rank <= 25:
        return "strong"
    if rank <= 40:
        return "solid"
    return "tracked"


def _resume_quad_for_opponent(opp_id: str, site: str, power_rank_map: dict[str, int]) -> str:
    """
    Working quad model:

    Q1
    - Home: 1-25
    - Neutral: 1-32
    - Away: 1-40

    Q2
    - Home: 26-46
    - Neutral: 33-52
    - Away: 41-58

    Q3
    - Home: 47-69
    - Neutral: 53-69
    - Away: 59-69

    Q4
    - opponent outside tracked 69
    """
    oid = str(opp_id).strip().upper()
    s = str(site or "").strip().upper()

    rank = power_rank_map.get(oid)
    if rank is None:
        return "Q4"

    if s == "HOME":
        if rank <= 25:
            return "Q1"
        if rank <= 46:
            return "Q2"
        return "Q3"

    if s == "NEUTRAL":
        if rank <= 32:
            return "Q1"
        if rank <= 52:
            return "Q2"
        return "Q3"

    # Treat anything else as AWAY
    if rank <= 40:
        return "Q1"
    if rank <= 58:
        return "Q2"
    return "Q3"


def _resume_score_from_counts(
    q1_wins: int,
    q2_wins: int,
    q3_wins: int,
    q4_wins: int,
    q1_losses: int,
    q2_losses: int,
    q3_losses: int,
    q4_losses: int,
) -> float:
    """
    Phase-1 Resume scoring:
    - Q1 wins rewarded most
    - Q2 wins rewarded meaningfully
    - Q3 wins rewarded lightly
    - Q4 wins rewarded minimally

    - Q1 losses penalized lightly
    - Q2 losses penalized moderately
    - Q3 losses penalized more
    - Q4 losses penalized most

    Q4 losses are also counted as bad losses.
    """
    return round(
        (q1_wins * 12.0)
        + (q2_wins * 7.0)
        + (q3_wins * 3.0)
        + (q4_wins * 0.5)
        - (q1_losses * 1.5)
        - (q2_losses * 4.0)
        - (q3_losses * 7.0)
        - (q4_losses * 12.0),
        4,
    )


def _preseason_power_rank_map(week: int | None = None) -> dict[str, int]:
    """
    Builds team_id -> rank map from PreseasonPower for the requested week.
    For now, this is the evaluation-week opponent-quality snapshot used by Resume.
    """
    w = 0 if week is None else week
    rows = load_preseason_power()
    subset = [r for r in rows if r["week"] == w]
    if not subset:
        return {}

    name_map = _team_name_map(active_only=False)

    ranked = sorted(
        subset,
        key=lambda x: (x["power_value"], name_map.get(x["team_id"], x["team_id"]))
    )

    out = {}
    for idx, row in enumerate(ranked, start=1):
        out[str(row["team_id"]).strip().upper()] = idx
    return out


@app.get("/analytics/resume")
def analytics_resume(week: int | None = None):
    _ensure_data_dir()

    if not os.path.exists(GAMES_JSON_PATH):
        return {
            "week": week,
            "metric": "resume",
            "meta": {
                "title": "LSL Resume",
                "subtitle": "Season accomplishment strength",
                "source": "games.json",
                "source_detail": "phase_1_quads_no_sos_weighting",
                "status": "no_games_json",
            },
            "count": 0,
            "items": [],
        }

    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    name_map = _team_name_map(active_only=True)

    # Played games only, optionally filtered through requested week
    played_games = []
    for g in games:
        a = g.get("a_score")
        b = g.get("b_score")
        if a is None or b is None:
            continue

        gw = _to_int_or_none(g.get("week"))
        if week is not None and gw is not None and gw > week:
            continue

        played_games.append(g)

    if not played_games:
        return {
            "week": week,
            "metric": "resume",
            "meta": {
                "title": "LSL Resume",
                "subtitle": "Season accomplishment strength",
                "source": "games.json",
                "source_detail": "phase_1_quads_no_sos_weighting",
                "status": "no_played_games",
            },
            "count": 0,
            "items": [],
        }

    power_rank_map = _preseason_power_rank_map(week)
    if not power_rank_map:
        return {
            "week": week,
            "metric": "resume",
            "meta": {
                "title": "LSL Resume",
                "subtitle": "Season accomplishment strength",
                "source": "games.json + PreseasonPower",
                "source_detail": "phase_1_quads_no_sos_weighting",
                "status": "no_power_snapshot",
            },
            "count": 0,
            "items": [],
        }

    # Build per-team resume buckets
    rows = {}

    def ensure_team(tid: str):
        tid = tid.strip().upper()
        if tid not in rows:
            rows[tid] = {
                "team_id": tid,
                "team_name": name_map.get(tid, tid),
                "q1_wins": 0,
                "q2_wins": 0,
                "q3_wins": 0,
                "q4_wins": 0,
                "q1_losses": 0,
                "q2_losses": 0,
                "q3_losses": 0,
                "q4_losses": 0,
                "bad_losses": 0,
            }

    for g in played_games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        a = g.get("a_score")
        b = g.get("b_score")

        if not ta or not tb:
            continue

        ensure_team(ta)
        ensure_team(tb)

        site = str(g.get("site", "")).strip().upper()

        # team A perspective
        if site == "HOME":
            site_a = "HOME"
            site_b = "AWAY"
        elif site == "AWAY":
            site_a = "AWAY"
            site_b = "HOME"
        else:
            site_a = "NEUTRAL"
            site_b = "NEUTRAL"

        quad_a = _resume_quad_for_opponent(tb, site_a, power_rank_map)
        quad_b = _resume_quad_for_opponent(ta, site_b, power_rank_map)

        if a > b:
            rows[ta][f"{quad_a.lower()}_wins"] += 1
            rows[tb][f"{quad_b.lower()}_losses"] += 1
            if quad_b == "Q4":
                rows[tb]["bad_losses"] += 1
        elif b > a:
            rows[tb][f"{quad_b.lower()}_wins"] += 1
            rows[ta][f"{quad_a.lower()}_losses"] += 1
            if quad_a == "Q4":
                rows[ta]["bad_losses"] += 1

    ranked_rows = []
    for tid, r in rows.items():
        value = _resume_score_from_counts(
            q1_wins=r["q1_wins"],
            q2_wins=r["q2_wins"],
            q3_wins=r["q3_wins"],
            q4_wins=r["q4_wins"],
            q1_losses=r["q1_losses"],
            q2_losses=r["q2_losses"],
            q3_losses=r["q3_losses"],
            q4_losses=r["q4_losses"],
        )

        ranked_rows.append({
            "team_id": tid,
            "team_name": r["team_name"],
            "resume_value": value,
            "resume": {
                "q1_wins": r["q1_wins"],
                "q2_wins": r["q2_wins"],
                "q3_wins": r["q3_wins"],
                "q4_wins": r["q4_wins"],
                "q1_losses": r["q1_losses"],
                "q2_losses": r["q2_losses"],
                "q3_losses": r["q3_losses"],
                "q4_losses": r["q4_losses"],
                "bad_losses": r["bad_losses"],
            },
        })

    ranked = sorted(
        ranked_rows,
        key=lambda x: (-x["resume_value"], x["team_name"])
    )

    record_map = _analytics_record_map(week)
    polls_map = _analytics_polls_map(week)

    items = []
    for idx, row in enumerate(ranked, start=1):
        tid = row["team_id"]

        base = _analytics_base_row(
            team_id=tid,
            team_name=row["team_name"],
            value=row["resume_value"],
            rank=idx,
            week=week,
            tier=_resume_tier_from_rank(idx),
            trend="flat",
            record_map=record_map,
            polls_map=polls_map,
        )

        base["resume"] = row["resume"]
        items.append(base)

    return {
        "week": week,
        "metric": "resume",
        "meta": {
            "title": "LSL Resume",
            "subtitle": "Season accomplishment strength",
            "source": "games.json + PreseasonPower",
            "source_detail": "phase_1_quads_no_sos_weighting",
            "status": "ok",
        },
        "count": len(items),
        "items": items,
    }


def _form_tier_from_rank(rank: int) -> str:
    if rank <= 10:
        return "hot"
    if rank <= 25:
        return "strong"
    if rank <= 40:
        return "solid"
    return "cool"


@app.get("/analytics/form")
def analytics_form(week: int | None = None):
    _ensure_data_dir()

    if not os.path.exists(GAMES_JSON_PATH):
        return {
            "week": week,
            "metric": "form",
            "meta": {
                "title": "LSL Form",
                "subtitle": "Recent performance over the last 8 games",
                "source": "games.json",
                "source_detail": "last_8_played_games_v1",
                "status": "no_games_json",
            },
            "count": 0,
            "items": [],
        }

    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    name_map = _team_name_map(active_only=True)

    # Build played game logs by team
    team_games = {}

    def ensure_team(tid: str):
        tid = tid.strip().upper()
        if tid not in team_games:
            team_games[tid] = []

    for g in games:
        a_score = g.get("a_score")
        b_score = g.get("b_score")
        if a_score is None or b_score is None:
            continue

        gw = _to_int_or_none(g.get("week"))
        if week is not None and gw is not None and gw > week:
            continue

        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        if not ta or not tb:
            continue

        ensure_team(ta)
        ensure_team(tb)

        # team A perspective
        team_games[ta].append({
            "week": gw if gw is not None else 9999,
            "team_id": ta,
            "opp_id": tb,
            "team_score": a_score,
            "opp_score": b_score,
            "margin": a_score - b_score,
        })

        # team B perspective
        team_games[tb].append({
            "week": gw if gw is not None else 9999,
            "team_id": tb,
            "opp_id": ta,
            "team_score": b_score,
            "opp_score": a_score,
            "margin": b_score - a_score,
        })

    if not team_games:
        return {
            "week": week,
            "metric": "form",
            "meta": {
                "title": "LSL Form",
                "subtitle": "Recent performance over the last 8 games",
                "source": "games.json",
                "source_detail": "last_8_played_games_v1",
                "status": "no_played_games",
            },
            "count": 0,
            "items": [],
        }

    def softened_margin(m: int | float) -> float:
        """
        Diminishing returns on margin:
        - full credit up to 10
        - half credit from 11 to 20
        - quarter credit beyond 20
        Symmetric for losses.
        """
        sign = 1.0 if m >= 0 else -1.0
        x = abs(float(m))

        if x <= 10:
            val = x
        elif x <= 20:
            val = 10 + (x - 10) * 0.5
        else:
            val = 10 + 10 * 0.5 + (x - 20) * 0.25

        return sign * val

    rows = []
    for tid, logs in team_games.items():
        # Sort by week descending; later date support can refine this
        logs_sorted = sorted(logs, key=lambda x: x["week"], reverse=True)
        recent = logs_sorted[:8]

        if not recent:
            continue

        recent_wins = sum(1 for g in recent if g["team_score"] > g["opp_score"])
        recent_losses = sum(1 for g in recent if g["team_score"] < g["opp_score"])
        recent_count = len(recent)

        avg_soft_margin = round(
            sum(softened_margin(g["margin"]) for g in recent) / recent_count,
            4
        ) if recent_count > 0 else 0.0

        # Simple v1 form score:
        # recent win pct (scaled to 0-100) + softened avg margin
        win_pct = (recent_wins / recent_count) if recent_count > 0 else 0.0
        form_value = round((win_pct * 100.0) + avg_soft_margin, 4)

        rows.append({
            "team_id": tid,
            "team_name": name_map.get(tid, tid),
            "form_value": form_value,
            "recent_wins": recent_wins,
            "recent_losses": recent_losses,
            "recent_count": recent_count,
        })

    ranked = sorted(
        rows,
        key=lambda x: (-x["form_value"], x["team_name"])
    )

    record_map = _analytics_record_map(week)
    polls_map = _analytics_polls_map(week)

    items = []
    for idx, row in enumerate(ranked, start=1):
        tid = row["team_id"]

        base = _analytics_base_row(
            team_id=tid,
            team_name=row["team_name"],
            value=row["form_value"],
            rank=idx,
            week=week,
            tier=_form_tier_from_rank(idx),
            trend="flat",
            record_map=record_map,
            polls_map=polls_map,
        )

        base["form"] = {
            "source": "played_games",
            "window": 8,
            "last_n_record": {
                "wins": row["recent_wins"],
                "losses": row["recent_losses"],
            },
            "games_in_window": row["recent_count"],
        }

        items.append(base)

    return {
        "week": week,
        "metric": "form",
        "meta": {
            "title": "LSL Form",
            "subtitle": "Recent performance over the last 8 games",
            "source": "games.json",
            "source_detail": "last_8_played_games_v1",
            "status": "ok",
        },
        "count": len(items),
        "items": items,
    }


def _sos_tier_from_rank(rank: int) -> str:
    if rank <= 10:
        return "brutal"
    if rank <= 25:
        return "strong"
    if rank <= 40:
        return "solid"
    return "lighter"


@app.get("/analytics/sos")
def analytics_sos(week: int | None = None):
    _ensure_data_dir()

    if not os.path.exists(GAMES_JSON_PATH):
        return {
            "week": week,
            "metric": "sos",
            "meta": {
                "title": "Strength of Schedule",
                "subtitle": "Schedule difficulty to date",
                "source": "games.json",
                "source_detail": "played_games_only",
                "status": "no_games_json",
            },
            "count": 0,
            "items": [],
        }

    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    name_map = _team_name_map(active_only=True)

    # Filter to played games only, optionally through requested week
    played_games = []
    for g in games:
        a = g.get("a_score")
        b = g.get("b_score")
        if a is None or b is None:
            continue

        gw = _to_int_or_none(g.get("week"))
        if week is not None and gw is not None and gw > week:
            continue

        played_games.append(g)

    if not played_games:
        return {
            "week": week,
            "metric": "sos",
            "meta": {
                "title": "Strength of Schedule",
                "subtitle": "Schedule difficulty to date",
                "source": "games.json",
                "source_detail": "played_games_only",
                "status": "no_played_games",
            },
            "count": 0,
            "items": [],
        }

    # 1) Build played-game records
    rec = {}  # team_id -> {wins, losses, played, win_pct}
    def ensure(tid: str):
        tid = tid.strip().upper()
        if tid not in rec:
            rec[tid] = {
                "team_id": tid,
                "team_name": name_map.get(tid, tid),
                "wins": 0,
                "losses": 0,
                "played": 0,
                "win_pct": 0.0,
            }

    for g in played_games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()
        a = g.get("a_score")
        b = g.get("b_score")

        if not ta or not tb:
            continue

        ensure(ta)
        ensure(tb)

        rec[ta]["played"] += 1
        rec[tb]["played"] += 1

        if a > b:
            rec[ta]["wins"] += 1
            rec[tb]["losses"] += 1
        elif b > a:
            rec[tb]["wins"] += 1
            rec[ta]["losses"] += 1

    for tid, r in rec.items():
        r["win_pct"] = round((r["wins"] / r["played"]), 4) if r["played"] > 0 else 0.0

    # 2) Compute SOS-lite style opponent difficulty:
    # average opponent win_pct, weighted by each played game
    opp_lists = {tid: [] for tid in rec.keys()}

    for g in played_games:
        ta = str(g.get("team_a", "")).strip().upper()
        tb = str(g.get("team_b", "")).strip().upper()

        if ta not in rec or tb not in rec:
            continue

        opp_lists[ta].append(tb)
        opp_lists[tb].append(ta)

    rows = []
    for tid, opps in opp_lists.items():
        if len(opps) == 0:
            sos_value = 0.0
            counted = 0
        else:
            s = 0.0
            counted = 0
            for o in opps:
                if o in rec:
                    s += rec[o]["win_pct"]
                    counted += 1
            sos_value = round((s / counted), 4) if counted > 0 else 0.0

        rows.append({
            "team_id": tid,
            "team_name": name_map.get(tid, tid),
            "sos_value": sos_value,
            "opp_games_counted": counted,
        })

    # Higher SOS means harder schedule
    ranked = sorted(
        rows,
        key=lambda x: (-x["sos_value"], x["team_name"])
    )

    record_map = _analytics_record_map(week)
    polls_map = _analytics_polls_map(week)

    items = []
    for idx, row in enumerate(ranked, start=1):
        tid = row["team_id"]

        base = _analytics_base_row(
            team_id=tid,
            team_name=row["team_name"],
            value=row["sos_value"],
            rank=idx,
            week=week,
            tier=_sos_tier_from_rank(idx),
            trend="flat",
            record_map=record_map,
            polls_map=polls_map,
        )

        base["sos"] = {
            "source": "played_games",
            "opp_games_counted": row["opp_games_counted"],
        }

        items.append(base)

    return {
        "week": week,
        "metric": "sos",
        "meta": {
            "title": "Strength of Schedule",
            "subtitle": "Schedule difficulty to date",
            "source": "games.json",
            "source_detail": "played_games_only",
            "status": "ok",
        },
        "count": len(items),
        "items": items,
    }


@lru_cache(maxsize=16)
def _home_analytics_preview(week: int | None = None) -> dict:
    w = 0 if week is None else week

    power = analytics_power(w)

    def leader_from(resp: dict) -> dict | None:
        items = resp.get("items", [])
        if not items:
            return None
        top = items[0]
        return {
            "rank": top.get("rank"),
            "team_id": top.get("team_id"),
            "team_name": top.get("team_name"),
            "value": top.get("value"),
            "tier": top.get("tier"),
            "links": {
                "team": top.get("links", {}).get("team"),
                "analytics": f"/analytics/{resp.get('metric')}",
            },
        }

    # Preseason / no played results yet:
    # only Power is meaningful, so skip Resume/Form/SOS entirely.
    if not _has_played_games_through_week(w):
        return {
            "week": w,
            "leaders": {
                "power": leader_from(power),
                "resume": None,
                "form": None,
                "sos": None,
            },
        }

    resume = analytics_resume(w)
    form = analytics_form(w)
    sos = analytics_sos(w)

    return {
        "week": w,
        "leaders": {
            "power": leader_from(power),
            "resume": leader_from(resume),
            "form": leader_from(form),
            "sos": leader_from(sos),
        },
    }


async def _load_games_from_db():
    async with AsyncSessionLocal() as session:
        statement = select(Game)
        results = await session.exec(statement)
        games = results.all()
        # Return the list of dicts
        return [g.model_dump() for g in games] if games else []
    

@app.get("/")
async def root():
    return {"message": "LSL Backend is Live", "game_count_in_db": 1471}


@app.get("/home")
async def home(
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

    global GLOBAL_GAMES_LIST
    # Use the RAM cache we built at startup. 
    # This prevents Render from having to load 1,471 games over and over.
    games = GLOBAL_GAMES_LIST
    
    if not games:
        # Fallback only if the RAM cache is empty
        games = await _load_games_from_db()

    
    # --- MOVE THIS UP ---
    if games is None:
        games = []
    
    # This print will now show you that the games are coming from the cache
    print(f"iPad request received. Games type: {type(games)}. Count: {len(games)}")
    
    # if not games:
        # games = []  <-- You can remove this line now since we did it above
        # raise HTTPException...

    
    # REMOVE THE 'if not games' 404 BLOCK TEMPORARILY
    # This ensures that even if something is weird with the list, 
    # the server continues instead of killing the request with a 404.

    name_map = _cached_team_name_map_all()
    phase_map = _cached_week_phase_map()

    # Build LSL poll maps (latest week in Polls sheet)
    lsl_top25_rank = {}   # team_id -> 1..25
    lsl_next5_order = {}  # team_id -> 1..5 (not official rank)
    lsl_poll_week = None

    try:
        poll_rows = _cached_polls()
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

    tracked_team_ids = {
        str(t.team_id).strip().upper()
        for t in _cached_teams_index()
        if getattr(t, "active", False)
    }

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

    try:
        analytics_preview = _home_analytics_preview()
    except Exception:
        analytics_preview = {}

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

            phase_v = str(g.get("phase", "")).strip().upper()
            week_v = _to_int_or_none(g.get("week"))

            out_games.append({
                "game_key": g.get("game_key"),
                "phase": phase_v,
                "phase_display": _phase_display_name(phase_v, week_v, phase_map),
                "week": week_v,
                "venue": g.get("venue"),
                "home_id": home_id,
                "home_name": name_map.get(home_id, home_id),
                "away_id": away_id,
                "away_name": name_map.get(away_id, away_id),
                "lsl_rank_home": lsl_top25_rank.get(home_id),
                "lsl_rank_away": lsl_top25_rank.get(away_id),
                "lsl_next5_home": lsl_next5_order.get(home_id),
                "lsl_next5_away": lsl_next5_order.get(away_id),
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

    # ---- rankings preview (prefer LSL Poll, fallback to SOS-lite) ----
    rankings_preview_type = None
    rankings_preview_week = None
    rankings_preview = []

    # First try: latest/requested LSL poll
    try:
        if poll_rows:
            available_weeks = sorted({r["week"] for r in poll_rows})
            rankings_preview_week = available_weeks[-1]

            lsl_rows = [
                r for r in poll_rows
                if r["week"] == rankings_preview_week and r["poll"] == "LSL"
            ]

            poll_items = []
            for r in lsl_rows:
                tid2 = str(r["team_id"]).strip().upper()
                bucket = str(r["bucket"]).strip().upper()
                bucket_order = int(r["bucket_order"])

                item = {
                    "team_id": tid2,
                    "team_name": name_map.get(tid2, tid2),
                    "bucket": bucket,
                    "bucket_order": bucket_order,
                    "rank": bucket_order if bucket == "TOP25" else None,
                    "next5_order": bucket_order if bucket == "NEXT5" else None,
                }
                poll_items.append(item)

            def _poll_sort_key(x):
                if x["bucket"] == "TOP25":
                    return (0, x["bucket_order"], x["team_name"])
                if x["bucket"] == "NEXT5":
                    return (1, x["bucket_order"], x["team_name"])
                return (2, 999, x["team_name"])

            poll_items_sorted = sorted(poll_items, key=_poll_sort_key)
            rankings_preview = poll_items_sorted[:top_n]
            rankings_preview_type = "lsl_poll"
    except Exception:
        rankings_preview_type = None
        rankings_preview_week = None
        rankings_preview = []

    # Fallback: current SOS-lite logic if poll data unavailable
    if rankings_preview_type is None:
        rec = {}

        def ensure(tid2: str):
            tid2 = tid2.strip().upper()
            if tid2 not in rec:
                rec[tid2] = {
                    "team_id": tid2,
                    "team_name": name_map.get(tid2, tid2),
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
            ensure(ta)
            ensure(tb)
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

        ranked = sorted(
            rec.values(),
            key=lambda x: (-x["win_pct"], -x["sos_lite"], -x["wins"], x["team_id"])
        )

        rankings_preview = ranked[:top_n]
        rankings_preview_type = "sos_lite"
        rankings_preview_week = None

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

    def _is_lsl_top25(team_id: str) -> bool:
        return team_id in lsl_top25_rank

    def _is_lsl_next5(team_id: str) -> bool:
        return team_id in lsl_next5_order
    
    def _is_tracked_team(team_id: str) -> bool:
        return str(team_id).strip().upper() in tracked_team_ids

    def _featured_matchup_bucket(home_id: str, away_id: str) -> int:
        """
        Lower bucket number = more desirable featured matchup.

        0 = Top25 vs Top25
        1 = Top25 vs Next5
        2 = Poll ecosystem vs poll ecosystem (both sides are Top25/Next5)
        3 = Both teams are tracked 69 teams
        4 = one Top25 team involved
        5 = one Next5 team involved
        6 = everything else
        """
        h_top25 = _is_lsl_top25(home_id)
        a_top25 = _is_lsl_top25(away_id)
        h_next5 = _is_lsl_next5(home_id)
        a_next5 = _is_lsl_next5(away_id)

        h_poll = h_top25 or h_next5
        a_poll = a_top25 or a_next5

        h_tracked = _is_tracked_team(home_id)
        a_tracked = _is_tracked_team(away_id)

        if h_top25 and a_top25:
            return 0
        if (h_top25 and a_next5) or (a_top25 and h_next5):
            return 1
        if h_poll and a_poll:
            return 2
        if h_tracked and a_tracked:
            return 3
        if h_top25 or a_top25:
            return 4
        if h_next5 or a_next5:
            return 5
        return 6

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
            "phase_display": _phase_display_name(phase_v, week_v, phase_map),
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
                    _featured_matchup_bucket(x["home_id"], x["away_id"]),  # matchup quality first
                    -(_poll_points(x["home_id"]) + _poll_points(x["away_id"])),  # then combined LSL poll strength
                    -x["quality"],  # then quality
                    _season_rank_from_date_key(x["date_key"]),  # then soonest date
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
        "refreshed_at": meta.get("refreshed_at") if (meta and isinstance(meta, dict)) else datetime.utcnow().isoformat(),
        "games_count": meta.get("games_count") if (meta and isinstance(meta, dict)) else len(games),
        "summary": meta.get("summary") if (meta and isinstance(meta, dict)) else {"detail": "Persistent mode"},
    }


    return {
        "status": status_block,
        "filters": {"team_id": tid, "phase": ph},
        "team_summary_preview": team_summary_preview,
        "my_team_next_3": my_team_next_3,
        "my_team_recent_3": my_team_recent_3,
        "featured_games": featured_games,
        "analytics_preview": analytics_preview,
        "calendar_preview": {
            "days_requested": days,
            "days_returned": len(calendar_preview),
            "days": calendar_preview,
        },
        "rankings_preview": {
            "type": rankings_preview_type,
            "week": rankings_preview_week,
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


@app.get("/debug-db")
async def debug_db():
    async with AsyncSessionLocal() as session:
        # Check what the actual connection string looks like (safely)
        db_url = str(engine.url)
        
        # Check the table content
        statement = select(Game)
        results = await session.exec(statement)
        games = results.all()
        
        return {
            "database_host": db_url.split('@')[-1],
            "games_found": len(games),
            "is_postgres": "postgresql" in db_url
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
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST

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
    # We are using Postgres now, so we just return an empty list 
    # if the file is missing, instead of crashing the app with a 404.
    if not os.path.exists(GAMES_JSON_PATH):
        return []
    with open(GAMES_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
    

def _to_int_or_none(v):
    try:
        return int(v)
    except Exception:
        return None
    

@app.get("/games/{game_key}")
async def get_game_by_key(game_key: str):
    key = game_key.strip()

    async with AsyncSessionLocal() as session:
        statement = select(Game).where(Game.game_key == key)
        result = await session.exec(statement)
        game_row = result.one_or_none()

    if not game_row:
        raise HTTPException(status_code=404, detail=f"game_key not found: {key}")

    g = game_row.model_dump()

    name_map = _cached_team_name_map_all()
    phase_map = _cached_week_phase_map()
    support = _cached_game_preview_support()

    team_index_map = support["team_index_map"]
    players_by_team = support["players_by_team"]
    team_conf_map = support["team_conf_map"]
    conf_names = support["conf_names"]
    polls_block_by_team = support["polls_block_by_team"]

    records_by_team = support["records_by_team"]
    leaders_by_team = support["leaders_by_team"]

    def _team_preview(team_id: str):
        tid = str(team_id).strip().upper()
        team_row = team_index_map.get(tid)
        conf_id = team_conf_map.get(tid)
        conf_name = conf_names.get(conf_id) if conf_id else None

        return {
            "team_id": tid,
            "team_name": team_row.team_name if team_row else name_map.get(tid, tid),
            "conference_id": conf_id,
            "conference_name": conf_name,
            "record": records_by_team.get(
                tid,
                {"overall_record": "0-0", "conference_record": "0-0"},
            ),
            "polls": polls_block_by_team.get(
                tid,
                {
                    "week": None,
                    "LSL": {"rank": None, "next5_order": None},
                    "LCAA": {"rank": None, "next5_order": None},
                },
            ),
            "analytics": _cached_team_analytics_summary(tid, 0),
            "leaders": leaders_by_team.get(
                tid,
                {"ppg": None, "rpg": None, "apg": None, "spg": None},
            ),
        }

    ta = str(g.get("team_a", "")).strip().upper()
    tb = str(g.get("team_b", "")).strip().upper()
    home_id = str(g.get("home_id", "")).strip().upper()
    away_id = str(g.get("away_id", "")).strip().upper()
    venue = str(g.get("venue", "")).strip().upper()

    phase_v = str(g.get("phase", "")).strip().upper()
    week_v = _to_int_or_none(g.get("week"))
    date_key = str(g.get("date_key", "")).strip()

    a_score = g.get("a_score")
    b_score = g.get("b_score")
    played = (a_score is not None) and (b_score is not None)

    home_name = name_map.get(home_id, home_id)
    away_name = name_map.get(away_id, away_id)

    if venue == "H":
        matchup_display = f"{away_name} at {home_name}"
    else:
        matchup_display = f"{away_name} vs {home_name}"

    return {
        "game_key": g.get("game_key"),
        "played": played,
        "phase": phase_v,
        "phase_display": _phase_display_name(phase_v, week_v, phase_map),
        "week": week_v,
        "date_key": date_key,
        "display_date": _format_date_key_mmdd(date_key),
        "matchup_display": matchup_display,
        "team_a": ta,
        "team_b": tb,
        "team_a_name": name_map.get(ta, ta),
        "team_b_name": name_map.get(tb, tb),
        "home_id": home_id,
        "home_name": home_name,
        "away_id": away_id,
        "away_name": away_name,
        "home_team": _team_preview(home_id),
        "away_team": _team_preview(away_id),
    }


@app.get("/matchup/{team1}/{team2}")
def matchup(team1: str, team2: str):
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    name_map = _team_name_map(active_only=False)
    phase_map = load_week_phase_map()
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

        phase_v = str(g.get("phase", "")).strip().upper()
        week_v = _to_int_or_none(g.get("week"))

        out.append({
            "game_key": g.get("game_key"),
            "phase": phase_v,
            "phase_display": _phase_display_name(phase_v, week_v, phase_map),
            "week": week_v,
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
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    name_map = _team_name_map(active_only=False)
    phase_map = load_week_phase_map()

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

            phase_v = str(g.get("phase", "")).strip().upper()
            week_v = _to_int_or_none(g.get("week"))

            out_games.append({
                "game_key": g.get("game_key"),
                "phase": phase_v,
                "phase_display": _phase_display_name(phase_v, week_v, phase_map),
                "week": week_v,
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
async def team_schedule(
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
    tid = team_id.strip().upper()
    global GLOBAL_GAMES_LIST
    # Pull from RAM cache (instant) instead of Postgres network (slow)
    games = [g for g in GLOBAL_GAMES_LIST if g.get("team_a") == tid or g.get("team_b") == tid]

    phase_map = _cached_week_phase_map()
    name_map = _cached_team_name_map_all()
    grouped_lsl_polls = _load_lsl_polls_grouped_by_week()

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

        phase_v = str(g.get("phase", "")).strip().upper()
        week_v = _to_int_or_none(g.get("week"))

        opponent_poll_ctx = _lsl_rank_context_for_team_at_week(
            opponent_id,
            week_v,
            grouped_lsl_polls,
        )

        out.append({
            "game_key": g.get("game_key"),
            "date_key": g.get("date_key"),
            "display_date": _format_date_key_mmdd(g.get("date_key")),
            "phase": phase_v,
            "phase_display": _phase_display_name(phase_v, week_v, phase_map),
            "week": week_v,
            "site": site,
            "team_id": tid,
            "opponent_team_id": opponent_id,
            "opponent_lsl_rank": opponent_poll_ctx.get("rank"),
            "opponent_lsl_next5_order": opponent_poll_ctx.get("next5_order"),
            "opponent_name": name_map.get(opponent_id, opponent_id),
            "poll_week": opponent_poll_ctx.get("poll_week"),
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

    def _season_date_sort_key(date_key):
        s = str(date_key or "").strip()
        if len(s) != 4 or not s.isdigit():
            return (99, 99)

        month = int(s[:2])
        day = int(s[2:])

        # Treat Oct-Dec as the front half of the season, Jan-Mar as the back half
        if month >= 10:
            season_month = month - 9   # Oct=1, Nov=2, Dec=3
        else:
            season_month = month + 3   # Jan=4, Feb=5, Mar=6

        return (season_month, day)


    # sort by week first, then season-aware date, then opponent
    def sort_key(x):
        week_val = x.get("week") if x.get("week") is not None else 9999
        date_part = _season_date_sort_key(x.get("date_key"))
        opp = str(x.get("opponent_team_id", ""))
        return (week_val, date_part, opp)

    out_sorted = sorted(out, key=sort_key)

    return {
        "team_id": tid,
        "games_returned": len(out_sorted),
        "filters": {"include_unplayed": include_unplayed, "phase": phase, "week": week},
        "schedule": out_sorted,
    }


@app.get("/teams/{team_id}/results")
async def team_results(team_id: str, phase: Optional[str] = None):
    """
    Played games only (wrapper around /schedule).
    """
    return await team_schedule(team_id=team_id, include_unplayed=False, phase=phase, week=None)


@app.get("/teams/{team_id}/roster")
def team_roster(team_id: str):
    tid = team_id.strip().upper()

    teams = load_teams_index()
    match = next((t for t in teams if t.team_id.strip().upper() == tid and t.active), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Team '{tid}' not found")

    rows = load_players_snapshot()
    roster = [r for r in rows if r["team_id"] == tid]

    roster_sorted = roster

    return {
        "team_id": tid,
        "team_name": match.team_name,
        "players_count": len(roster_sorted),
        "players": roster_sorted,
        "links": {
            "team": f"/teams/{tid}",
            "schedule": f"/teams/{tid}/schedule",
            "results": f"/teams/{tid}/results",
        },
    }


@app.get("/players/{player_id}")
def get_player(player_id: str):
    pid = player_id.strip().upper()

    rows = load_players_snapshot()
    match = next((r for r in rows if str(r.get("player_id", "")).strip().upper() == pid), None)

    if not match:
        raise HTTPException(status_code=404, detail=f"Player '{pid}' not found")

    team_id = str(match.get("team_id", "")).strip().upper()
    team_name = None

    try:
        teams = load_teams_index()
        team_match = next((t for t in teams if t.team_id.strip().upper() == team_id), None)
        if team_match:
            team_name = team_match.team_name
    except Exception:
        team_name = None

    return {
        **match,
        "team_name": team_name,
        "links": {
            "team": f"/teams/{team_id}",
            "roster": f"/teams/{team_id}/roster",
            "schedule": f"/teams/{team_id}/schedule",
            "results": f"/teams/{team_id}/results",
        },
    }


@app.get("/teams/{team_id}/upcoming")
def team_upcoming(team_id: str, phase: Optional[str] = None):
    """
    Unplayed games only.
    """
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
    tid = team_id.strip().upper()
    phase_map = load_week_phase_map()

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

        phase_v = str(g.get("phase", "")).strip().upper()
        week_v = _to_int_or_none(g.get("week"))

        out.append({
            "game_key": g.get("game_key"),
            "phase": phase_v,
            "phase_display": _phase_display_name(phase_v, week_v, phase_map),
            "week": week_v,
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
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
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
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST

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
    global GLOBAL_GAMES_LIST
    games = GLOBAL_GAMES_LIST
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


@app.get("/inspect-paths")
def inspect_paths():
    return sorted([route.path for route in app.routes])


@app.get("/run-migration-nudge")
async def run_migration_nudge():
    # This manually injects the new column into the Postgres table
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE device ADD COLUMN notifications_enabled BOOLEAN DEFAULT TRUE;"))
    return {"message": "Database nudged! Column 'notifications_enabled' added to 'device' table."}
