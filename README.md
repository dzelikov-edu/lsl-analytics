# LSL Analytics (Sim-League Backend)

FastAPI backend that ingests game schedules from Google Sheets (per-team spreadsheets) and exposes a JSON API for schedules, matchups, rankings, and SOS-lite.

## What this does

- Reads `ScheduleExport` from **69 team spreadsheets** using a Google service account
- Validates rows (skips blanks and rows with errors)
- Deduplicates games into a single league-wide dataset (`data/games.json`)
- Provides API endpoints for:
  - Teams + team lookup
  - Team schedules/results/upcoming
  - Matchups + game lookup by `game_key`
  - Rankings + SOS-lite
  - Search
  - Status / refresh meta
- Includes refresh lock (prevents concurrent refreshes)
- Includes retry/backoff for transient Google Sheets API failures

---

## Data model (ScheduleExport)

Each team spreadsheet has a `ScheduleExport` tab with columns (typical):

- `week`
- `team_id`
- `opponent_team_id`
- `site` (HOME/AWAY/NEUTRAL)
- `team_score`
- `opp_score`
- `error`
- `opp_name`
- `opp_key`
- `opp_norm_key`
- `phase` (REG_SEASON / CONF_TOURNEY / NAT_TOURNEY)
- `date_key` (MMDD)
- `raw_matchup`

### Dedupe rule

A game is uniquely identified by:

- `game_key = phase | week | venue | home_id | away_id`
- `venue = "H"` for HOME/AWAY games, `"N"` for NEUTRAL games

This handles home-and-home games in the same week (e.g., rivalry weeks).

---

## Setup

### 1) Create venv + install deps

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
