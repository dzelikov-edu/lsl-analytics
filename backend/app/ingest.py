from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import asyncio
from app.workers.push_sender import notify_team, notify_all_active_devices

from app.settings import settings
from app.sheets_client import get_sheets_service, read_range

from app.models_devices import Game, NotificationLog
from app.db import AsyncSessionLocal
from sqlmodel import select


@dataclass(frozen=True)
class TeamIndexRow:
    team_id: str
    team_name: str
    sheet_id: str
    export_tab: str
    active: bool
    conference: Optional[str] = None


def _to_bool(v) -> bool:
    if isinstance(v, bool):
        return v
    s = str(v).strip().upper()
    return s in ("TRUE", "YES", "1")


def load_teams_index() -> List[TeamIndexRow]:
    """
    Reads TeamsIndex from MASTER sheet.
    Requires headers: team_id, team_name, sheet_id, export_tab, active
    Optional header: conference
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)

    values = read_range(service, settings.MASTER_SHEET_ID, f"{settings.TEAMS_INDEX_TAB}!A1:G120")
    if not values:
        raise RuntimeError("TeamsIndex returned no data. Check MASTER_SHEET_ID and tab name.")

    headers = [h.strip() for h in values[0]]
    idx = {name: headers.index(name) for name in headers if name}

    required = ["team_id", "team_name", "sheet_id", "export_tab", "active"]
    missing = [r for r in required if r not in idx]
    if missing:
        raise RuntimeError(f"TeamsIndex missing required headers: {missing}")

    rows: List[TeamIndexRow] = []
    for r in values[1:]:
        r = r + [""] * (len(headers) - len(r))
        team_id = str(r[idx["team_id"]]).strip()
        if not team_id:
            continue

        team_name = str(r[idx["team_name"]]).strip()
        sheet_id = str(r[idx["sheet_id"]]).strip()
        export_tab = str(r[idx["export_tab"]]).strip() or settings.DEFAULT_EXPORT_TAB
        active = _to_bool(r[idx["active"]])
        conference = str(r[idx["conference"]]).strip().upper() if "conference" in idx else None

        rows.append(TeamIndexRow(team_id, team_name, sheet_id, export_tab, active, conference))

    return rows


def load_team_map_names() -> dict:
    """
    Reads TeamMap from MASTER sheet and returns {TEAM_ID: display_name}.
    Expects TeamMap columns:
      A = team_id
      B = display_name
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "TeamMap!A1:B400")
    if not values:
        return {}

    # skip header
    out = {}
    for r in values[1:]:
        if len(r) < 2:
            continue
        tid = str(r[0]).strip().upper()
        name = str(r[1]).strip()
        if tid:
            out[tid] = name if name else tid
    return out


from datetime import datetime, timedelta

# --- SIMPLE IN-PROCESS CACHE FOR TEAM MAP NAMES ---
_TEAM_MAP_CACHE: dict[str, object] = {
    "data": None,
    "expires_at": None,
}
_TEAM_MAP_TTL = timedelta(minutes=15)


def load_team_map_names_cached() -> dict:
    """
    Thin wrapper around load_team_map_names() with a short in-process TTL cache.

    - On cache hit: returns the cached dict.
    - On miss/expiry: calls load_team_map_names() exactly as today.
    - If load_team_map_names() raises, the exception is propagated (no behavior change).
    """
    now = datetime.utcnow()
    data = _TEAM_MAP_CACHE.get("data")
    expires_at = _TEAM_MAP_CACHE.get("expires_at")

    if data is not None and isinstance(expires_at, datetime) and expires_at > now:
        return data

    fresh = load_team_map_names()
    _TEAM_MAP_CACHE["data"] = fresh
    _TEAM_MAP_CACHE["expires_at"] = now + _TEAM_MAP_TTL
    return fresh


