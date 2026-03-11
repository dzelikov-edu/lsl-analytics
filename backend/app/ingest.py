from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from app.settings import settings
from app.sheets_client import get_sheets_service, read_range


@dataclass(frozen=True)
class TeamIndexRow:
    team_id: str
    team_name: str
    sheet_id: str
    export_tab: str
    active: bool


def _to_bool(v) -> bool:
    if isinstance(v, bool):
        return v
    s = str(v).strip().upper()
    return s in ("TRUE", "YES", "1")


def load_teams_index() -> List[TeamIndexRow]:
    """
    Reads TeamsIndex from MASTER sheet.
    Requires headers: team_id, team_name, sheet_id, export_tab, active
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)

    values = read_range(service, settings.MASTER_SHEET_ID, f"{settings.TEAMS_INDEX_TAB}!A1:Z2000")
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

        rows.append(TeamIndexRow(team_id, team_name, sheet_id, export_tab, active))

    return rows


def load_team_map_names() -> dict:
    """
    Reads TeamMap from MASTER sheet and returns {TEAM_ID: display_name}.
    Expects TeamMap columns:
      A = team_id
      B = display_name
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "TeamMap!A1:B2000")
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
    values = read_range(service, team_sheet_id, f"{export_tab}!A1:M1000")
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


def ingest_league(teams: List[TeamIndexRow]) -> dict:
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

    return {"summary": summary, "games_by_key": global_unique}