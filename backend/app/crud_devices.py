from typing import Optional, List
from sqlmodel import select
from app.models_devices import Device, Favorite
from app.db import AsyncSessionLocal
from datetime import datetime

async def create_or_update_device(user_id: Optional[str], expo_push_token: str, device_id: Optional[str], platform: Optional[str]) -> Device:
    async with AsyncSessionLocal() as session:
        q = select(Device).where(Device.expo_push_token == expo_push_token)
        res = await session.exec(q)
        device = res.one_or_none()
        if device:
            device.user_id = user_id or device.user_id
            device.device_id = device_id or device.device_id
            device.platform = platform or device.platform
            device.last_seen = datetime.utcnow()
        else:
            device = Device(user_id=user_id, expo_push_token=expo_push_token, device_id=device_id, platform=platform)
            session.add(device)
        await session.commit()
        await session.refresh(device)
        return device

async def remove_device(device_id: str, user_id: Optional[str] = None) -> bool:
    async with AsyncSessionLocal() as session:
        q = select(Device).where(Device.id == device_id)
        if user_id:
            q = q.where(Device.user_id == user_id)
        res = await session.exec(q)
        device = res.one_or_none()
        if not device:
            return False
        await session.delete(device)
        await session.commit()
        return True

async def list_favorites(user_id: str) -> List[Favorite]:
    async with AsyncSessionLocal() as session:
        q = select(Favorite).where(Favorite.user_id == user_id)
        res = await session.exec(q)
        return res.all()

async def add_favorite(user_id: str, team_id: str) -> Optional[Favorite]:
    async with AsyncSessionLocal() as session:
        q = select(Favorite).where(Favorite.user_id == user_id, Favorite.team_id == team_id)
        res = await session.exec(q)
        if res.one_or_none():
            return None
        fav = Favorite(user_id=user_id, team_id=team_id)
        session.add(fav)
        await session.commit()
        await session.refresh(fav)
        return fav

async def remove_favorite(user_id: str, team_id: str) -> bool:
    async with AsyncSessionLocal() as session:
        q = select(Favorite).where(Favorite.user_id == user_id, Favorite.team_id == team_id)
        res = await session.exec(q)
        fav = res.one_or_none()
        if not fav:
            return False
        await session.delete(fav)
        await session.commit()
        return True