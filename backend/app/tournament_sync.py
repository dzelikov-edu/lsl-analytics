from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.logic_tournament import get_snake_region_index
from app.models_devices import TournamentBracket, TournamentSeedList
from app.db import AsyncSessionLocal
from sqlmodel import select, delete # Add delete here
import uuid

async def sync_official_tournament(season: int, region_order: list[str]):
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    range_name = "LCAA_Official_Field!A2:C81" 
    values = read_range(service, settings.MASTER_SHEET_ID, range_name)

    if not values: 
        print("Sheet is empty.")
        return {}

    field = []
    for row in values:
        if len(row) < 3: continue
        field.append({
            "team_id": str(row[0]).strip().upper(),
            "overall_rank": int(row[1]),
            "is_autobid": str(row[2]).strip().upper() == "TRUE"
        })

    async with AsyncSessionLocal() as session:
        # --- SAFE CLEANSE ---
        # Instead of raw SQL, we use SQLModel delete
        await session.execute(delete(TournamentBracket).where(TournamentBracket.season == season))
        await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))
        
        # 1. Map Teams to Regions
        regional_data = {region: [] for region in region_order}
        for team in field:
            seed_num = ((team['overall_rank'] - 1) // 4) + 1
            region_idx = get_snake_region_index(team['overall_rank'])
            region_name = region_order[region_idx]
            
            # Create Seed Entry
            seed_entry = TournamentSeedList(
                season=season, team_id=team['team_id'], 
                overall_rank=team['overall_rank'], seed=seed_num,
                is_autobid=team['is_autobid']
            )
            session.add(seed_entry)
            
            team['seed'] = seed_num
            team['region'] = region_name
            regional_data[region_name].append(team)

        # 2. Build Structural Skeleton (Final Four)
        champ_id = str(uuid.uuid4())
        semi_1_id = str(uuid.uuid4()) 
        semi_2_id = str(uuid.uuid4()) 

        session.add(TournamentBracket(id=champ_id, season=season, region="National Championship", round="Championship", game_slot=1, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))
        session.add(TournamentBracket(id=semi_1_id, season=season, region="National Semifinals", round="Final Four", game_slot=1, next_game_id=champ_id, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))
        session.add(TournamentBracket(id=semi_2_id, season=season, region="National Semifinals", round="Final Four", game_slot=2, next_game_id=champ_id, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))

        # 3. Build Regional Elite 8 Slots
        for idx, region_name in enumerate(region_order):
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            session.add(TournamentBracket(
                id=str(uuid.uuid4()), season=season, region=region_name, round="Elite_8", 
                game_slot=1, next_game_id=target_semi, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0
            ))

        await session.commit()
    
    return regional_data
