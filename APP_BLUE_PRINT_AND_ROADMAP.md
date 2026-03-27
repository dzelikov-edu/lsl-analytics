# App Blueprint and Roadmap

Purpose:
- Formalize the current LSL app direction after backend foundation and pre-app readiness work
- Lock the v1 app structure, screen map, and endpoint mapping
- Clarify the near-term roadmap after core app design/build begins

---

## Current Project State

The project has moved beyond basic backend setup and now has a real mobile-oriented product foundation.

### Core backend/product surfaces working
- `/health`
- `/status`
- `/refresh/meta`
- `/refresh`
- `/teams`
- `/teams/{team_id}`
- `/teams/{team_id}/schedule`
- `/teams/{team_id}/results`
- `/teams/{team_id}/upcoming`
- `/teams/{team_id}/summary`
- `/teams/{team_id}/roster`
- `/games`
- `/games/{game_key}`
- `/matchup/{team1}/{team2}`
- `/calendar`
- `/home`
- `/polls`
- `/polls/{poll}`
- `/rankings/polls`
- `/conferences`
- `/conferences/{conf_id}`

### Analytics route family working
- `/analytics`
- `/analytics/power`
- `/analytics/resume`
- `/analytics/form`
- `/analytics/sos`

### Analytics already integrated into
- `/teams`
- `/teams/{team_id}`
- `/home`

### Current analytics state
- Power is real for preseason week 0 using `PreseasonPower`
- Resume/Form/SOS are structurally live and behave honestly in preseason/no-games state
- `/analytics` overview is real
- `/analytics` featured insights are now real enough for preseason state
- `/home` rankings preview now prefers latest LSL poll instead of SOS-lite
- `/home` analytics preview is live

### Roster state
- `PlayersSnapshot` schema is defined
- `load_players_snapshot()` works
- `/teams/{team_id}/roster` works
- team detail now includes:
  - `roster_summary.players_count`
  - `links.roster`

---

## Locked V1 Top-Level Tabs

- Home
- Teams
- Analytics
- Conferences
- Rankings

---

## Locked Screen Map

### Home
Order:
1. Header / identity area
2. Featured Games
3. Rankings Preview
4. Analytics Preview
5. My Team block (if team selected/followed)
6. Calendar Preview

#### Home header
- app identity
- current league context
- refresh/status context

#### Featured Games
- section title: Featured Games
- up to 5 games
- each card/row shows:
  - date
  - matchup
  - phase/week context
  - ranking context if available
- tap goes to future game detail / matchup screen
- league mode by default
- team mode when team context exists

#### Rankings Preview
- section title: Rankings
- current LSL poll preview
- top 10 by default on Home
- tap goes to Rankings tab
- LSL-first on Home

#### Analytics Preview
- section title: Analytics
- show current metric leaders:
  - Power Leader
  - Resume Leader
  - Form Leader
  - Toughest Schedule
- only available items appear in preseason/early state
- tap goes to Analytics tab
- compact cards/rows, not a big table

#### My Team block
- appears only when a team is selected/followed
- shows:
  - team identity
  - quick record summary
  - next game
  - recent game(s)
- tap goes to team detail
- roster stays in Teams → Team Detail → Roster

#### Calendar Preview
- section title: Upcoming Schedule or Calendar
- next 3 date buckets by default on Home
- each bucket shows:
  - date
  - number of games
  - short list of games
- tap goes to full Calendar screen later
- compact preview only

---

### Teams
#### Default screen
- Team List

#### Team List behavior
- shows:
  - team name
  - LSL poll context
  - compact analytics summary
- tap goes to Team Detail

#### Team Detail sections
- Overview
- Schedule
- Results
- Analytics
- Roster (future-ready, now partially backend-supported)

---

### Analytics
#### Default screen
- Overview

#### Analytics Overview
- analytics landing page
- shows:
  - metric leaders
  - featured insights
  - compact top tables
- links into:
  - Power
  - Resume
  - Form
  - SOS

#### Analytics sub-screens
- Overview
- Power
- Resume
- Form
- SOS

---

### Conferences
#### Default screen
- Conference List

#### Conference Detail
- conference identity
- standings table
- team records
- poll context where useful
- later room for analytics context

---

### Rankings
#### Default screen
- LSL Poll

#### Rankings sub-screens
- LSL Poll
- LCAA Poll

---

## Locked Screen-to-Endpoint Mapping

### Home
- Home screen → `GET /home`

