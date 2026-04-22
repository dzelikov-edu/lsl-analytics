from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import asyncio

from app.deps_auth import get_current_user
from app.models_devices import User
from app.workers.push_sender import notify_team

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
    # Optional: Add check here if current_user.is_admin is true for real admin endpoint
    # For now, any authenticated user can trigger this.

    # Ensure the push notification is sent in the background
    # so the API call returns immediately.
    asyncio.create_task(
        notify_team(
            team_id=req.teamId,
            title=req.title,
            body=req.body,
            data={"game_key": req.gameKey, "team": req.teamId}
        )
    )
    return {"status": "success", "message": f"Test push for {req.teamId} enqueued"}
