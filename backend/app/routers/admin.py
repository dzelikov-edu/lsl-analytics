from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import asyncio
from datetime import datetime

from app.deps_auth import get_current_user
from app.models_devices import User, TournamentState
from app.workers.push_sender import notify_team

from sqlmodel import select
from app.db import AsyncSessionLocal
from sqlalchemy import text  # ADD

router = APIRouter(prefix="/admin", tags=["admin"])

class TestPushRequest(BaseModel):
    teamId: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=1, max_length=100)
    body: str = Field(..., min_length=1, max_length=255)
    gameKey: str | None = Field(None, description="Optional game key for data payload")

@router.post("/send-test-push")
async def send_test_push(
    req: TestPushRequest,
    current_user: User = Depends(get_current_user)
):
    # Require admin
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    asyncio.create_task(
        notify_team(
            team_id=req.teamId.upper(),
            title=req.title,
            body=req.body,
            data={"game_key": req.gameKey, "team": req.teamId.upper()},
        )
    )
    return {"status": "success", "message": f"Test push for {req.teamId} enqueued"}


# --- LCAA TOURNAMENT ADMIN COMMANDS ---

from app.tournament_sync import sync_official_tournament

@router.post("/tournament/sync")
async def admin_sync_tournament(
    season: int = 2036,
    region_mapping: list[str] = ["West", "Midwest", "East", "South"], 
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    try:
        # 1. Trigger the sync
        regional_data = await sync_official_tournament(season, region_mapping)
        
        # 2. Re-enable Rematch Check
        from app.main import GLOBAL_GAMES_LIST
        from app.logic_tournament import check_pod_rematches
        
        all_warnings = []
        for region_name in region_mapping:
            teams = regional_data.get(region_name, [])
            all_warnings.extend(check_pod_rematches(teams, GLOBAL_GAMES_LIST))
        
        return {
            "status": "success",
            "teams_synced": sum(len(teams) for teams in regional_data.values()),
            "consultant_report": {
                "rematch_count": len(all_warnings),
                "rematch_alerts": all_warnings,
                "message": "Sync Success! 16 teams placed."
            }
        }
    except Exception as e:
        print(f"CRITICAL SYNC ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/db/upgrade-userbracketpick")
async def upgrade_userbracketpick(
    current_user: User = Depends(get_current_user),
):
    """
    One-time migration: add user_bracket_id column to userbracketpick.
    Safe to call multiple times (IF NOT EXISTS).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    async with AsyncSessionLocal() as session:
        # IF NOT EXISTS makes this idempotent
        await session.exec(text(
            "ALTER TABLE userbracketpick "
            "ADD COLUMN IF NOT EXISTS user_bracket_id VARCHAR"
        ))
        await session.commit()

    return {"status": "ok", "message": "user_bracket_id column ensured on userbracketpick"}

@router.post("/tournament/set-phase")
async def set_tournament_phase(
    phase: str, 
    season: int = 2036,
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")
    
    async with AsyncSessionLocal() as session:
        stmt = select(TournamentState).where(TournamentState.season == season)
        res = await session.exec(stmt)
        state = res.one_or_none()
        
        if not state:
            state = TournamentState(season=season, phase=phase)
            session.add(state)
        else:
            state.phase = phase
            state.updated_at = datetime.utcnow()
            
        await session.commit()
    return {"status": "success", "new_phase": phase}

@router.post("/db/create-state-table")
async def create_state_table(current_user: User = Depends(get_current_user)):
    # 1. Authority Check
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")
    
    # 2. Localized Imports (Prevents circular import issues)
    from app.db import engine
    from app.models_devices import SQLModel 
    
    # 3. Execution
    async with engine.begin() as conn:
        # This tells the DB: "Look at my models, if a table is missing, make it."
        await conn.run_sync(SQLModel.metadata.create_all)
        
    return {"status": "ok", "message": "Database schema synced successfully."}

@router.post("/tournament/sync-bracketology")
async def admin_sync_bracketology(
    season: int = 2036,
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    from app.sheets_client import get_sheets_service, read_range
    from app.settings import settings
    from app.models_devices import TournamentSeedList
    from app.db import AsyncSessionLocal
    from sqlmodel import delete

    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    # Target your SPECIFIC Bracketology tab
    values = read_range(service, settings.MASTER_SHEET_ID, "LCAA_Bracketology!A2:C81")
    
    if not values:
        raise HTTPException(status_code=404, detail="No data found in LCAA_Bracketology sheet.")

    field = [{"tid": str(row[0]).strip().upper(), "rank": int(row[1]), "auto": str(row[2]).strip().upper() == "TRUE"} for row in values if len(row) >= 3]

    async with AsyncSessionLocal() as session:
        # Only clear the Seeds for this season, don't touch the Official Bracket tables
        await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))

        for f in field:
            seed_entry = TournamentSeedList(
                season=season,
                team_id=f['tid'],
                overall_rank=f['rank'],
                seed=((f['rank']-1)//5)+1,
                is_autobid=f['auto']
            )
            session.add(seed_entry)
        
        await session.commit()

    return {"status": "success", "teams_synced": len(field), "message": "Bracketology Rank List Updated."}
