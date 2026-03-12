# LSL Analytics Backend

FastAPI backend for the Legends Sim League (LSL) that ingests schedules/results from Google Sheets, deduplicates league-wide games, and exposes a mobile-friendly JSON API for teams, schedules, rankings, polls, calendar, and conference standings.

This project is designed to be the data/API layer for a future mobile app (Android/iOS).

---

## What this backend does

### Ingestion
- Reads `ScheduleExport` tabs across all active team sheets (tracked teams).
- Validates rows using the ScheduleExport data contract.
- Deduplicates games league-wide using a stable `game_key`.
- Writes the league dataset to `backend/data/games.json`.
- Writes refresh metadata to `backend/data/refresh_meta.json`.

### API
Provides endpoints for:
- health/status
- teams (list, search, detail)
- schedules, results, upcoming games, summaries
- games list (pagination + filters + sorting)
- matchup lookup and game lookup
- calendar feed (season-order)
- home feed (mobile “one-call” payload)
- polls (LSL + LCAA) and rankings poll view
- conferences (membership + standings) including teams without sheets
- universal head-to-head tie-breakers for conference standings (debuggable)

---

## Data sources (Google Sheets)

### Required tabs (MasterIndex sheet)
- `TeamsIndex`  
  Active tracked teams with sheet IDs (and optional metadata).  
- `TeamMap`  
  Team ID ↔ display name mapping used for name resolution.
- `Polls`  
  Weekly poll entries for `LSL` (primary) and `LCAA` (secondary).
- `Conferences`  
  `conference_id` → `conference_name` mapping.
- `ConferenceMembership`  
  `team_id` → `conference_id` mapping for ALL conference teams (tracked + non-tracked).
- `RecordsSnapshot`  
  Weekly overall & conference records for ALL conference teams.
- `ConfGamesSnapshot`  
  Weekly conference game results used for head-to-head tie-breakers.

### Team sheet requirements
Each tracked team sheet must contain:
- `ScheduleExport` tab following the ScheduleExport schema.

---

## ScheduleExport data contract (current)

Columns (A–N used in Sheets; backend reads required fields):
- `week`
- `team_id`
- `opponent_team_id`
- `site`
- `team_score`
- `opp_score`
- `error`
- `opp_name`
- `opp_key`
- `opp_norm_key`
- `phase`
- `date_key`
- plus internal/helper columns as needed in Sheets

Valid row rule (ingestion):
- ingest only if `week` is present, `error` is blank, and `opponent_team_id` is present.

Dedupe key:
- `game_key = phase | week | venue | team_a | team_b`
  - where `team_a/min(team_id, opp_id)` and `team_b/max(...)`
  - and `venue` disambiguates home/away + allows same-week home-and-home series

---

## Local setup

### 1) Create venv and install deps
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Git Bash on Windows
pip install -r requirements.txt