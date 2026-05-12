from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.models_devices import TournamentBracket, TournamentSeedList, UserBracketPick  # ADD UserBracketPick
from app.db import AsyncSessionLocal
from sqlmodel import delete, select  # ADD select
from typing import Optional
import uuid

from app.bracket_constants import REGION_MAP

async def sync_official_tournament(season: int, region_order: list[str]):
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    # 1. Expand range to N
    values = read_range(service, settings.MASTER_SHEET_ID, "LCAA_Official_Field!A2:N81")
    if not values: return {}

    # Update the field parsing logic
    field = []
    for row in values:
        if len(row) < 3: continue
        field.append({
            "tid": str(row[0]).strip().upper(), 
            "rank": int(row[1]), 
            "auto": str(row[2]).strip().upper() == "TRUE",
            "stats": row # keep row for the loop below
        })
    
    rank_map = {f['rank']: f['tid'] for f in field}

    async with AsyncSessionLocal() as session:
        # First, delete any user picks that reference this season's games
        result = await session.exec(
            select(TournamentBracket.id).where(TournamentBracket.season == season)
        )
        game_ids = result.all()
        if game_ids:
            await session.execute(
                delete(UserBracketPick).where(UserBracketPick.tournament_game_id.in_(game_ids))
            )

        # Then clear out the bracket + seed list for this season
        await session.execute(delete(TournamentBracket).where(TournamentBracket.season == season))
        await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))

        # --- UPDATED ROBUST STATS LOOP ---
        for f in field:
            # Safer helper: checks row length before accessing
            def get_s(idx):
                try:
                    # Check if the row actually has this column
                    if idx >= len(f['stats']): 
                        return 0.0
                    v = str(f['stats'][idx]).strip().replace('%', '').replace(',', '')
                    return float(v) if v else 0.0
                except: 
                    return 0.0

            session.add(TournamentSeedList(
                season=season,
                team_id=f['tid'],
                overall_rank=f['rank'],
                seed=((f['rank']-1)//5)+1,
                is_autobid=f['auto'],
                # MAPPING COLUMNS D-N WITH SAFETY
                ppg=get_s(3),
                rpg=get_s(4),
                apg=get_s(5),
                spg=get_s(6),
                bpg=get_s(7),
                fg_pct=get_s(8),
                three_pct=get_s(9),
                ft_pct=get_s(10),
                oppg=get_s(11),
                topg=get_s(12),
                fpg=get_s(13),
                resume_score=0.0,
                power_value=0.0
            ))
        # ---------------------------------

        # 1. FINAL FOUR SKELETON
        champ_id = str(uuid.uuid4())
        semi_1_id = str(uuid.uuid4()); semi_2_id = str(uuid.uuid4())
        tbd = {"team_a_id": "TBD", "team_b_id": "TBD", "seed_a": 0, "seed_b": 0}
        session.add(TournamentBracket(id=champ_id, season=season, region="Final Four", round="Championship", game_slot=1, **tbd))
        session.add(TournamentBracket(id=semi_1_id, season=season, region="Final Four", round="National Semifinals", game_slot=1, next_game_id=champ_id, **tbd))
        session.add(TournamentBracket(id=semi_2_id, season=season, region="Final Four", round="National Semifinals", game_slot=2, next_game_id=champ_id, **tbd))

        # 2. REGIONAL GENERATION
        for idx, region_name in enumerate(region_order):
            region_num = idx + 1
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            e8_id = str(uuid.uuid4())
            session.add(TournamentBracket(id=e8_id, season=season, region=region_name, round="Elite_8", game_slot=1, next_game_id=target_semi, **tbd))
            
            for s16_slot in range(1, 3):
                s16_id = str(uuid.uuid4())
                session.add(TournamentBracket(id=s16_id, season=season, region=region_name, round="Sweet_16", game_slot=s16_slot, next_game_id=e8_id, **tbd))
                
                for r32_slot in range(1, 3):
                    r32_id = str(uuid.uuid4())
                    r32_abs_slot = ((s16_slot-1)*2)+r32_slot
                    session.add(TournamentBracket(id=r32_id, season=season, region=region_name, round="Round_32", game_slot=r32_abs_slot, next_game_id=s16_id, **tbd))
                    
                    for r64_sub in range(1, 3):
                        slot_num = ((r32_abs_slot-1)*2)+r64_sub
                        r64_id = str(uuid.uuid4())
                        cfg = REGION_MAP[region_num][slot_num]
                        
                        team_a = rank_map.get(cfg['a'], "TBD")
                        team_b = rank_map.get(cfg.get('b'), "TBD")

                        if cfg.get("b_is_playin"):
                            p_id = str(uuid.uuid4())
                            session.add(TournamentBracket(
                                id=p_id, season=season, region=region_name, round="Survival_16",
                                game_slot=slot_num, next_game_id=r64_id,
                                team_a_id=rank_map.get(cfg['p_a'], "TBD"),
                                team_b_id=rank_map.get(cfg['p_b'], "TBD"),
                                seed_a=cfg['seed_b'], seed_b=cfg['seed_b']
                            ))
                            team_b = "TBD"

                        session.add(TournamentBracket(
                            id=r64_id, season=season, region=region_name, round="Round_64",
                            game_slot=slot_num, next_game_id=r32_id,
                            team_a_id=team_a, team_b_id=team_b,
                            seed_a=cfg['seed_a'], seed_b=cfg['seed_b']
                        ))

        await session.commit()
    return {"status": "Symmetric Outline Synced Successfully"}

async def refresh_official_tournament(
    season: int,
    region_order: Optional[list[str]] = None,
) -> dict:
    """
    Thin wrapper around sync_official_tournament used by admin/cron paths.

    - Keeps bracket-building logic in one place.
    - Lets us standardize region_order from config or a default.
    """
    # If no custom region order provided, use your current logical default.
    default_region_order = ["West", "Midwest", "East", "South"]
    use_regions = region_order or default_region_order

    result = await sync_official_tournament(season=season, region_order=use_regions)
    # Ensure we always return a simple JSON-serializable dict
    return result or {"status": "ok"}
