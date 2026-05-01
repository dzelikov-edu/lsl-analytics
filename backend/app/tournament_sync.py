from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.logic_tournament import get_snake_region_index
from app.models_devices import TournamentBracket, TournamentSeedList
from app.db import AsyncSessionLocal
from sqlmodel import delete
import uuid

async def sync_official_tournament(season: int, region_order: list[str]):
    # ... (Keep your sheet reading and SeedList wipe code at the top) ...
    # (Assume field is already parsed and sorted)

    async with AsyncSessionLocal() as session:
        await session.execute(delete(TournamentBracket).where(TournamentBracket.season == season))
        await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))

        # 1. FINAL FOUR & CHAMPIONSHIP
        champ_id = str(uuid.uuid4())
        semi_1_id = str(uuid.uuid4()); semi_2_id = str(uuid.uuid4())
        session.add(TournamentBracket(id=champ_id, season=season, region="Final Four", round="Championship", game_slot=1))
        session.add(TournamentBracket(id=semi_1_id, season=season, region="Final Four", round="National Semifinals", game_slot=1, next_game_id=champ_id))
        session.add(TournamentBracket(id=semi_2_id, season=season, region="Final Four", round="National Semifinals", game_slot=2, next_game_id=champ_id))

        # 2. REGIONAL GENERATION
        for idx, region_name in enumerate(region_order):
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            e8_id = str(uuid.uuid4())
            session.add(TournamentBracket(id=e8_id, season=season, region=region_name, round="Elite_8", game_slot=1, next_game_id=target_semi))
            
            for s16 in range(1, 3):
                s16_id = str(uuid.uuid4())
                session.add(TournamentBracket(id=s16_id, season=season, region=region_name, round="Sweet_16", game_slot=s16, next_game_id=e8_id))
                
                for r32 in range(1, 3):
                    r32_id = str(uuid.uuid4())
                    r32_slot = ((s16-1)*2)+r32
                    session.add(TournamentBracket(id=r32_id, season=season, region=region_name, round="Round_32", game_slot=r32_slot, next_game_id=s16_id))
                    
                    for r64 in range(1, 3):
                        r64_id = str(uuid.uuid4())
                        r64_slot = ((r32_slot-1)*2)+r64
                        
                        # Link R64 to Survival 16 if applicable
                        # Seeds 10, 11, 16 + (9, 12 in specific regions)
                        # We'll just generate placeholders for now to see them on the map
                        session.add(TournamentBracket(id=r64_id, season=season, region=region_name, round="Round_64", game_slot=r64_slot, next_game_id=r32_id))
                        
                        # NEW: Add a Survival 16 game feeding into specific R64 slots
                        # (We will refine the logic for which slots get play-ins next)
                        if r64_slot in [1, 8]: # Example: 1v16 and the last game
                            s16_playin_id = str(uuid.uuid4())
                            session.add(TournamentBracket(id=s16_playin_id, season=season, region=region_name, round="Survival_16", game_slot=r64_slot, next_game_id=r64_id))

        await session.commit()
    return regional_data
