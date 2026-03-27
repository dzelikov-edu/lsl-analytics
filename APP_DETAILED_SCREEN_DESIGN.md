# App Detailed Screen Design

Purpose:
- Capture the detailed mobile screen design decisions locked during the first app design planning phase
- Serve as the design-spec bridge between app blueprint planning and actual app implementation

---

## Top-Level App Tabs

- Home
- Teams
- Analytics
- Conferences
- Rankings

---

## Home Screen — Detailed Design

### Section order
1. Header / identity area
2. Featured Games
3. Rankings Preview
4. Analytics Preview
5. My Team block (if team selected/followed)
6. Calendar Preview

### Header / identity area
Should include:
- app title / identity
- league context line
- refresh/status line

Purpose:
- orient the user
- establish current league moment
- reinforce trust in data freshness

---

### Featured Games
Design:
- compact cards
- top line:
  - date
  - small phase/week context
- middle:
  - away team row
  - home team row
- each team row:
  - poll badge/rank if present
  - team name

Behavior:
- up to 5 games
- league mode by default
- team mode when team context exists
- tap goes to future game detail / matchup screen

Purpose:
- immediate interest / headline matchups
- strongest “open the app and care” section

---

### Rankings Preview
Design:
- section header:
  - Rankings
  - View All
- compact top 10 list
- each row shows:
  - rank number
  - team name

Behavior:
- LSL-first on Home
- tap goes to full Rankings tab

Purpose:
- quick official rankings context
- clean poll snapshot

---

### Analytics Preview
Design:
- section header:
  - Analytics
  - View All
- compact stack of cards/rows
- each item shows:
  - metric label
  - team name
  - optional value in smaller text

Behavior:
- shows current available metric leaders:
  - Power Leader
  - Resume Leader
  - Form Leader
  - Toughest Schedule
- only available items appear in preseason/early state
- tap goes to full Analytics tab

Purpose:
- introduce the analytics layer without overwhelming the screen

---

### My Team block
Design:
- section header:
  - My Team
- one compact personalized card
- shows:
  - team name
  - record
  - next game
  - recent result

Behavior:
- appears only when a team is selected/followed
- tap goes to Team Detail
- roster remains in Teams → Team Detail → Roster

Purpose:
- personalized quick check-in / shortcut

---

### Calendar Preview
Design:
- section header:
  - Upcoming Schedule
  - View All
- next 3 date buckets
- each date bucket shows:
  - date
  - games count
  - short matchup list

Behavior:
- compact preview only
- tap goes to full Calendar screen later

Purpose:
- look-ahead utility without overpowering Home

---

## Teams Tab — Detailed Design

### Default screen
- Team List

### Team List row design
Each row shows:
- team name
- LSL poll context
- compact analytics strip

Purpose:
- quick scan of team identity, ranking context, and analytics context
- stronger than a plain alphabetical team list

---

### Team Detail header
Should show:
- team name
- poll context
- compact analytics summary
- record / quick status context

Purpose:
- immediately explain who the team is, how they are rated, and where they stand

---

### Team Detail sections
- Overview
- Schedule
- Results
- Analytics
- Roster

---

### Overview section
Design:
- quick summary cards
- record snapshot
- next game
- recent result
- later room for roster shortcut

Purpose:
- answer what is going on with this team right now

---

### Schedule section
Design:
- upcoming games list
- each row/card shows:
  - date
  - opponent
  - site
  - phase/week context

Purpose:
- forward-looking only
- answer who they play next

---

### Results section
Design:
- played games list
- each row/card shows:
  - date
  - opponent
  - site
  - score
  - result (W/L)
  - phase/week context

Purpose:
- backward-looking only
- answer what happened recently

---

### Analytics section
Design:
- compact team-level analytics cards for:
  - Power
  - Resume
  - Form
  - SOS

Each card shows:
- metric name
- rank
- value
- tier if available

Purpose:
- team-centered analytics summary
- not full league leaderboards

---

### Roster section
Design:
- lineup/order-preserved player list
- each player row/card shows:
  - jersey number
  - player name
  - primary position
  - secondary position if present
  - class
  - height
  - hometown/home country in compact form
  - current stat line preview

Current stat line preview:
- PPG
- RPG
- APG

Later expand/tap potential:
- SPG
- BPG
- FG%
- 3PT%
- FT%
- previous-year stats

Important rule:
- roster order preserves sheet lineup order

Purpose:
- deep but browseable roster view
- not overloaded at first glance

---

## Analytics Tab — Detailed Design

### Default screen
- Analytics Overview

### Analytics Overview layout
1. metric leader cards
2. Featured Insights
3. compact top tables for Power / Resume / Form / SOS

Purpose:
- make Analytics feel like a destination, not just a list of rankings

---

### Metric Leader cards
Each card shows:
- metric label
- team name
- rank/value
- small tap affordance

Examples:
- Power Leader
- Resume Leader
- Form Leader
- Toughest Schedule

Design:
- compact cards
- two-per-row on phone if it fits, otherwise stacked

Purpose:
- fast “who leads what?” snapshot

---

### Featured Insights
Design:
- section header: Featured Insights
- small stack of insight cards/rows
- each insight shows:
  - title
  - team name
  - short summary
  - optional value
  - tap target

Purpose:
- story layer of the Analytics tab
- makes the tab feel alive

---

### Compact top tables
Preview tables for:
- Power
- Resume
- Form
- SOS

Each preview shows:
- section label
- top 5
- rank
- team name
- optional smaller value

Purpose:
- quick leaderboard access
- preview of each metric
- tap into deeper sub-screens

---

### Analytics sub-screens
- Overview
- Power
- Resume
- Form
- SOS

---

## Conferences Tab — Detailed Design

### Default screen
- Conference List

### Conference List row design
Each row shows:
- conference name
- quick standings context
- optional poll context if useful

Purpose:
- let users quickly choose which conference to open
- more informative than a bare name list

---

### Conference Detail layout
Top:
- conference name / identity
- quick summary line if useful

Main body:
- standings table as primary content

Each standings row shows:
- standing position
- team name
- conference record
- overall record
- optional poll context

Purpose:
- standings are the heart of the conference screen
- deeper analytics can be added later if needed

---

## Rankings Tab — Detailed Design

### Default screen
- LSL Poll

### Rankings layout
Top:
- switcher for:
  - LSL Poll
  - LCAA Poll

Main body:
- rankings list

Each row shows:
- rank
- team name

Purpose:
- clean, official, easy-to-scan rankings surface
- analytics values intentionally stay out of this tab

---

## Design Principles Locked in This Phase

- Keep Home clean, scannable, and action-oriented
- Keep Teams richer than a plain list by showing poll + analytics context
- Keep Analytics special and destination-like
- Keep Conferences standings-first
- Keep Rankings official and uncluttered
- Preserve roster order exactly as defined in sheet lineup order
- Keep future features (Roster depth, Bracketology, Notifications) in mind without overloading v1 core screens

---

## Current Design Conclusion

The detailed screen design for the v1 core app shell is now locked for:
- Home
- Teams
- Analytics
- Conferences
- Rankings

This document should be used as the next bridge into actual app implementation planning.