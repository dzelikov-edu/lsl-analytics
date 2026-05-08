import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# YOUR RENDER POSTGRES URL
DATABASE_URL = "postgresql+asyncpg://lsl_db_user:WYMj5ClPaiBoB0hw1zqm7NtvZm4YlXSq@dpg-d7k85alckfvc73bgtg70-a/lsl_db"

async def check():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        try:
            # Check how many rows are in the PasswordResetToken table
            # Note: SQLModel usually names the table 'passwordresettoken' (lowercase)
            result = await conn.execute(text("SELECT count(*) FROM passwordresettoken"))
            count = result.scalar()
            print(f"DATABASE_CHECK: Found {count} existing reset tokens.")
        except Exception as e:
            print(f"DATABASE_CHECK_ERROR: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
