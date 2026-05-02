from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from app.db import AsyncSessionLocal
from app.models_devices import (
    TournamentBracket,
    TournamentSeedList,
    UserBracket,
    UserBracketPick,
    User,
)
from typing import List

from app.deps_auth import get_current_user
from app.ingest import load_team_map_names  # existing
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="/api/tournament", tags=["tournament"])

class CreateBracketRequest(BaseModel):
    name: str
    season: int = 2036

class BracketPicksPayload(BaseModel):
    picks: dict[str, str]  # {tournament_game_id: picked_winner_id}

@router.get("/team-names")
async def get_all_team_names():
    """Returns {TEAM_ID: display_name} for all 322+ teams."""
    return load_team_map_names()

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
    
@router.post("/brackets")
async def create_bracket(
    payload: CreateBracketRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Create a new bracket for the current user for a given season.
    Enforces: max 10 brackets per user per season.
    """
    async with AsyncSessionLocal() as session:
        # Count existing brackets for this user/season
        stmt = select(UserBracket).where(
            UserBracket.user_id == current_user.id,
            UserBracket.season == payload.season,
        )
        res = await session.exec(stmt)
        existing = res.all()
        if len(existing) >= 10:
            raise HTTPException(status_code=400, detail="Bracket limit reached for this season (max 10).")

        bracket = UserBracket(
            user_id=current_user.id,
            season=payload.season,
            name=payload.name.strip() or "My Bracket",
        )
        session.add(bracket)
        await session.commit()
        await session.refresh(bracket)

    return {
        "id": bracket.id,
        "season": bracket.season,
        "name": bracket.name,
        "is_locked": bracket.is_locked,
        "created_at": bracket.created_at,
    }

@router.get("/brackets")
async def list_brackets(
    season: int = 2036,
    current_user: User = Depends(get_current_user),
):
    """
    List all brackets the current user owns for a season.
    Admins may pass user_id to inspect another user.
    """
    async with AsyncSessionLocal() as session:
        stmt = select(UserBracket).where(
            UserBracket.user_id == current_user.id,
            UserBracket.season == season,
        )
        res = await session.exec(stmt)
        brackets = res.all()

    return [
        {
            "id": b.id,
            "season": b.season,
            "name": b.name,
            "is_locked": b.is_locked,
            "created_at": b.created_at,
            "locked_at": b.locked_at,
        }
        for b in brackets
    ]

@router.post("/brackets/{bracket_id}/picks")
async def save_bracket_picks(
    bracket_id: str,
    payload: BracketPicksPayload,
    season: int = 2036,
    lock: bool = True,
    current_user: User = Depends(get_current_user),
):
    """
    Save picks for a given UserBracket.
    - Overwrites existing picks for that bracket.
    - Optionally marks the bracket as locked.
    """
    async with AsyncSessionLocal() as session:
        # 1) Verify bracket ownership
        stmt_b = select(UserBracket).where(UserBracket.id == bracket_id)
        res_b = await session.exec(stmt_b)
        bracket = res_b.one_or_none()
        if not bracket:
            raise HTTPException(status_code=404, detail="Bracket not found.")
        if bracket.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not allowed to modify this bracket.")

        if bracket.season != season:
            raise HTTPException(status_code=400, detail="Season mismatch for this bracket.")

        # 2) Load valid games for this season
        stmt_games = select(TournamentBracket).where(TournamentBracket.season == season)
        res_games = await session.exec(stmt_games)
        games = res_games.all()
        valid_game_ids = {g.id for g in games}

        # 3) Delete existing picks for this bracket
        stmt_p = select(UserBracketPick).where(UserBracketPick.user_bracket_id == bracket_id)
        res_p = await session.exec(stmt_p)
        existing_picks = res_p.all()
        for p in existing_picks:
            await session.delete(p)

        # 4) Insert new picks
        count_saved = 0
        for game_id, winner_id in payload.picks.items():
            if not winner_id or winner_id == "TBD":
                continue
            if game_id not in valid_game_ids:
                continue

            pick = UserBracketPick(
                user_id=bracket.user_id,
                user_bracket_id=bracket.id,
                tournament_game_id=game_id,
                picked_winner_id=winner_id,
            )
            session.add(pick)
            count_saved += 1

        # 5) Optionally lock the bracket
        if lock:
            bracket.is_locked = True
            bracket.locked_at = datetime.utcnow()

        await session.commit()

    return {"ok": True, "count": count_saved, "is_locked": bracket.is_locked}

@router.get("/brackets/{bracket_id}/picks")
async def get_bracket_picks(
    bracket_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Returns {tournament_game_id: picked_winner_id} for a specific bracket.
    - Owner can always view.
    - Admins can view any bracket.
    """
    async with AsyncSessionLocal() as session:
        stmt_b = select(UserBracket).where(UserBracket.id == bracket_id)
        res_b = await session.exec(stmt_b)
        bracket = res_b.one_or_none()
        if not bracket:
            raise HTTPException(status_code=404, detail="Bracket not found.")

        if bracket.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not allowed to view this bracket.")

        stmt_p = select(UserBracketPick).where(UserBracketPick.user_bracket_id == bracket_id)
        res_p = await session.exec(stmt_p)
        picks = res_p.all()

        out: dict[str, str] = {}
        for p in picks:
            if p.picked_winner_id:
                out[p.tournament_game_id] = p.picked_winner_id

    return {
        "bracket_id": bracket.id,
        "user_id": bracket.user_id,
        "season": bracket.season,
        "name": bracket.name,
        "is_locked": bracket.is_locked,
        "picks": out,
    }
