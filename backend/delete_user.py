import asyncio
from sqlmodel import select
from app.db import AsyncSessionLocal
from app.models_devices import User

async def delete_user_by_email(email: str):
    async with AsyncSessionLocal() as session:
        q = select(User).where(User.email == email)
        res = await session.exec(q)
        u = res.one_or_none()
        if not u:
            print("not found:", email)
            return
        await session.delete(u)
        await session.commit()
        print("deleted:", email)

if __name__ == "__main__":
    asyncio.run(delete_user_by_email("user@example.com"))