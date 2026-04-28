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