### Teams
- Team List → `GET /teams`
- Team Detail base → `GET /teams/{team_id}`
- Team Overview → `GET /teams/{team_id}`
- Team Schedule → `GET /teams/{team_id}/schedule`
- Team Results → `GET /teams/{team_id}/results`
- Team Analytics → `GET /teams/{team_id}` for summary now
- Team Roster → `GET /teams/{team_id}/roster`

### Analytics
- Analytics Overview → `GET /analytics`
- Power → `GET /analytics/power`
- Resume → `GET /analytics/resume`
- Form → `GET /analytics/form`
- SOS → `GET /analytics/sos`

### Conferences
- Conference List → `GET /conferences`
- Conference Detail → `GET /conferences/{conf_id}`

### Rankings
- LSL Poll → `GET /polls/LSL`
- LCAA Poll → `GET /polls/LCAA`

---

## Pre-App Readiness Outcome

### Marked good enough for app design
- Home
- Teams
- Analytics
- Conferences
- Rankings

### Featured insights
- good enough for current phase

### Glossary
- can wait until after app design starts, but should be done before app launch

### Performance pass
- light performance sanity pass later

### Future feature placement
- Roster / Players = strongest near-term expansion
- Bracketology = strongest near-term expansion
- Notifications = near-term engagement layer
- Bracket challenge = later

---

## Analytics Model Summary

### LSL Power
- predictive
- neutral-floor strength
- preseason prior early, fading by games played
- no direct résumé inputs

### LSL Resume
- earned accomplishments only
- no preseason prior
- quad-driven
- bad losses matter
- SOS weighting can be layered later

### LSL Form
- last 8 games
- recent performance quality > raw recent record
- margin uses diminishing returns
- opponent/site context matters strongly

### SOS
- schedule difficulty only
- not schedule performance
- season-to-date first
- Remaining SOS can come later

---

## Current Resume Quad Draft

### Q1
- Home: 1–25
- Neutral: 1–32
- Away: 1–40

### Q2
- Home: 26–46
- Neutral: 33–52
- Away: 41–58

### Q3
- Home: 47–69
- Neutral: 53–69
- Away: 59–69

### Q4
- opponents outside the tracked 69 only

---

## Players / Roster Direction

### PlayersSnapshot schema
Columns A:AG

team_id | player_id | player_name | jersey_number | primary_position | secondary_position | height | weight | class | home_city | home_state_region | home_country | prev_team_id | prev_team_name | games_played | ppg | rpg | apg | spg | bpg | fg_pct | three_pct | ft_pct | prev_games_played | prev_ppg | prev_rpg | prev_apg | prev_spg | prev_bpg | prev_fg_pct | prev_three_pct | prev_ft_pct | notes

### Important decisions
- no public overall ratings
- current snapshot table, not weekly duplicated history
- transfer context included
- previous-season stats included
- international players supported
- lineup order preserved by sheet order

---

## Bracketology Direction

Bracketology is now considered a serious near-term roadmap feature because the league uses a distinctive Field of 80 / Survival Sixteen structure.

### Tournament format summary
- 31 automatic bids
- 49 at-large bids
- 80 total teams
- 32 teams enter the Survival Sixteen
- 16 teams advance into the Round of 64
- Round of 64 still becomes a normal 1-through-16 seeded regional bracket

### Roadmap placement
- Bracketology is much earlier than bracket challenge
- it is a near-term feature, not a distant one

---

## Notifications Direction

Planned idea:
- users can follow any number of the tracked 69 teams
- v1 notification type should likely be final score alerts
- later can expand to game start, upset alerts, tournament alerts, overtime alerts

---

## Bracket Challenge Direction

Treat as later than Bracketology.

Needs:
- user submissions
- lock timing
- scoring rules
- leaderboard
- fuller engagement infrastructure

---

## Recommended Roadmap Order

### Phase 0 — Foundation (largely done)
- backend foundation
- analytics philosophy
- additive product integration
- pre-app readiness work

### Phase 1 — App design/build start
- design Home, Teams, Analytics, Conferences, Rankings
- use the locked screen map and endpoint mapping
- build core app shell

### Phase 2 — strongest near-term expansions
- roster / player views
- bracketology
- notifications

### Phase 3 — later engagement systems
- bracket challenge
- projections
- remaining SOS
- deeper matchup layers
- richer editorial/insight systems

---

## Current Conclusion

The project is now at the point where:
- backend foundation is strong
- v1 app structure is locked
- screen-to-endpoint mapping is locked
- the app design phase can begin in a serious way

This document should serve as the bridge from backend/product planning into actual app design/build.