# App Readiness and Roadmap Notes

Purpose:
- Capture where the LSL Analytics project currently stands
- Define what still needs to be polished before true app design/build begins
- Clarify likely future phases and major feature directions

---

## Current State

The backend is no longer in basic setup mode. It now has a real mobile-oriented product foundation.

### Core backend/product surfaces already working
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

### Analytics route family now live
- `/analytics`
- `/analytics/power`
- `/analytics/resume`
- `/analytics/form`
- `/analytics/sos`

### Analytics currently integrated into
- `/teams`
- `/teams/{team_id}`
- `/home`

### Current analytics state
- Power is real for preseason week 0 using `PreseasonPower`
- Resume/Form/SOS are live structurally and behave honestly in preseason/no-games state
- `/analytics` overview is real and pulls from the analytics endpoints
- `/home` rankings preview now prefers latest LSL poll instead of SOS-lite
- `/home` analytics preview is live

---

## Analytics Metric Definitions

### LSL Power
Meaning:
- Who would be favored on a neutral floor today

Design:
- predictive
- uses game results, softened margin, opponent strength, site, recency
- uses preseason prior early, fading by games played
- no direct résumé inputs

### LSL Resume
Meaning:
- how strong a team’s season accomplishments are

Design:
- earned only
- no preseason prior
- uses wins/losses, quality wins, bad losses, opponent quality, site, schedule context
- quad system belongs here

### LSL Form
Meaning:
- how well a team has been playing recently

Design:
- last 8 games
- no preseason prior
- recent performance quality matters more than raw recent record
- recent margin uses diminishing returns
- recent opponent/site context matters strongly

### SOS
Meaning:
- how difficult a team’s schedule has been

Design:
- season-to-date difficulty metric
- not schedule performance
- no wins/losses in the metric itself
- Remaining SOS can exist later as a separate forward-looking metric

---

## Current Working Resume Quad Draft

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
- Opponents outside the tracked 69 only

Notes:
- Uses the evaluation week’s official LSL Power snapshot
- Q4 is reserved for outside-the-69 opponents because the drop-off is very large

---

## Players / Roster Feature Direction

### PlayersSnapshot schema (current agreed direction)
Columns A:AG

team_id | player_id | player_name | jersey_number | primary_position | secondary_position | height | weight | class | home_city | home_state_region | home_country | prev_team_id | prev_team_name | games_played | ppg | rpg | apg | spg | bpg | fg_pct | three_pct | ft_pct | prev_games_played | prev_ppg | prev_rpg | prev_apg | prev_spg | prev_bpg | prev_fg_pct | prev_three_pct | prev_ft_pct | notes

Decisions:
- no public overall ratings
- current snapshot table, not weekly duplicated history
- previous-team fields included for transfers
- previous-season stats included
- international players supported with city / state_region / country split

---

## What Still Needs to Be Finalized Before True App Design Begins

### Pre-app readiness phase
1. Confirm current endpoint contracts are stable enough for app UI work
2. Decide exact v1 app tabs/screens
3. Decide whether any more existing endpoints need additive analytics summaries
4. Decide whether `/analytics` featured insights should become real before app build
5. Write or finalize a simple glossary for metric meanings
6. Do one more performance sanity pass on repeated-read patterns

---

## Likely V1 App Areas

Strong candidates:
- Home
- Teams
- Analytics
- Conferences
- Rankings

Team pages should likely support:
- overview
- schedule/results
- analytics
- roster (if included in scope)

---

## Feature Priority Thinking

### Core first
- stable backend contracts
- app navigation
- core app screens
- analytics tab
- team and conference browsing

### Strong next-layer features
- roster / player views
- push notifications for followed teams
- richer analytics insights

### Later / deeper features
- bracketology
- bracket challenge
- projections
- remaining SOS
- matchup prediction layers
- richer conference analytics

---

## Push Notification Direction

Planned idea:
- users can follow any number of the tracked 69 teams
- v1 notification type should likely be final score alerts
- later can expand to game start, upset alerts, tournament alerts, overtime alerts

---

## Bracketology / Bracket Challenge Direction

Treat these as separate products:

### Bracketology
- editorial / analytics-facing
- projected field
- seeds
- regions
- bubble logic

### Bracket Challenge
- user submissions
- pick locking
- scoring system
- leaderboard

Recommended order:
1. Bracketology planning
2. Bracket display
3. Bracket challenge
4. Scoring / leaderboard

---

## Current Project Readiness Summary

Backend foundation:
- strong

Analytics philosophy:
- strong

Analytics routes:
- live

Mobile-oriented product surfaces:
- increasingly strong

Still needed before true app build:
- one more pre-app readiness polish phase
- final decision on v1 app structure
- small remaining contract/UX decisions

Conclusion:
- the project is close to the point where true app design/build planning should begin
- one more focused polish/decision phase should happen first