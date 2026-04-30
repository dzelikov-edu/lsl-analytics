from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from app.db import AsyncSessionLocal
from app.models_devices import TournamentBracket, TournamentSeedList
from typing import List

router = APIRouter(prefix="/api/tournament", tags=["tournament"])

@router.get("/bracket")
async def get_bracket(season: int = 2036):
    """
    Returns the full bracket structure for the infinite map.
    """
    async with AsyncSessionLocal() as session:
        statement = select(TournamentBracket).where(TournamentBracket.season == season)
        results = await session.exec(statement)
        return results.all()

@router.get("/seeds")
async def get_seeds(season: int = 2036):
    """
    Returns the 1-80 Seed List (The S-Curve).
    """
    async with AsyncSessionLocal() as session:
        statement = select(TournamentSeedList).where(TournamentSeedList.season == season)
        results = await session.exec(statement)
        return results.all()
