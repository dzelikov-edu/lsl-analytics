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

@router.post("/promote-self-to-admin")
async def promote_self_to_admin(current_user: User = Depends(get_current_user)):
    """
    TEMP: Promote the current user to admin for beta.
    Call this once while logged in as your account, then remove or ignore.
    """
    async with AsyncSessionLocal() as session:
        # Re-load the user in a writeable session
        stmt = select(User).where(User.id == current_user.id)
        res = await session.exec(stmt)
        user = res.one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.is_admin:
            return {"ok": True, "message": "Already an admin."}

        user.is_admin = True
        session.add(user)
        await session.commit()
        return {"ok": True, "message": f"User {user.email} is now an admin."}
