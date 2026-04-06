# LSL App Development Status

_Last updated: 2026-04-05_

## 1. Current development status

The project is now beyond the raw prototype stage and has a working mobile-first foundation across backend and app surfaces.

### Core backend status
- FastAPI backend is running and refreshable from Google Sheets data.
- League data refresh flow is established:
  - Google Sheets source updates
  - `POST /refresh`
  - backend regenerates league data
  - app reload pulls updated API responses
- `games.json` generation is working.
- Historical schedule ingestion is functioning, with duplicate game issues traced back to source-sheet data when they appear.
- Conference membership loading is now more resilient, including fallback behavior when the `ConferenceMembership` sheet times out.

### Core app status
- Expo mobile app is running on device for real phone testing.
- App-wide light/dark theme support is in place.
- Team branding foundation is in place for all 69 tracked teams via `teamBranding.ts`.
- Branded team headers are working across team views.

### Team flow status
The team experience is now one of the strongest parts of Version 1.

Implemented:
- Team Detail screen
- Team Roster screen
- Team Schedule screen
- Team Results screen
- Branded team navigation/header treatment
- Team Detail now prioritizes:
  - overall record
  - conference record
  - poll context
- Conference name display is now cleaner in the UI
- Player count remains available but is correctly secondary

### Schedule and results status
Implemented and/or fixed:
- team schedules now display real dates instead of `TBD`
- team schedules sort by week first, then season-aware date order
- season-aware December-to-January ordering is fixed
- opponent rankings appear on team schedule
- historical ranking context is tied to the game week instead of always using the latest poll
- team results inherit the same historical rank-locking logic through shared backend schedule logic
- duplicate schedule listings were investigated and traced to source data mismatches rather than UI rendering bugs

### Home screen status
Implemented and/or fixed:
- Featured Games restored to intended two-line format
- away team shown above home team
- rankings restored in featured matchups
- Rankings preview restored to 10 teams
- Upcoming Schedule day cards show game counts and visible matchups
- Upcoming Schedule ordering improved using matchup importance logic
- app still supports league-wide and team-scoped home behavior

### Conference / rankings / analytics status
Implemented:
- conference routes exist
- rankings routes exist
- polls structure exists for LSL and LCAA
- analytics routes exist for:
  - Power
  - Resume
  - Form
  - SOS
- Team Detail shows analytics summary cards

---

## 2. What is already considered in good shape for Version 1

These areas are functional enough to count as part of a realistic first release foundation:

- backend refresh workflow
- league schedule ingestion
- team detail core surface
- roster view
- schedule view
- results view
- home feed basics
- rankings preview
- featured games logic
- app-wide theming
- all-69 team branding color foundation

---

## 3. What still needs to be done for Version 1 / first release

This section is the practical remaining work for a strong Version 1 launch candidate.

### A. Team experience polish
High priority.

Remaining items:
- tighten Team Detail analytics into a more premium layout, likely 2-column cards
- improve spacing and hierarchy on Team Detail even further
- polish Team Results visual structure once more real played data exists
- improve roster readability and density for mobile scanning
- make section navigation on Team Detail feel even more product-like

### B. Team logos foundation
High priority for product feel.

Remaining items:
- establish logo asset pipeline and file structure
- begin using team logos across the app
- start with Team Detail, team headers, featured games, and team lists
- keep team colors limited to individual team contexts and future game-specific contexts

### C. Teams list polish
Needed for browsing quality.

Remaining items:
- improve row/card hierarchy in Teams tab
- make rankings/poll indicators cleaner in browse surfaces
- eventually add logos to team list rows

### D. Rankings screen polish
Needed to make rankings feel like a real destination page.

Remaining items:
- improve layout and typography
- better separation of Top 25 vs Next 5
- cleaner poll-week context
- future logo support

### E. Conference screens polish
Needed to round out browsing.

Remaining items:
- improve conference list presentation
- improve conference detail hierarchy and standings readability
- make conference pages feel more product-like, not just functional

### F. Home screen premium pass
Still valuable before release.

Remaining items:
- further tighten hierarchy between Featured Games, Rankings, Analytics, and Upcoming Schedule
- add logos later where appropriate
- improve visual rhythm and card density

### G. Data-quality / stability checks
Still important before any real release.

Remaining items:
- continue validating schedule source data across all tracked teams
- verify no hidden duplicate games remain in sheet inputs
- verify conference membership data remains stable
- continue sanity-checking week/date consistency in source schedules

### H. Basic release readiness items
Needed for a true first version.

Remaining items:
- update README to accurately reflect current mobile/backend scope
- document startup/testing workflow clearly
- define first-version feature scope explicitly
- identify any screens/endpoints that should be hidden or deferred if not ready

---

## 4. Proposed Version 1 release scope

A sensible Version 1 release should focus on the app being a strong mobile browse-and-follow product rather than trying to be fully feature-complete.

### Version 1 should include
- Home screen
- Teams tab
- Team Detail
- Team Schedule
- Team Results
- Team Roster
- Rankings basics
- Conference basics
- Power / Resume / Form / SOS summary presence
- light/dark mode
- team branding colors

### Version 1 does not need to fully include
- deep game detail pages
- full logo rollout everywhere if that work is not ready
- advanced matchup pages
- poll history pages
- every premium visual treatment originally imagined

The goal for Version 1 should be:
**clean, stable, mobile-friendly, and clearly useful.**

---

## 5. Current planned direction for Version 2 / second release

Version 2 should be where the app starts feeling much more like a polished sports media product.

### Planned Version 2 themes
- logos everywhere
- richer game surfaces
- deeper analytics integration
- premium browse experience
- more historical and contextual features

### Likely Version 2 priorities

#### A. Full logo rollout
- team logos across team pages
- logos in featured games
- logos in schedule/results cards
- logos in rankings and team lists
- logos in conference screens

#### B. Game detail pages
- pregame matchup view
- postgame result detail view
- branded team-vs-team presentation
- rankings at time of game
- future opportunity for analytics comparison within a matchup

#### C. Deeper team analytics pages
- dedicated team analytics surface
- team form snapshot
- team trend blocks
- future poll-history and profile expansion

#### D. Premium rankings and conference experiences
- better standings presentation
- better poll presentation
- richer conference navigation and summaries

#### E. Historical context improvements
- ranking context at time of game across all relevant surfaces
- cleaner past-results storytelling
- possible later additions like poll history or weekly movement

#### F. Continued data and backend hardening
- further dedupe protection
- more resilient source reconciliation
- improved backend caching and response efficiency where needed

---

## 6. Immediate recommended next steps when development resumes

Recommended order:
1. convert Team Detail analytics cards into a tighter 2-column layout
2. continue team screen polish pass
3. begin logo asset foundation
4. polish Teams list
5. polish Rankings and Conferences surfaces
6. do a broader Version 1 readiness pass

---

## 7. Summary

The project is now in a strong transitional state:
- the backend foundation is real
- the app is testable on-device
- the team flow is materially useful
- branding and theming are established
- major schedule/ranking logic issues have already been corrected

The next phase is no longer “make it work.”
It is now mostly:
**make it cleaner, more premium, and ready for a realistic Version 1 release.**
