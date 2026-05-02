from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.models_devices import TournamentBracket, TournamentSeedList, UserBracketPick  # ADD UserBracketPick
from app.db import AsyncSessionLocal
from sqlmodel import delete, select  # ADD select
import uuid

# THE SEEDING ENGINE MAP (Rank to Slot)
# Based on your "To a T" outline
REGION_MAP = {
    1: { # Region 1 (Top Left)
        1: {"a": 1, "b_is_playin": True, "p_a": 79, "p_b": 80, "seed_a": 1, "seed_b": 16},
        2: {"a": 32, "b": 33, "seed_a": 8, "seed_b": 9},
        3: {"a": 17, "b": 60, "seed_a": 5, "seed_b": 12},
        4: {"a": 16, "b": 61, "seed_a": 4, "seed_b": 13},
        5: {"a": 24, "b_is_playin": True, "p_a": 47, "p_b": 48, "seed_a": 6, "seed_b": 11},
        6: {"a": 9, "b": 68, "seed_a": 3, "seed_b": 14},
        7: {"a": 25, "b_is_playin": True, "p_a": 45, "p_b": 46, "seed_a": 7, "seed_b": 10},
        8: {"a": 8, "b": 69, "seed_a": 2, "seed_b": 15},
    },
    2: { # Region 2 (Top Right)
        1: {"a": 2, "b_is_playin": True, "p_a": 77, "p_b": 78, "seed_a": 1, "seed_b": 16},
        2: {"a": 31, "b": 34, "seed_a": 8, "seed_b": 9},
        3: {"a": 18, "b": 59, "seed_a": 5, "seed_b": 12},
        4: {"a": 15, "b": 62, "seed_a": 4, "seed_b": 13},
        5: {"a": 23, "b_is_playin": True, "p_a": 49, "p_b": 50, "seed_a": 6, "seed_b": 11},
        6: {"a": 10, "b": 67, "seed_a": 3, "seed_b": 14},
        7: {"a": 26, "b_is_playin": True, "p_a": 43, "p_b": 44, "seed_a": 7, "seed_b": 10},
        8: {"a": 7, "b": 70, "seed_a": 2, "seed_b": 15},
    },
    3: { # Region 3 (Bottom Right)
        1: {"a": 3, "b_is_playin": True, "p_a": 75, "p_b": 76, "seed_a": 1, "seed_b": 16},
        2: {"a": 30, "b_is_playin": True, "p_a": 35, "p_b": 36, "seed_a": 8, "seed_b": 9},
        3: {"a": 19, "b_is_playin": True, "p_a": 57, "p_b": 58, "seed_a": 5, "seed_b": 12},
        4: {"a": 14, "b": 63, "seed_a": 4, "seed_b": 13},
        5: {"a": 22, "b_is_playin": True, "p_a": 51, "p_b": 52, "seed_a": 6, "seed_b": 11},
        6: {"a": 11, "b": 66, "seed_a": 3, "seed_b": 14},
        7: {"a": 27, "b_is_playin": True, "p_a": 41, "p_b": 42, "seed_a": 7, "seed_b": 10},
        8: {"a": 6, "b": 71, "seed_a": 2, "seed_b": 15},
    },
    4: { # Region 4 (Bottom Left)
        1: {"a": 4, "b_is_playin": True, "p_a": 73, "p_b": 74, "seed_a": 1, "seed_b": 16},
        2: {"a": 29, "b_is_playin": True, "p_a": 37, "p_b": 38, "seed_a": 8, "seed_b": 9},
        3: {"a": 20, "b_is_playin": True, "p_a": 55, "p_b": 56, "seed_a": 5, "seed_b": 12},
        4: {"a": 13, "b": 64, "seed_a": 4, "seed_b": 13},
        5: {"a": 21, "b_is_playin": True, "p_a": 53, "p_b": 54, "seed_a": 6, "seed_b": 11},
        6: {"a": 12, "b": 65, "seed_a": 3, "seed_b": 14},
        7: {"a": 28, "b_is_playin": True, "p_a": 39, "p_b": 40, "seed_a": 7, "seed_b": 10},
        8: {"a": 5, "b": 72, "seed_a": 2, "seed_b": 15},
    }
}

async def sync_official_tournament(season: int, region_order: list[str]):
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    values = read_range(service, settings.MASTER_SHEET_ID, "LCAA_Official_Field!A2:C81")
    if not values: return {}

    field = [{"tid": str(row[0]).strip().upper(), "rank": int(row[1]), "auto": str(row[2]).strip().upper() == "TRUE"} for row in values if len(row) >= 3]
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
