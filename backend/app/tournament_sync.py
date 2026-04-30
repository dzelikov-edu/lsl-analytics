from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.logic_tournament import get_snake_region_index
from app.models_devices import TournamentBracket, TournamentSeedList
from app.db import AsyncSessionLocal
from sqlmodel import select
from sqlalchemy import text
import uuid

async def sync_official_tournament(season: int, region_order: list[str]):
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    range_name = "LCAA_Official_Field!A2:C81" 
    values = read_range(service, settings.MASTER_SHEET_ID, range_name)

    if not values: return {}

    field = []
    for row in values:
        if len(row) < 3: continue
        field.append({
            "team_id": str(row[0]).strip().upper(),
            "overall_rank": int(row[1]),
            "is_autobid": str(row[2]).strip().upper() == "TRUE"
        })
    field.sort(key=lambda x: x['overall_rank'])

    async with AsyncSessionLocal() as session:
        # --- SURGERY: CLEAR OLD DATA FIRST ---
        # This prevents the 'MESS' of duplicate game slots
        await session.execute(text(f"DELETE FROM tournamentbracket WHERE season = {season}"))
        await session.execute(text(f"DELETE FROM tournamentseedlist WHERE season = {season}"))
        
        # 1. Save Seeds
        for team in field:
            seed_num = ((team['overall_rank'] - 1) // 4) + 1
            region_idx = get_snake_region_index(team['overall_rank'])
            region_name = region_order[region_idx]
            
            seed_entry = TournamentSeedList(
                season=season, team_id=team['team_id'], 
                overall_rank=team['overall_rank'], seed=seed_num,
                is_autobid=team['is_autobid']
            )
            session.add(seed_entry)

        # 2. Generate Final Four Structure (Your 1v4, 2v3 Rule)
        champ_id = str(uuid.uuid4())
        semi_1_id = str(uuid.uuid4()) # Winner Region 0 vs 3
        semi_2_id = str(uuid.uuid4()) # Winner Region 1 vs 2

        session.add(TournamentBracket(id=champ_id, season=season, region="Final Four", round="Championship", game_slot=1))
        session.add(TournamentBracket(id=semi_1_id, season=season, region="Final Four", round="National Semifinals", game_slot=1, next_game_id=champ_id))
        session.add(TournamentBracket(id=semi_2_id, season=season, region="Final Four", round="National Semifinals", game_slot=2, next_game_id=champ_id))

        # 3. Generate Regional Brackets (R64 -> R32 -> S16 -> E8)
        for idx, region_name in enumerate(region_order):
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            
            # ELITE 8 (1 game per region)
            e8_id = str(uuid.uuid4())
            session.add(TournamentBracket(id=e8_id, season=season, region=region_name, round="Elite_8", game_slot=1, next_game_id=target_semi))
            
            # SWEET 16 (2 games per region)
            for s in range(1, 3):
                s16_id = str(uuid.uuid4())
                session.add(TournamentBracket(id=s16_id, season=season, region=region_name, round="Sweet_16", game_slot=s, next_game_id=e8_id))
                
                # ROUND OF 32 (4 games per region)
                # (We will expand R64 and Survival 16 in the next pass once we verify this works)

        await session.commit()
    return {"status": "Structure Reset"}
