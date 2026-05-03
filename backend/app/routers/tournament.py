from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from app.db import AsyncSessionLocal
from app.models_devices import (
    TournamentBracket,
    TournamentSeedList,
    TournamentState,
    MockBracketResult,
    UserBracket,
    UserBracketPick,
    User,
)
from typing import List

from app.bracket_constants import REGION_MAP
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

@router.get("/state")
async def get_tournament_state(season: int = 2036):
    async with AsyncSessionLocal() as session:
        stmt = select(TournamentState).where(TournamentState.season == season)
        res = await session.exec(stmt)
        state = res.one_or_none()
        if not state:
            # Default to Bracketology if not set
            return {"season": season, "phase": "BRACKETOLOGY"}
        return state
    
@router.get("/mock-bracket")
async def get_mock_bracket(season: int = 2036):
    """
    Returns the full bracket skeleton for Bracketology mode,
    populated with the LATEST simulation results from the AI engine.
    """
    async with AsyncSessionLocal() as session:
        # 1. Fetch current Seeds & latest Sim Results
        stmt_seeds = select(TournamentSeedList).where(TournamentSeedList.season == season)
        seeds = (await session.exec(stmt_seeds)).all()
        if not seeds: return []
        
        stmt_res = select(MockBracketResult).where(MockBracketResult.season == season)
        sim_results = {r.game_id: r.winner_id for r in (await session.exec(stmt_res)).all()}
        
        # Lookups
        rank_to_id = {s.overall_rank: s.team_id for s in seeds}
        rank_to_seed = {s.overall_rank: s.seed for s in seeds}
        
        from app.bracket_constants import REGION_MAP
        mock_games = []
        regions = ["West", "Midwest", "East", "South"]

        # 2. FINAL FOUR SKELETON
        champ_id = "mock_champ"
        semi_1_id = "mock_ff_1"; semi_2_id = "mock_ff_2"
        mock_games.append({"id": champ_id, "region": "Final Four", "round": "Championship", "game_slot": 1, "team_a_id": sim_results.get("mock_ff_1", "TBD"), "team_b_id": sim_results.get("mock_ff_2", "TBD"), "seed_a": 0, "seed_b": 0, "winner_id": sim_results.get(champ_id)})
        mock_games.append({"id": semi_1_id, "region": "Final Four", "round": "National Semifinals", "game_slot": 1, "next_game_id": champ_id, "team_a_id": sim_results.get("mock_e8_1", "TBD"), "team_b_id": sim_results.get("mock_e8_4", "TBD"), "seed_a": 0, "seed_b": 0, "winner_id": sim_results.get(semi_1_id)})
        mock_games.append({"id": semi_2_id, "region": "Final Four", "round": "National Semifinals", "game_slot": 2, "next_game_id": champ_id, "team_a_id": sim_results.get("mock_e8_2", "TBD"), "team_b_id": sim_results.get("mock_e8_3", "TBD"), "seed_a": 0, "seed_b": 0, "winner_id": sim_results.get(semi_2_id)})

        # 3. REGIONAL GENERATION
        for idx, region_name in enumerate(regions):
            reg_num = idx + 1
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            e8_id = f"mock_e8_{reg_num}"
            mock_games.append({"id": e8_id, "region": region_name, "round": "Elite_8", "game_slot": 1, "next_game_id": target_semi, "team_a_id": sim_results.get(f"mock_s16_{reg_num}_1", "TBD"), "team_b_id": sim_results.get(f"mock_s16_{reg_num}_2", "TBD"), "seed_a": 0, "seed_b": 0, "winner_id": sim_results.get(e8_id)})

            for s16_slot in range(1, 3):
                s16_id = f"mock_s16_{reg_num}_{s16_slot}"
                mock_games.append({"id": s16_id, "region": region_name, "round": "Sweet_16", "game_slot": s16_slot, "next_game_id": e8_id, "team_a_id": sim_results.get(f"mock_r32_{reg_num}_{s16_slot*2-1}", "TBD"), "team_b_id": sim_results.get(f"mock_r32_{reg_num}_{s16_slot*2}", "TBD"), "seed_a": 0, "seed_b": 0, "winner_id": sim_results.get(s16_id)})

                for r32_slot in range(1, 3):
                    r32_abs_slot = ((s16_slot-1)*2)+r32_slot
                    r32_id = f"mock_r32_{reg_num}_{r32_abs_slot}"
                    mock_games.append({"id": r32_id, "region": region_name, "round": "Round_32", "game_slot": r32_abs_slot, "next_game_id": s16_id, "team_a_id": sim_results.get(f"mock_r64_{reg_num}_{r32_abs_slot*2-1}", "TBD"), "team_b_id": sim_results.get(f"mock_r64_{reg_num}_{r32_abs_slot*2}", "TBD"), "seed_a": 0, "seed_b": 0, "winner_id": sim_results.get(r32_id)})

                    for r64_sub in range(1, 3):
                        slot_num = ((r32_abs_slot-1)*2)+r64_sub
                        r64_id = f"mock_r64_{reg_num}_{slot_num}"
                        cfg = REGION_MAP[reg_num][slot_num]
                        
                        team_a = rank_to_id.get(cfg['a'], "TBD")
                        team_b = sim_results.get(f"mock_p_{reg_num}_{slot_num}") if cfg.get("b_is_playin") else rank_to_id.get(cfg.get('b'), "TBD")

                        if cfg.get("b_is_playin"):
                            p_id = f"mock_p_{reg_num}_{slot_num}"
                            mock_games.append({
                                "id": p_id, "region": region_name, "round": "Survival_16",
                                "game_slot": slot_num, "next_game_id": r64_id,
                                "team_a_id": rank_to_id.get(cfg['p_a'], "TBD"),
                                "team_b_id": rank_to_id.get(cfg['p_b'], "TBD"),
                                "seed_a": cfg['seed_b'], "seed_b": cfg['seed_b'],
                                "winner_id": sim_results.get(p_id)
                            })

                        mock_games.append({
                            "id": r64_id, "region": region_name, "round": "Round_64",
                            "game_slot": slot_num, "next_game_id": r32_id,
                            "team_a_id": team_a, "team_b_id": team_b or "TBD",
                            "seed_a": cfg['seed_a'], "seed_b": cfg['seed_b'],
                            "winner_id": sim_results.get(r64_id)
                        })

        return mock_games