def load_polls() -> list[dict]:
    """
    Reads Polls tab from MASTER sheet and returns a list of rows.
    Expected columns in Polls tab:
      week | poll | bucket | bucket_order | team_id | notes
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "Polls!A1:F1300")
    if not values or len(values) < 2:
        return []

    header = [str(x).strip().lower() for x in values[0]]
    idx = {h: i for i, h in enumerate(header)}

    required = ["week", "poll", "bucket", "bucket_order", "team_id"]
    for r in required:
        if r not in idx:
            raise RuntimeError(f"Polls sheet missing required column: {r}")

    out = []
    for row in values[1:]:
        def cell(name, default=""):
            i = idx.get(name)
            if i is None or i >= len(row):
                return default
            return str(row[i]).strip()

        week_s = cell("week")
        poll = cell("poll").upper()
        bucket = cell("bucket").upper()
        bucket_order_s = cell("bucket_order")
        team_id = cell("team_id").upper()
        notes = cell("notes", "")

        if not week_s or not poll or not bucket or not bucket_order_s or not team_id:
            continue

        try:
            week = int(float(week_s))
            bucket_order = int(float(bucket_order_s))
        except Exception:
            continue

        out.append({
            "week": week,
            "poll": poll,
            "bucket": bucket,               # TOP25 or NEXT5
            "bucket_order": bucket_order,   # 1..25 or 1..5
            "team_id": team_id,
            "notes": notes,
        })

    return out


def load_preseason_power() -> list[dict]:
    """
    Reads PreseasonPower tab from MASTER sheet.
    Expected columns:
      week | team_id | power_value | notes (optional)

    Returns list of rows as dicts:
      {
        "week": int,
        "team_id": str,
        "power_value": float,
        "notes": str,
      }
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "PreseasonPower!A1:D400")
    if not values or len(values) < 2:
        return []

    header = [str(x).strip().lower() for x in values[0]]
    idx = {h: i for i, h in enumerate(header)}

    required = ["week", "team_id", "power_value"]
    for r in required:
        if r not in idx:
            raise RuntimeError(f"PreseasonPower missing required column: {r}")

    def cell(row, name, default=""):
        i = idx.get(name)
        if i is None or i >= len(row):
            return default
        return row[i]

    out = []
    for row in values[1:]:
        if not row:
            continue

        week_raw = cell(row, "week", "")
        team_id = str(cell(row, "team_id", "")).strip().upper()
        power_raw = cell(row, "power_value", "")

        if week_raw == "" or not team_id or power_raw == "":
            continue

        try:
            week = int(float(str(week_raw)))
            power_value = float(str(power_raw))
        except Exception:
            continue

        notes = ""
        if "notes" in idx:
            notes = str(cell(row, "notes", "")).strip()

        out.append({
            "week": week,
            "team_id": team_id,
            "power_value": power_value,
            "notes": notes,
        })

    return out


