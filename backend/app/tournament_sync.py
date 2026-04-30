from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.logic_tournament import get_snake_region_index
# IMPORT UserBracketPick to clear it first
from app.models_devices import TournamentBracket, TournamentSeedList, UserBracketPick 
from app.db import AsyncSessionLocal
from sqlmodel import select, delete
import uuid

async def sync_official_tournament(season: int, region_order: list[str]):
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    range_name = "LCAA_Official_Field!A2:C81" 
    values = read_range(service, settings.MASTER_SHEET_ID, range_name)

    if not values: 
        print("Sheet is empty.")
        return {}

    # 1. Parse the field
    field = []
    for row in values:
        if len(row) < 3: continue
        field.append({
            "team_id": str(row[0]).strip().upper(),
            "overall_rank": int(row[1]),
            "is_autobid": str(row[2]).strip().upper() == "TRUE"
        })

    async with AsyncSessionLocal() as session:
        try:
            # --- SURGERY: DELETE IN CORRECT ORDER ---
            # We must delete the 'Picks' before the 'Bracket' or Postgres will fail.
            # We'll clear picks for any bracket game in this season.
            bracket_ids_statement = select(TournamentBracket.id).where(TournamentBracket.season == season)
            bracket_ids_res = await session.exec(bracket_ids_statement)
            ids_to_clear = bracket_ids_res.all()

            if ids_to_clear:
                await session.execute(delete(UserBracketPick).where(UserBracketPick.tournament_game_id.in_(ids_to_clear)))
            
            # Now safe to clear the bracket and seeds
            await session.execute(delete(TournamentBracket).where(TournamentBracket.season == season))
            await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))
            
            # 2. Map Teams to Regions
            regional_data = {region: [] for region in region_order}
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
                
                team['seed'] = seed_num
                team['region'] = region_name
                regional_data[region_name].append(team)

            # 3. Build Structural Skeleton (Final Four)
            champ_id = str(uuid.uuid4())
            semi_1_id = str(uuid.uuid4()) 
            semi_2_id = str(uuid.uuid4()) 

            # Add Championship
            session.add(TournamentBracket(id=champ_id, season=season, region="Final Four", round="Championship", game_slot=1, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))
            # Add Semis
            session.add(TournamentBracket(id=semi_1_id, season=season, region="Final Four", round="National Semifinals", game_slot=1, next_game_id=champ_id, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))
            session.add(TournamentBracket(id=semi_2_id, season=season, region="Final Four", round="National Semifinals", game_slot=2, next_game_id=champ_id, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0))

            # 4. Build Regional Elite 8 Slots
            for idx, region_name in enumerate(region_order):
                target_semi = semi_1_id if idx in [0, 3] else semi_2_id
                session.add(TournamentBracket(
                    id=str(uuid.uuid4()), season=season, region=region_name, round="Elite_8", 
                    game_slot=1, next_game_id=target_semi, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0
                ))

            await session.commit()
            return regional_data

        except Exception as e:
            await session.rollback()
            raise e
