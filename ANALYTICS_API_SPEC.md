# Analytics API Spec (Draft)

Purpose:
- Defines the planned v1 API contract for the dedicated mobile Analytics tab.
- Additive only: these routes should be implemented without rewriting existing endpoints unless absolutely necessary.
- Existing endpoints remain the source of truth for their current surfaces.

Design rules:
- Keep response shapes consistent with current backend style.
- Prefer additive changes over rewrites.
- Reuse shared blocks where possible: `week`, `meta`, `count`, `items`, `polls`, `links`, `record`.
- Polls are display context only for analytics endpoints unless explicitly part of the metric definition.
- Evaluation week should be supported on all analytics routes.

---

## GET /analytics

Purpose:
- Powers the Analytics tab overview screen.

Query params:
- `week` (optional)

Returns:
- evaluation week
- overview metadata
- leaders for Power, Resume, Form, and SOS
- featured insight cards
- compact preview tables for each metric

Response shape:
```json
{
  "week": 0,
  "meta": {
    "title": "Analytics",
    "subtitle": "League-wide advanced team metrics",
    "metrics_available": ["power", "resume", "form", "sos"]
  },
  "leaders": {
    "power": {
      "rank": 1,
      "team_id": "CRE",
      "team_name": "Creighton",
      "value": 92.4,
      "links": {
        "team": "/teams/CRE",
        "analytics": "/analytics/power"
      }
    },
    "resume": {
      "rank": 1,
      "team_id": "KU",
      "team_name": "Kansas",
      "value": 89.7,
      "links": {
        "team": "/teams/KU",
        "analytics": "/analytics/resume"
      }
    },
    "form": {
      "rank": 1,
      "team_id": "MARQ",
      "team_name": "Marquette",
      "value": 87.3,
      "links": {
        "team": "/teams/MARQ",
        "analytics": "/analytics/form"
      }
    },
    "sos": {
      "rank": 1,
      "team_id": "MICH",
      "team_name": "Michigan",
      "value": 84.1,
      "links": {
        "team": "/teams/MICH",
        "analytics": "/analytics/sos"
      }
    }
  },
  "featured_insights": [
    {
      "type": "power_resume_gap",
      "title": "Biggest Power/Resume Gap",
      "team_id": "OKST",
      "team_name": "Oklahoma State",
      "summary": "#2 Power, #11 Resume",
      "links": {
        "team": "/teams/OKST"
      }
    }
  ],
  "top_tables": {
    "power": [],
    "resume": [],
    "form": [],
    "sos": []
  }
}