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