def load_players_snapshot() -> list[dict]:
    """
    Reads PlayersSnapshot tab from MASTER sheet.

    Expected columns:
      team_id | player_id | player_name | jersey_number | primary_position |
      secondary_position | height | weight | class | home_city |
      home_state_region | home_country | prev_team_id | prev_team_name |
      games_played | ppg | rpg | apg | spg | bpg | fg_pct | three_pct |
      ft_pct | prev_games_played | prev_ppg | prev_rpg | prev_apg |
      prev_spg | prev_bpg | prev_fg_pct | prev_three_pct | prev_ft_pct | notes
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "PlayersSnapshot!A1:AG2000")
    if not values or len(values) < 2:
        return []

    header = [str(x).strip().lower() for x in values[0]]
    idx = {h: i for i, h in enumerate(header)}

    required = [
        "team_id",
        "player_id",
        "player_name",
        "jersey_number",
        "primary_position",
        "height",
        "weight",
        "class",
        "home_city",
        "home_state_region",
        "home_country",
    ]
    for r in required:
        if r not in idx:
            raise RuntimeError(f"PlayersSnapshot missing required column: {r}")

    def cell(row, name, default=""):
        i = idx.get(name)
        if i is None or i >= len(row):
            return default
        return row[i]

    def as_str(row, name, default=""):
        return str(cell(row, name, default)).strip()

    def as_float(row, name):
        raw = str(cell(row, name, "")).strip()
        if raw == "":
            return None

        try:
            if raw.endswith("%"):
                return float(raw[:-1].strip())
            return float(raw)
        except Exception:
            return None

    out = []
    for row in values[1:]:
        if not row:
            continue

        team_id = as_str(row, "team_id").upper()
        player_id = as_str(row, "player_id").upper()
        player_name = as_str(row, "player_name")

        if not team_id or not player_id or not player_name:
            continue

        out.append({
            "team_id": team_id,
            "player_id": player_id,
            "player_name": player_name,
            "jersey_number": as_str(row, "jersey_number"),
            "primary_position": as_str(row, "primary_position"),
            "secondary_position": as_str(row, "secondary_position"),
            "height": as_str(row, "height"),
            "weight": as_str(row, "weight"),
            "class": as_str(row, "class"),
            "home_city": as_str(row, "home_city"),
            "home_state_region": as_str(row, "home_state_region"),
            "home_country": as_str(row, "home_country"),
            "prev_team_id": as_str(row, "prev_team_id").upper(),
            "prev_team_name": as_str(row, "prev_team_name"),
            "games_played": as_float(row, "games_played"),
            "ppg": as_float(row, "ppg"),
            "rpg": as_float(row, "rpg"),
            "apg": as_float(row, "apg"),
            "spg": as_float(row, "spg"),
            "bpg": as_float(row, "bpg"),
            "fg_pct": as_float(row, "fg_pct"),
            "three_pct": as_float(row, "three_pct"),
            "ft_pct": as_float(row, "ft_pct"),
            "prev_games_played": as_float(row, "prev_games_played"),
            "prev_ppg": as_float(row, "prev_ppg"),
            "prev_rpg": as_float(row, "prev_rpg"),
            "prev_apg": as_float(row, "prev_apg"),
            "prev_spg": as_float(row, "prev_spg"),
            "prev_bpg": as_float(row, "prev_bpg"),
            "prev_fg_pct": as_float(row, "prev_fg_pct"),
            "prev_three_pct": as_float(row, "prev_three_pct"),
            "prev_ft_pct": as_float(row, "prev_ft_pct"),
            "notes": as_str(row, "notes"),
        })

    return out


def load_conference_membership() -> dict[str, str]:
    """
    Reads ConferenceMembership tab from MASTER sheet.
    Expected columns: team_id | conference_id
    Returns: team_id -> conference_id

    If the sheet read times out, falls back to TeamsIndex conference values
    for tracked teams so conference routes do not hard-fail.
    """
    try:
        service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
        values = read_range(service, settings.MASTER_SHEET_ID, "ConferenceMembership!A1:B400")
        if not values or len(values) < 2:
            return {}

        header = [str(x).strip().lower() for x in values[0]]
        idx = {h: i for i, h in enumerate(header)}
        if "team_id" not in idx or "conference_id" not in idx:
            raise RuntimeError("ConferenceMembership must have headers: team_id, conference_id")

        out: dict[str, str] = {}
        for row in values[1:]:
            if not row:
                continue
            team_id = str(row[idx["team_id"]]).strip().upper() if idx["team_id"] < len(row) else ""
            conf_id = str(row[idx["conference_id"]]).strip().upper() if idx["conference_id"] < len(row) else ""
            if team_id and conf_id:
                out[team_id] = conf_id

        return out

    except Exception:
        fallback: dict[str, str] = {}
        for t in load_teams_index():
            conf = getattr(t, "conference", None)
            if conf:
                fallback[str(t.team_id).strip().upper()] = str(conf).strip().upper()

        if fallback:
            return fallback

        raise


def load_conferences_map() -> dict[str, str]:
    """
    Reads Conferences tab from MASTER sheet.
    Expected columns: conference_id | conference_name
    Returns: conference_id -> conference_name
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "Conferences!A1:B40")
    if not values or len(values) < 2:
        return {}

    header = [str(x).strip().lower() for x in values[0]]
    idx = {h: i for i, h in enumerate(header)}
    if "conference_id" not in idx or "conference_name" not in idx:
        raise RuntimeError("Conferences must have headers: conference_id, conference_name")

    out: dict[str, str] = {}
    for row in values[1:]:
        cid = str(row[idx["conference_id"]]).strip().upper() if idx["conference_id"] < len(row) else ""
        cname = str(row[idx["conference_name"]]).strip() if idx["conference_name"] < len(row) else ""
        if cid and cname:
            out[cid] = cname

    return out


