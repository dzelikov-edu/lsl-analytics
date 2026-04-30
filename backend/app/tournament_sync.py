from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.logic_tournament import get_snake_region_index
from app.models_devices import TournamentBracket, TournamentSeedList
from app.db import AsyncSessionLocal
from sqlmodel import select, delete
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

    async with AsyncSessionLocal() as session:
        # 1. Wipe old data
        await session.execute(delete(TournamentBracket).where(TournamentBracket.season == season))
        await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))
        
        # 2. Assign Regions and SAVE SEEDS
        regional_data = {region: [] for region in region_order}
        for team in field:
            seed_num = ((team['overall_rank'] - 1) // 4) + 1
            region_idx = get_snake_region_index(team['overall_rank'])
            region_name = region_order[region_idx]
            
            # --- SURGICAL FIX START ---
            session.add(TournamentSeedList(
                season=season, 
                team_id=team['team_id'], 
                overall_rank=team['overall_rank'], 
                seed=seed_num,
                is_autobid=team['is_autobid'],
                # FIX: Providing the required default values
                resume_score=0.0,
                power_value=0.0,
                ppg=0.0,
                rpg=0.0,
                apg=0.0,
                fg_pct=0.0,
                three_pct=0.0,
                oppg=0.0,
                topg=0.0,
                fpg=0.0,
                games_played=0
            ))
            # --- SURGICAL FIX END ---
            
            team['seed'] = seed_num
            team['region'] = region_name
            regional_data[region_name].append(team)

        # 3. Create the Minimal Structure (TBD games)
        champ_id = str(uuid.uuid4())
        semi_1_id = str(uuid.uuid4())
        semi_2_id = str(uuid.uuid4())

        session.add(TournamentBracket(id=champ_id, season=season, region="Final Four", round="Championship", game_slot=1, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))
        session.add(TournamentBracket(id=semi_1_id, season=season, region="Final Four", round="National Semifinals", game_slot=1, next_game_id=champ_id, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))
        session.add(TournamentBracket(id=semi_2_id, season=season, region="Final Four", round="National Semifinals", game_slot=2, next_game_id=champ_id, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))

        for idx, region_name in enumerate(region_order):
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            session.add(TournamentBracket(id=str(uuid.uuid4()), season=season, region=region_name, round="Elite_8", game_slot=1, next_game_id=target_semi, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))

        await session.commit()
    return regional_data
