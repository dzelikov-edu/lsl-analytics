from fastapi_limiter.depends import RateLimiter
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import re
from app.deps_auth import get_current_user
from app.crud_devices import create_or_update_device, remove_device, list_favorites, add_favorite, remove_favorite
from sqlmodel import select
from app.db import AsyncSessionLocal
from app.models_devices import Device, User


router = APIRouter(prefix="/api", tags=["devices", "favorites"])

# Device token registration request
class DeviceRegisterRequest(BaseModel):
    # Expo tokens are typically ExponentPushToken[...] or ExpoPushToken[...]
    expoPushToken: str = Field(..., min_length=10, max_length=100, description="The Expo push token")
    deviceId: Optional[str] = Field(None, max_length=100, description="A unique device identifier")
    platform: Optional[str] = Field(None, max_length=20, pattern="^(ios|android|web)$", description="The device platform")

class FavoriteRequest(BaseModel):
    # Adjust max_length based on your actual team ID format (e.g., "CREIGHTON")
    teamId: str = Field(..., min_length=2, max_length=50, description="The unique team ID")


@router.post("/devices", status_code=201, dependencies=[Depends(RateLimiter(times=10, minutes=1))])
async def register_device(req: DeviceRegisterRequest, current_user = Depends(get_current_user)):
    user_id = getattr(current_user, "id", None)
    device = await create_or_update_device(user_id, req.expoPushToken, req.deviceId, req.platform)
    return {"deviceId": device.id, "registered": True}

@router.delete("/devices/{device_id}", dependencies=[Depends(RateLimiter(times=5, minutes=1))])
async def delete_device(device_id: str, current_user = Depends(get_current_user)):
    user_id = getattr(current_user, "id", None)
    ok = await remove_device(device_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"deleted": True}

@router.get("/favorites", response_model=List[str], dependencies=[Depends(RateLimiter(times=20, minutes=1))])
async def get_favorites(current_user = Depends(get_current_user)):
    user_id = getattr(current_user, "id")
    favs = await list_favorites(user_id)
    return [f.team_id for f in favs]

@router.post("/favorites", status_code=201, dependencies=[Depends(RateLimiter(times=50, minutes=1))])
async def post_favorite(req: FavoriteRequest, current_user = Depends(get_current_user)):
    user_id = getattr(current_user, "id")
    fav = await add_favorite(user_id, req.teamId)
    if fav is None:
        raise HTTPException(status_code=409, detail="Already favorited")
    return {"added": True}

@router.delete("/favorites/{team_id}", dependencies=[Depends(RateLimiter(times=50, minutes=1))])
async def delete_favorite(team_id: str, current_user = Depends(get_current_user)):
    user_id = getattr(current_user, "id")
    ok = await remove_favorite(user_id, team_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"removed": True}

@router.patch("/devices/settings")
async def update_device_settings(
    enabled: bool, 
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        # Find the device(s) for this user
        statement = select(Device).where(Device.user_id == current_user.id)
        results = await session.exec(statement)
        devices = results.all()
        
        if not devices:
            raise HTTPException(status_code=404, detail="No registered device found for this user.")
        
        # Update all devices for this user (iPad, iPhone, etc.)
        for device in devices:
            device.notifications_enabled = enabled
            session.add(device)
            
        await session.commit()
        return {"ok": True, "notifications_enabled": enabled}
    
@router.get("/devices/settings")
async def get_device_settings(
    current_user: User = Depends(get_current_user),
):
    async with AsyncSessionLocal() as session:
        statement = select(Device).where(Device.user_id == current_user.id)
        results = await session.exec(statement)
        devices = results.all()

        if not devices:
            # No registered devices yet; default to True on the client
            return {"ok": True, "notifications_enabled": True}

        # If any device has notifications_enabled=True, consider alerts enabled
        enabled = any(d.notifications_enabled for d in devices)
        return {"ok": True, "notifications_enabled": enabled}
