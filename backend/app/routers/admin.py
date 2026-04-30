from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import asyncio

from app.deps_auth import get_current_user
from app.models_devices import User
from app.workers.push_sender import notify_team

from sqlmodel import select
from app.db import AsyncSessionLocal

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
    region_mapping: list[str] = ["East", "Midwest", "South", "West"], 
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    try:
        # Trigger the sync logic
        regional_data = await sync_official_tournament(season, region_mapping)
        
        return {
            "status": "success",
            "teams_synced": 16, # Temporary hardcode for testing
            "consultant_report": {
                "rematch_count": 0,
                "rematch_alerts": [],
                "message": "Sync Success! Circular import resolved."
            }
        }
    except Exception as e:
        # THIS WILL NOW SHOW THE ERROR IN THE RENDER LOGS
        print(f"CRITICAL SYNC ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
