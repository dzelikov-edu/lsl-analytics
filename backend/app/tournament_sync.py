from app.sheets_client import get_sheets_service, read_range
from app.settings import settings
from app.logic_tournament import get_snake_region_index
from app.models_devices import TournamentBracket, TournamentSeedList
from app.db import AsyncSessionLocal
from sqlmodel import select
import uuid

async def sync_official_tournament(season: int, region_order: list[str]):
    """
    Reads the LCAA_Official_Field from Sheets, 
    applies Snake Seeding + Survival 16 logic,
    and saves to Postgres.
    """
    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    range_name = "LCAA_Official_Field!A2:C81" 
    values = read_range(service, settings.MASTER_SHEET_ID, range_name)

    if not values:
        print("No data found in LCAA_Official_Field.")
        return {}

    field = []
    for row in values:
        if len(row) < 3: continue
        field.append({
            "team_id": str(row[0]).strip().upper(),
            "overall_rank": int(row[1]),
            "is_autobid": str(row[2]).strip().upper() == "TRUE"
        })

    # Sort by overall rank to ensure S-Curve is accurate
    field.sort(key=lambda x: x['overall_rank'])

    # 1. Map Teams to Regions using the Human-Decided Geographic order
    regional_data = {region: [] for region in region_order}
    for team in field:
        seed_num = ((team['overall_rank'] - 1) // 4) + 1
        region_idx = get_snake_region_index(team['overall_rank'])
        region_name = region_order[region_idx]
        
        team['seed'] = seed_num
        team['region'] = region_name
        regional_data[region_name].append(team)

    # 2. Database Sync (One Session for Performance)
    async with AsyncSessionLocal() as session:
        print(f"Syncing {len(field)} teams into the {season} LCAA Bracket...")
        
        # A. Save the Master Seed List
        for team in field:
            seed_entry = TournamentSeedList(
                season=season,
                team_id=team['team_id'],
                overall_rank=team['overall_rank'],
                seed=team['seed'],
                is_autobid=team['is_autobid'],
                resume_score=0.0,
                power_value=0.0
            )
            await session.merge(seed_entry)

        # B. Map the National Semifinal Slots (1v4 and 2v3)
        # We generate fixed IDs so the Elite 8 knows where to point
        semi_1_id = str(uuid.uuid4()) # Path for Region 0 winner vs Region 3 winner
        semi_2_id = str(uuid.uuid4()) # Path for Region 1 winner vs Region 2 winner
        champ_id = str(uuid.uuid4())  # The National Championship Slot

        # C. Create Semifinal and Championship Game Slots
        session.add(TournamentBracket(
            id=semi_1_id, season=season, region="National Semifinals", round="Final Four",
            game_slot=1, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0, next_game_id=champ_id
        ))
        session.add(TournamentBracket(
            id=semi_2_id, season=season, region="National Semifinals", round="Final Four",
            game_slot=2, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0, next_game_id=champ_id
        ))
        session.add(TournamentBracket(
            id=champ_id, season=season, region="National Championship", round="Championship",
            game_slot=1, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0
        ))

        # D. Generate Elite 8 Games and Link them to the Semis
        for idx, region_name in enumerate(region_order):
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            elite_8 = TournamentBracket(
                id=str(uuid.uuid4()), season=season, region=region_name, round="Elite 8",
                game_slot=1, team_a_id="TBD", team_b_id="TBD", seed_a=0, seed_b=0,
                next_game_id=target_semi
            )
            session.add(elite_8)

        await session.commit()
        
    print(f"✅ {season} Tournament Structure synced with 1v4 and 2v3 Semifinal paths.")
    return regional_data
