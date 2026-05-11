# backend/app/players_sync.py

from datetime import datetime
from sqlmodel import delete
from app.db import AsyncSessionLocal
from app.ingest import load_players_snapshot
from app.models_devices import PlayerSnapshot

async def refresh_players_snapshot_cache() -> dict:
    """
    Reads the PlayersSnapshot Google Sheet and replaces the PlayerSnapshot
    table contents with the latest snapshot.
    Admin-only endpoint in routers/admin will call this.
    """
    rows = load_players_snapshot()  # Sheets read, one shot

    async with AsyncSessionLocal() as session:
        # Wipe existing snapshot
        await session.execute(delete(PlayerSnapshot))
        await session.commit()

        # Insert fresh rows
        for r in rows:
            ps = PlayerSnapshot(
                team_id=str(r["team_id"]).strip().upper(),
                player_id=str(r["player_id"]).strip().upper(),
                player_name=str(r["player_name"]).strip(),

                jersey_number=str(r.get("jersey_number") or "").strip() or None,
                primary_position=str(r.get("primary_position") or "").strip() or None,
                secondary_position=str(r.get("secondary_position") or "").strip() or None,
                height=str(r.get("height") or "").strip() or None,
                weight=str(r.get("weight") or "").strip() or None,
                player_class=str(r.get("class") or r.get("class_") or r.get("class", "")).strip() or None,
                home_city=str(r.get("home_city") or "").strip() or None,
                home_state_region=str(r.get("home_state_region") or "").strip() or None,
                home_country=str(r.get("home_country") or "").strip() or None,
                prev_team_id=str(r.get("prev_team_id") or "").strip().upper() or None,
                prev_team_name=str(r.get("prev_team_name") or "").strip() or None,

                games_played=r.get("games_played"),
                ppg=r.get("ppg"),
                rpg=r.get("rpg"),
                apg=r.get("apg"),
                spg=r.get("spg"),
                bpg=r.get("bpg"),
                fg_pct=r.get("fg_pct"),
                three_pct=r.get("three_pct"),
                ft_pct=r.get("ft_pct"),

                prev_games_played=r.get("prev_games_played"),
                prev_ppg=r.get("prev_ppg"),
                prev_rpg=r.get("prev_rpg"),
                prev_apg=r.get("prev_apg"),
                prev_spg=r.get("prev_spg"),
                prev_bpg=r.get("prev_bpg"),
                prev_fg_pct=r.get("prev_fg_pct"),
                prev_three_pct=r.get("prev_three_pct"),
                prev_ft_pct=r.get("prev_ft_pct"),

                notes=str(r.get("notes") or "").strip() or None,
                updated_at=datetime.utcnow(),
            )
            session.add(ps)

        await session.commit()

    return {"rows_imported": len(rows)}