def load_records_snapshot() -> list[dict]:
    """
    Reads RecordsSnapshot tab from MASTER sheet.
    Expected columns:
      week | team_id | wins | losses | conf_wins | conf_losses | last_updated (optional)
    Returns list of rows as dicts.
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "RecordsSnapshot!A1:G3000")
    if not values or len(values) < 2:
        return []

    header = [str(x).strip().lower() for x in values[0]]
    idx = {h: i for i, h in enumerate(header)}

    required = ["week", "team_id", "wins", "losses", "conf_wins", "conf_losses"]
    for r in required:
        if r not in idx:
            raise RuntimeError(f"RecordsSnapshot missing required column: {r}")

    def cell(row, name, default=""):
        i = idx.get(name)
        if i is None or i >= len(row):
            return default
        return row[i]

    out = []
    for row in values[1:]:
        if not row:
            continue

        week_raw = cell(row, "week", "")
        team_id = str(cell(row, "team_id", "")).strip().upper()

        if week_raw == "" or not team_id:
            continue

        try:
            week = int(float(str(week_raw)))
            wins = int(float(str(cell(row, "wins", "0"))))
            losses = int(float(str(cell(row, "losses", "0"))))
            conf_wins = int(float(str(cell(row, "conf_wins", "0"))))
            conf_losses = int(float(str(cell(row, "conf_losses", "0"))))
        except Exception:
            continue

        last_updated = ""
        if "last_updated" in idx:
            last_updated = str(cell(row, "last_updated", "")).strip()

        out.append({
            "week": week,
            "team_id": team_id,
            "wins": wins,
            "losses": losses,
            "conf_wins": conf_wins,
            "conf_losses": conf_losses,
            "last_updated": last_updated,
        })

    return out


def load_conf_games_snapshot() -> list[dict]:
    """
    Reads ConfGamesSnapshot tab from MASTER sheet.
    Expected columns:
      week | conference_id | home_id | away_id | home_score | away_score
    Returns list of rows as dicts.
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "ConfGamesSnapshot!A1:F7500")
    if not values or len(values) < 2:
        return []

    header = [str(x).strip().lower() for x in values[0]]
    idx = {h: i for i, h in enumerate(header)}

    required = ["week", "conference_id", "home_id", "away_id", "home_score", "away_score"]
    for r in required:
        if r not in idx:
            raise RuntimeError(f"ConfGamesSnapshot missing required column: {r}")

    def cell(row, name, default=""):
        i = idx.get(name)
        if i is None or i >= len(row):
            return default
        return row[i]

    out = []
    for row in values[1:]:
        if not row:
            continue

        week_raw = cell(row, "week", "")
        conf_id = str(cell(row, "conference_id", "")).strip().upper()
        home_id = str(cell(row, "home_id", "")).strip().upper()
        away_id = str(cell(row, "away_id", "")).strip().upper()

        if week_raw == "" or not conf_id or not home_id or not away_id:
            continue

        try:
            week = int(float(str(week_raw)))
            home_score = int(float(str(cell(row, "home_score", "0"))))
            away_score = int(float(str(cell(row, "away_score", "0"))))
        except Exception:
            continue

        out.append({
            "week": week,
            "conference_id": conf_id,
            "home_id": home_id,
            "away_id": away_id,
            "home_score": home_score,
            "away_score": away_score,
        })

    return out


