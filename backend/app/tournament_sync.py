from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.logic_tournament import get_snake_region_index
from app.models_devices import TournamentBracket, TournamentSeedList
from app.db import AsyncSessionLocal
from sqlmodel import delete
import uuid

async def sync_official_tournament(season: int, region_order: list[str]):
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    range_name = "LCAA_Official_Field!A2:C81" 
    values = read_range(service, settings.MASTER_SHEET_ID, range_name)
    if not values: return {}

    field = [{"team_id": str(row[0]).strip().upper(), "overall_rank": int(row[1]), "is_autobid": str(row[2]).strip().upper() == "TRUE"} for row in values if len(row) >= 3]
    field.sort(key=lambda x: x['overall_rank'])

    async with AsyncSessionLocal() as session:
        # Wipe old data
        await session.execute(delete(TournamentBracket).where(TournamentBracket.season == season))
        await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))
        
        # 1. Save Seeds (Required stats included)
        for team in field:
            session.add(TournamentSeedList(
                season=season, team_id=team['team_id'], overall_rank=team['overall_rank'], 
                seed=(((team['overall_rank'] - 1) // 4) + 1), is_autobid=team['is_autobid'],
                resume_score=0.0, power_value=0.0, ppg=0.0, rpg=0.0, apg=0.0, fg_pct=0.0, three_pct=0.0, oppg=0.0, topg=0.0, fpg=0.0, games_played=0
            ))

        # 2. FINAL FOUR & CHAMPIONSHIP (Placeholders included)
        champ_id = str(uuid.uuid4())
        semi_1_id = str(uuid.uuid4()); semi_2_id = str(uuid.uuid4())
        
        # Common arguments to avoid repeating NotNull fields
        tbd = {"team_a_id": "TBD", "team_b_id": "TBD", "seed_a": 0, "seed_b": 0}

        session.add(TournamentBracket(id=champ_id, season=season, region="Final Four", round="Championship", game_slot=1, **tbd))
        session.add(TournamentBracket(id=semi_1_id, season=season, region="Final Four", round="National Semifinals", game_slot=1, next_game_id=champ_id, **tbd))
        session.add(TournamentBracket(id=semi_2_id, season=season, region="Final Four", round="National Semifinals", game_slot=2, next_game_id=champ_id, **tbd))

        # 3. REGIONAL GENERATION
        for idx, region_name in enumerate(region_order):
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            e8_id = str(uuid.uuid4())
            session.add(TournamentBracket(id=e8_id, season=season, region=region_name, round="Elite_8", game_slot=1, next_game_id=target_semi, **tbd))
            
            for s16 in range(1, 3):
                s16_id = str(uuid.uuid4())
                session.add(TournamentBracket(id=s16_id, season=season, region=region_name, round="Sweet_16", game_slot=s16, next_game_id=e8_id, **tbd))
                
                for r32 in range(1, 3):
                    r32_id = str(uuid.uuid4())
                    r32_slot = ((s16-1)*2)+r32
                    session.add(TournamentBracket(id=r32_id, season=season, region=region_name, round="Round_32", game_slot=r32_slot, next_game_id=s16_id, **tbd))
                    
                    for r64 in range(1, 3):
                        r64_id = str(uuid.uuid4())
                        r64_slot = ((r32_slot-1)*2)+r64
                        session.add(TournamentBracket(id=r64_id, season=season, region=region_name, round="Round_64", game_slot=r64_slot, next_game_id=r32_id, **tbd))
                        
                        # Add Survival 16 slots on the far edges
                        if r64_slot in [1, 8]: # Placeholder: Add more logic later
                            session.add(TournamentBracket(id=str(uuid.uuid4()), season=season, region=region_name, round="Survival_16", game_slot=r64_slot, next_game_id=r64_id, **tbd))

        await session.commit()
    return {"status": "Complete Structure Generated"}
