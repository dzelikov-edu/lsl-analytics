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
    # This list maps to S-Curve ranks 1, 2, 3, and 4 respectively.
    # If the #1 overall is Midwest and #2 is East, you'd pass ["Midwest", "East", ...]
    region_mapping: list[str] = ["East", "Midwest", "South", "West"], 
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    if len(region_mapping) != 4:
        raise HTTPException(status_code=400, detail="Must provide exactly 4 regions.")

    try:
        # Pass the human-mapped geographic order to the sync engine
        regional_data = await sync_official_tournament(season, region_mapping)
        
        from app.main import GLOBAL_GAMES_LIST
        from app.logic_tournament import check_pod_rematches
        
        all_warnings = []
        for region_name in region_mapping:
            teams = regional_data.get(region_name, [])
            all_warnings.extend(check_pod_rematches(teams, GLOBAL_GAMES_LIST))
        
        return {
            "status": "success",
            "message": f"Sync Complete. #1 Overall assigned to {region_mapping[0]}.",
            "consultant_report": {
                "rematch_alerts": all_warnings
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")