def load_week_phase_map() -> dict[int, dict]:
    """
    Reads WeekPhaseMap tab from MASTER sheet.

    Expected columns:
      week | phase | phase_display_name
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "WeekPhaseMap!A1:C40")
    if not values or len(values) < 2:
        return {}

    header = [str(x).strip().lower() for x in values[0]]
    idx = {h: i for i, h in enumerate(header)}

    required = ["week", "phase", "phase_display_name"]
    for r in required:
        if r not in idx:
            raise RuntimeError(f"WeekPhaseMap missing required column: {r}")

    def cell(row, name, default=""):
        i = idx.get(name)
        if i is None or i >= len(row):
            return default
        return row[i]

    def as_str(row, name, default=""):
        return str(cell(row, name, default)).strip()

    def as_int(row, name):
        raw = str(cell(row, name, "")).strip()
        if raw == "":
            return None
        try:
            return int(float(raw))
        except Exception:
            return None

    out = {}
    for row in values[1:]:
        if not row:
            continue

        week = as_int(row, "week")
        phase = as_str(row, "phase").upper()
        phase_display_name = as_str(row, "phase_display_name")

        if week is None or not phase:
            continue

        out[week] = {
            "phase": phase,
            "phase_display_name": phase_display_name or phase,
        }

    return out


def read_schedule_export(team_sheet_id: str, export_tab: str) -> List[dict]:
    """
    Reads ScheduleExport by HEADER NAMES (order doesn't matter; extra columns allowed).

    Required headers:
      week, team_id, opponent_team_id, site, team_score, opp_score, error, phase

    Optional headers:
      opp_name, opp_norm_key, raw_matchup, opp_key (ignored)
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)

    # Read wider than A:K because your sheets may have extra helper columns
    values = read_range(service, team_sheet_id, f"{export_tab}!A1:M60")
    if not values:
        return []

    headers_raw = values[0]
    headers = [str(h).strip() for h in headers_raw]

    # Build case-insensitive header -> index map
    hmap = {h.lower(): i for i, h in enumerate(headers) if str(h).strip() != ""}

    required = ["week", "team_id", "opponent_team_id", "site", "team_score", "opp_score", "error", "phase"]
    missing = [h for h in required if h not in hmap]
    if missing:
        raise RuntimeError(
            f"{team_sheet_id} {export_tab}: missing required headers: {missing}\n"
            f"Got headers: {headers}"
        )

    def get_cell(row_list, key: str):
        idx = hmap.get(key)
        if idx is None:
            return ""
        return row_list[idx] if idx < len(row_list) else ""

    out = []
    for r in values[1:]:
        # keep raw row length as-is; we'll safely index
        out.append({
            "week": get_cell(r, "week"),
            "team_id": get_cell(r, "team_id"),
            "opponent_team_id": get_cell(r, "opponent_team_id"),
            "site": get_cell(r, "site"),
            "team_score": get_cell(r, "team_score"),
            "opp_score": get_cell(r, "opp_score"),
            "error": get_cell(r, "error"),
            "phase": get_cell(r, "phase"),

            # Optional fields (nice to have)
            "opp_name": get_cell(r, "opp_name") if "opp_name" in hmap else "",
            "opp_norm_key": get_cell(r, "opp_norm_key") if "opp_norm_key" in hmap else "",
            "raw_matchup": get_cell(r, "raw_matchup") if "raw_matchup" in hmap else "",
            "date_key": get_cell(r, "date_key") if "date_key" in hmap else "",
        })
    return out


def compute_game_key_and_teams(phase: str, week: str, team_id: str, opp_id: str, site: str) -> Tuple[str, str, str, str, str]:
    """
    Returns: (team_a, team_b, venue, home_id, away_id)

    team_a/team_b remain the sorted pair (useful for storage & comparisons).
    game_key will be based on venue + home/away to handle home-and-home in same week.
    """
    # Sorted pair (still useful)
    team_a = min(team_id, opp_id)
    team_b = max(team_id, opp_id)

    site = (site or "").strip().upper()

    if site == "HOME":
        venue = "H"
        home_id, away_id = team_id, opp_id
    elif site == "AWAY":
        venue = "H"
        home_id, away_id = opp_id, team_id
    else:
        # NEUTRAL (or anything else treated as neutral)
        venue = "N"
        home_id, away_id = team_a, team_b

    return team_a, team_b, venue, home_id, away_id


def build_game_key(phase: str, week: str, venue: str, home_id: str, away_id: str) -> str:
    return f"{phase}|{week}|{venue}|{home_id}|{away_id}"


def normalize_scores(
    team_id: str,
    team_a: str,
    team_score: Optional[str],
    opp_score: Optional[str],
) -> Tuple[Optional[int], Optional[int]]:
    """
    Score normalization rule (DataContract):
    If team_id == team_a: a_score=team_score, b_score=opp_score
    else: a_score=opp_score, b_score=team_score
    """
    if team_score is None or opp_score is None:
        return None, None
    ts = str(team_score).strip()
    os = str(opp_score).strip()
    if ts == "" or os == "":
        return None, None

    a = int(ts)
    b = int(os)

    if team_id == team_a:
        return a, b
    else:
        return b, a


