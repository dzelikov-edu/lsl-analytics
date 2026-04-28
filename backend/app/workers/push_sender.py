from typing import List
import asyncio
import httpx
from sqlmodel import select
from app.db import AsyncSessionLocal
from app.models_devices import Favorite, Device

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH_SIZE = 100

async def get_tokens_for_team(team_id: str) -> List[str]:
    async with AsyncSessionLocal() as session:
        q = (
            select(Favorite, Device)
            .join(Device, Favorite.user_id == Device.user_id)
            .where(
                Favorite.team_id == team_id,
                Device.active == True,
                Device.notifications_enabled == True,
            )
        )
        res = await session.exec(q)
        rows = res.all()
        tokens = []
        for fav, device in rows:
            if device and device.expo_push_token:
                tokens.append(device.expo_push_token)
        return list(dict.fromkeys(tokens))

def make_messages(tokens: List[str], title: str, body: str, data: dict = None):
    out = []
    for t in tokens:
        out.append({"to": t, "title": title, "body": body, "data": data or {}})
    return out

async def send_batch(messages):
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(EXPO_PUSH_URL, json=messages)
        resp.raise_for_status()
        return resp.json()

async def mark_invalid_tokens(invalid_tokens: List[str]):
    if not invalid_tokens:
        return
    async with AsyncSessionLocal() as session:
        q = select(Device).where(Device.expo_push_token.in_(invalid_tokens))
        res = await session.exec(q)
        devices = res.all()
        for d in devices:
            d.active = False
            session.add(d)
        await session.commit()

async def notify_team(team_id: str, title: str, body: str, data: dict = None):
    tokens = await get_tokens_for_team(team_id)
    if not tokens:
        print(f"[PUSH] no tokens for team={team_id}")
        return
    for i in range(0, len(tokens), BATCH_SIZE):
        batch = tokens[i : i + BATCH_SIZE]
        messages = make_messages(batch, title, body, data)
        try:
            res = await send_batch(messages)
            invalid = []
            if isinstance(res, dict) and "data" in res:
                for item in res.get("data", []):
                    if item.get("status") == "error":
                        details = item.get("details", {})
                        if details.get("error") in ("DeviceNotRegistered", "InvalidCredentials", "DeviceNotRegisteredError"):
                            invalid.append(item.get("to"))
            if invalid:
                await mark_invalid_tokens(invalid)
            print(f"[PUSH] sent batch {i//BATCH_SIZE + 1} size={len(batch)} team={team_id}")
        except httpx.HTTPStatusError as e:
            print("http error sending batch:", e, e.response.text if e.response is not None else "")
        except Exception as e:
            print("unexpected send error:", e)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print('usage: python push_sender.py TEAM_ID "Title" "Body"')
        raise SystemExit(1)
    team = sys.argv[1]
    title = sys.argv[2]
    body = sys.argv[3]
    asyncio.run(notify_team(team, title, body, {"team": team}))