def ingest_preview_for_one_team(team_sheet_id: str, export_tab: str):
    rows = read_schedule_export(team_sheet_id, export_tab)

    observations = 0
    skipped = 0
    unique: Dict[str, dict] = {}

    # optional debug: first few computed keys for this team
    first_keys = []

    for sheet_row_num, row in enumerate(rows, start=2):  # header row=1
        week = str(row.get("week", "")).strip()
        err = str(row.get("error", "")).strip()
        team_id = str(row.get("team_id", "")).strip()
        opp_id = str(row.get("opponent_team_id", "")).strip()
        phase = str(row.get("phase", "")).strip()
        site = str(row.get("site", "")).strip()
        date_key = str(row.get("date_key", "")).strip()

        # Valid Row Rule: week not blank AND error blank AND opponent_team_id not blank
        if week == "" or err != "" or opp_id == "":
            skipped += 1
            continue

        observations += 1

        # Uses your updated home/away-aware key logic
        team_a, team_b, venue, home_id, away_id = compute_game_key_and_teams(phase, week, team_id, opp_id, site)
        game_key = build_game_key(phase, week, venue, home_id, away_id)

        a_score, b_score = normalize_scores(team_id, team_a, row.get("team_score"), row.get("opp_score"))

        if len(first_keys) < 8:
            first_keys.append({
                "sheet_row": sheet_row_num,
                "week": week,
                "phase": phase,
                "team_id": team_id,
                "opp_id": opp_id,
                "site": site,
                "game_key": game_key
            })

        # Upsert into per-team unique map
        if game_key not in unique:
            unique[game_key] = {
                "phase": phase,
                "week": week,
                "team_a": team_a,
                "team_b": team_b,
                "venue": venue,
                "home_id": home_id,
                "away_id": away_id,
                "a_score": a_score,
                "b_score": b_score,
                "date_key": date_key,
            }
        else:
            # upsert missing date key
            if (not unique[game_key].get("date_key")) and date_key:
                unique[game_key]["date_key"] = date_key

            # upsert missing scores
            if unique[game_key]["a_score"] is None and a_score is not None:
                unique[game_key]["a_score"] = a_score
                unique[game_key]["b_score"] = b_score

    return {
        "rows_total": len(rows),
        "observations_parsed": observations,
        "rows_skipped": skipped,
        "unique_games": len(unique),
        "duplicates_collapsed": observations - len(unique),
        "unique_map": unique,
        "first_keys_debug": first_keys,
        "sample_games": list(unique.items())[:10],
    }


async def ingest_league(teams: List[TeamIndexRow]) -> dict:
    active = [t for t in teams if t.active]

    totals = {
        "teams_processed": 0,
        "teams_failed": 0,
        "rows_total": 0,
        "observations_parsed": 0,
        "rows_skipped": 0,
    }

    global_unique: Dict[str, dict] = {}
    key_counts: Dict[str, int] = {}
    failures = []

    for t in active:
        try:
            report = ingest_preview_for_one_team(t.sheet_id, t.export_tab)
        except Exception as e:
            totals["teams_failed"] += 1
            failures.append({
                "team_id": t.team_id,
                "sheet_id": t.sheet_id,
                "export_tab": t.export_tab,
                "error": f"{type(e).__name__}: {e}",
            })
            continue

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
                if global_unique[game_key].get("a_score") is None and game.get("a_score") is not None:
                    global_unique[game_key] = game

    unique_games = len(global_unique)
    duplicates_collapsed = totals["observations_parsed"] - unique_games

    seen_once = sum(1 for _, c in key_counts.items() if c == 1)
    seen_twice = sum(1 for _, c in key_counts.items() if c == 2)
    seen_3plus = sum(1 for _, c in key_counts.items() if c >= 3)

    summary = {
        **totals,
        "unique_games": unique_games,
        "duplicates_collapsed": duplicates_collapsed,
        "game_keys_seen_once": seen_once,
        "game_keys_seen_twice": seen_twice,
        "game_keys_seen_3plus": seen_3plus,
        "failures": failures[:20],  # return first 20 failures to keep response small
        "failures_count": len(failures),
    }

    # NEW: Trigger notifications only for games not yet notified
    # 1. Load team names once so we don't hit the sheet/DB inside the loop
    name_map = load_team_map_names()

    async with AsyncSessionLocal() as session:
        for game_key, game_data in global_unique.items():
            home_id = game_data.get("home_id")
            away_id = game_data.get("away_id")
            team_a = game_data.get("team_a")
            
            # --- SURGICAL SCORE MAPPING ---
            # Correctly identify scores based on team IDs, not database slots
            if team_a == home_id:
                h_score_val = game_data.get("a_score")
                a_score_val = game_data.get("b_score")
            else:
                h_score_val = game_data.get("b_score")
                a_score_val = game_data.get("a_score")
            # ------------------------------

            if h_score_val is not None and a_score_val is not None:
                # 1. Check if we already notified for this specific game
                statement = select(NotificationLog).where(NotificationLog.game_key == game_key)
                results = await session.exec(statement)
                already_notified = results.one_or_none()

                if not already_notified:
                    # 2. Record that we are notifying now so it only happens once
                    session.add(NotificationLog(game_key=game_key))
                    await session.commit()

                    # --- PROFESSIONAL WORDING LOGIC ---
                    h_name = name_map.get(home_id, home_id)
                    a_name = name_map.get(away_id, away_id)

                    if h_score_val > a_score_val:
                        title = f"🏀 Final: {h_name} WINS!"
                    elif a_score_val > h_score_val:
                        title = f"🏀 Final: {a_name} WINS!"
                    else:
                        title = "🏀 Final: It's a TIE!"

                    body = f"{a_name} {a_score_val}, {h_name} {h_score_val}. Results are live."
                    # ----------------------------------

                    print(f"Triggering auto-push for new result: {game_key}")
                    
                    # 3. Trigger the pushes
                    asyncio.create_task(notify_team(
                        team_id=home_id, 
                        title=title, 
                        body=body,
                        data={"game_key": game_key, "team_id": home_id, "score": f"{h_score_val}-{a_score_val}"}
                    ))
                    asyncio.create_task(notify_team(
                        team_id=away_id, 
                        title=title, 
                        body=body,
                        data={"game_key": game_key, "team_id": away_id, "score": f"{h_score_val}-{a_score_val}"}
                    ))

    return {"summary": summary, "games_by_key": global_unique}


async def trigger_latest_poll_notification():
    """
    Looks at Polls, finds latest week, and sends a league-wide notification
    if we haven't already done so for that week.
    """
    polls = load_polls()
    if not polls:
        print("[POLL_NOTIFY] No polls data available.")
        return

    latest_poll_week = max(r["week"] for r in polls)
    if latest_poll_week < 2:
        print(f"[POLL_NOTIFY] Latest poll week {latest_poll_week} < 2, skipping.")
        return

    poll_log_key = f"POLL_UPDATE_WEEK_{latest_poll_week}"
    name_map = load_team_map_names()

    async with AsyncSessionLocal() as session:
        stmt = select(NotificationLog).where(NotificationLog.game_key == poll_log_key)
        already_notified = (await session.exec(stmt)).one_or_none()

        if already_notified:
            print(f"[POLL_NOTIFY] Already notified for {poll_log_key}, skipping.")
            return

        session.add(NotificationLog(game_key=poll_log_key))
        await session.commit()

        lsl_1 = next(
            (r for r in polls
             if r["week"] == latest_poll_week and r["poll"] == "LSL" and r["bucket_order"] == 1),
            None,
        )
        top_name = name_map.get(lsl_1["team_id"], lsl_1["team_id"]) if lsl_1 else "A new team"

        title = f"📊 LSL Poll: Week {latest_poll_week} is OUT!"
        body = f"{top_name} is #1. See where your team landed in the updated Top 25."

        print(f"[POLL_NOTIFY] Triggering league-wide push for Week {latest_poll_week} Polls")
        await notify_all_active_devices(title, body)


async def save_games_to_db(games_by_key: Dict[str, dict]):
    async with AsyncSessionLocal() as session:
        for key, data in games_by_key.items():
            # Create a Game object
            game = Game(
                game_key=key,
                phase=data['phase'],
                week=data['week'],
                team_a=data['team_a'],
                team_b=data['team_b'],
                venue=data['venue'],
                home_id=data['home_id'],
                away_id=data['away_id'],
                a_score=data.get('a_score'),
                b_score=data.get('b_score'),
                date_key=data.get('date_key')
            )
            # Use 'merge' to update existing games or create new ones
            await session.merge(game)
        await session.commit()
    print(f"Successfully saved {len(games_by_key)} games to Database.")
