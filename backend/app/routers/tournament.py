from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, delete
from sqlalchemy import func, asc
from app.db import AsyncSessionLocal
from app.models_devices import (
    TournamentBracket,
    TournamentSeedList,
    TournamentState,
    MockBracketResult,
    UserBracket,
    UserBracketPick,
    User,
    BracketGroup,      
    GroupMembership,
    GroupBracket,   
)
from typing import List

from app.bracket_constants import REGION_MAP
from app.deps_auth import get_current_user
from app.ingest import load_team_map_names_cached
from fastapi_limiter.depends import RateLimiter
from app.tournament_sync import refresh_official_tournament
from datetime import datetime
from pydantic import BaseModel
import string
import random

router = APIRouter(prefix="/api/tournament", tags=["tournament"])

class CreateBracketRequest(BaseModel):
    name: str
    season: int = 2036

class BracketPicksPayload(BaseModel):
    picks: dict[str, str]  # {tournament_game_id: picked_winner_id}

@router.get("/team-names")
async def get_all_team_names():
    """Returns {TEAM_ID: display_name} for all 322+ teams."""
    return load_team_map_names_cached()

@router.post("/admin/sync-official")
async def admin_sync_official_tournament(
    season: int = 2036,
    current_user: User = Depends(get_current_user),
):
    """
    Admin-only trigger to refresh the official LCAA tournament bracket + seeds
    from Google Sheets into Postgres.

    - Clears existing TournamentBracket + TournamentSeedList for this season.
    - Rebuilds the official field via sync_official_tournament.
    - Protected by JWT auth (User.is_admin) and rate limiting.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    result = await refresh_official_tournament(season=season)
    return {"ok": True, "season": season, "details": result}

@router.get("/bracket")
async def get_bracket(season: int = 2036):
    """
    Returns the full bracket structure for the infinite map.
    """
    async with AsyncSessionLocal() as session:
        statement = (
            select(TournamentBracket)
            .where(TournamentBracket.season == season)
            .order_by(TournamentBracket.region, TournamentBracket.round, TournamentBracket.game_slot)
        )
        results = await session.exec(statement)
        return results.all()

@router.get("/seeds")
async def get_seeds(season: int = 2036):
    """
    Returns the 1-80 Seed List (The S-Curve).
    """
    async with AsyncSessionLocal() as session:
        statement = (
            select(TournamentSeedList)
            .where(TournamentSeedList.season == season)
            .order_by(TournamentSeedList.overall_rank)
        )
        results = await session.exec(statement)
        return results.all()
    
@router.post("/brackets")
async def create_bracket(
    payload: CreateBracketRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Create a new bracket for the current user for a given season.
    Enforces: max 10 brackets per user per season AND tournament not started.
    """
    async with AsyncSessionLocal() as session:
        # --- SURGICAL LOCKDOWN CHECK ---
        stmt_state = select(TournamentState).where(TournamentState.season == payload.season)
        state = (await session.exec(stmt_state)).one_or_none()
        if state and state.phase == "LIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="The tournament has tipped off. New bracket entries are now locked."
            )
        # -------------------------------

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
    List all brackets the current user owns for a season, 
    now including the count of picks made.
    """
    async with AsyncSessionLocal() as session:
        # 1. Fetch the user's brackets
        stmt = select(UserBracket).where(
            UserBracket.user_id == current_user.id,
            UserBracket.season == season,
        )
        brackets = (await session.exec(stmt)).all()

        output = []
        for b in brackets:
            # 2. Count picks for this specific bracket
            # This is efficient enough for a list of 10
            count_stmt = select(UserBracketPick).where(UserBracketPick.user_bracket_id == b.id)
            picks_res = await session.exec(count_stmt)
            pick_count = len(picks_res.all())

            output.append({
                "id": b.id,
                "season": b.season,
                "name": b.name,
                "is_locked": b.is_locked,
                "created_at": b.created_at,
                "locked_at": b.locked_at,
                "pick_count": pick_count # NEW
            })

    return output

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

@router.post("/simulate")
async def simulate_personal_bracket(
    season: int = 2036,
    current_user: User = Depends(get_current_user),
):
    """
    Runs the LSL AI simulation with the same macro EvanMiya constraints used
    by the Commissioner sim, but DOES NOT write to the DB.
    Returns a full mock bracket for this user only.
    """
    async with AsyncSessionLocal() as session:
        # 1. Fetch current Seeds
        stmt = select(TournamentSeedList).where(TournamentSeedList.season == season)
        seeds_list = (await session.exec(stmt)).all()
        if not seeds_list:
            raise HTTPException(status_code=400, detail="No seeds found. Sync Bracketology first.")

        team_power = {s.team_id: s.power_value for s in seeds_list}
        team_seed_val = {s.team_id: s.seed for s in seeds_list}
        from app.bracket_constants import REGION_MAP
        import random

        # --- SAME SIM ENGINE AS run_bracket_sim (micro logic) ---
        def simulate_game(id_a, id_b, round_name):
            if id_a == "TBD": return id_b
            if id_b == "TBD": return id_a

            s_a, s_b = team_seed_val.get(id_a, 16), team_seed_val.get(id_b, 16)
            p_a, p_b = team_power.get(id_a, 0), team_power.get(id_b, 0)

            # Favorite / underdog by seed, then power
            if s_a < s_b:
                fav_id, dog_id, fav_s, dog_s, fav_p, dog_p = id_a, id_b, s_a, s_b, p_a, p_b
            elif s_b < s_a:
                fav_id, dog_id, fav_s, dog_s, fav_p, dog_p = id_b, id_a, s_b, s_a, p_b, p_a
            else:
                if p_a >= p_b:
                    fav_id, dog_id, fav_s, dog_s, fav_p, dog_p = id_a, id_b, s_a, s_b, p_a, p_b
                else:
                    fav_id, dog_id, fav_s, dog_s, fav_p, dog_p = id_b, id_a, s_b, s_a, p_b, p_a

            # A. Base probabilities (historical trends)
            matchup_probs = {
                (1,16): 0.99, (2,15): 0.94, (3,14): 0.85, (4,13): 0.79,
                (5,12): 0.64, (6,11): 0.62, (7,10): 0.60, (8,9): 0.51,
            }
            win_prob = matchup_probs.get((fav_s, dog_s), 0.50 + ((dog_s - fav_s) * 0.04))

            # B. Analytics Edge (power + resume/SOS/form)
            if fav_p > 0 and dog_p > 0:
                win_prob += ((fav_p - dog_p) * 0.025)
            elif fav_p > 0:
                win_prob += 0.05

            f_meta = next((s for s in seeds_list if s.team_id == fav_id), None)
            d_meta = next((s for s in seeds_list if s.team_id == dog_id), None)
            if f_meta and d_meta:
                win_prob += ((f_meta.resume_score - d_meta.resume_score) * 0.01)
                win_prob += ((f_meta.sos - d_meta.sos) * 0.005)
                win_prob += ((f_meta.form - d_meta.form) * 0.015)

            # C. Defending champ penalty (Xavier)
            if round_name in ["Sweet_16", "Elite_8"] and fav_id == "XAVIER":
                win_prob -= 0.15

            # D. Strict 10% Gate
            underdog_prob = 1.0 - win_prob
            if underdog_prob < 0.10:
                return fav_id  # favorite auto‑wins if upset is < 10% plausible

            return fav_id if random.random() < win_prob else dog_id

        regions = ["West", "Midwest", "East", "South"]
        final_picks: dict[str, str] = {}

        # --- MACRO CONTROLLER (EvanMiya constraints) ---
        for attempt in range(25):
            sim_results: dict[str, str] = {}
            bracket_tree: dict[str, str] = {}

            # Round of 64 + Survival
            for idx, r_name in enumerate(regions):
                reg_num = idx + 1
                for s_num in range(1, 9):
                    cfg = REGION_MAP[reg_num][s_num]

                    # Survival 16
                    team_b = "TBD"
                    if cfg.get("b_is_playin"):
                        p1 = next(s.team_id for s in seeds_list if s.overall_rank == cfg['p_a'])
                        p2 = next(s.team_id for s in seeds_list if s.overall_rank == cfg['p_b'])
                        surv_win = simulate_game(p1, p2, "Survival_16")
                        sim_results[f"mock_p_{reg_num}_{s_num}"] = surv_win
                        team_b = surv_win
                    else:
                        team_b = next(s.team_id for s in seeds_list if s.overall_rank == cfg['b'])

                    team_a = next(s.team_id for s in seeds_list if s.overall_rank == cfg['a'])
                    r64_win = simulate_game(team_a, team_b, "Round_64")
                    gid = f"mock_r64_{reg_num}_{s_num}"
                    sim_results[gid] = r64_win
                    bracket_tree[gid] = r64_win

            # R32 -> S16 -> E8
            for curr, nxt, slots in [("r64", "r32", 4), ("r32", "s16", 2), ("s16", "e8", 1)]:
                for reg_num in range(1, 5):
                    for s in range(1, slots + 1):
                        t_a = bracket_tree[f"mock_{curr}_{reg_num}_{s*2-1}"]
                        t_b = bracket_tree[f"mock_{curr}_{reg_num}_{s*2}"]
                        win = simulate_game(t_a, t_b, nxt)
                        n_id = f"mock_{nxt}_{reg_num}_{s}" if nxt != "e8" else f"mock_e8_{reg_num}"
                        sim_results[n_id] = win
                        bracket_tree[n_id] = win

            # Final Four & Champ
            ff1 = simulate_game(bracket_tree["mock_e8_1"], bracket_tree["mock_e8_4"], "National Semifinals")
            ff2 = simulate_game(bracket_tree["mock_e8_2"], bracket_tree["mock_e8_3"], "National Semifinals")
            sim_results["mock_ff_1"], sim_results["mock_ff_2"] = ff1, ff2
            sim_results["mock_champ"] = simulate_game(ff1, ff2, "Championship")

            one_seeds_in_ff = len([t for r, t in sim_results.items() if r.startswith("mock_ff") and team_seed_val.get(t) == 1])
            one_seeds_in_e8 = len([t for r, t in sim_results.items() if r.startswith("mock_e8") and team_seed_val.get(t) == 1])

            # Target: Exactly 2 one‑seeds in FF and exactly 3 in E8
            final_picks = sim_results
            if one_seeds_in_ff == 2 and one_seeds_in_e8 == 3:
                break

        # --- BUILD FULL GAME OBJECTS (same shape as /mock-bracket) ---
        mock_games: list[dict] = []
        regions_map = ["West", "Midwest", "East", "South"]

        champ_id = "mock_champ"
        semi_1_id = "mock_ff_1"
        semi_2_id = "mock_ff_2"

        # Championship
        mock_games.append({
            "id": champ_id,
            "region": "Final Four",
            "round": "Championship",
            "game_slot": 1,
            "team_a_id": final_picks.get("mock_ff_1", "TBD"),
            "team_b_id": final_picks.get("mock_ff_2", "TBD"),
            "seed_a": 0,
            "seed_b": 0,
            "winner_id": final_picks.get(champ_id),
            "next_game_id": None,
        })
        # Semis
        mock_games.append({
            "id": semi_1_id,
            "region": "Final Four",
            "round": "National Semifinals",
            "game_slot": 1,
            "team_a_id": final_picks.get("mock_e8_1", "TBD"),
            "team_b_id": final_picks.get("mock_e8_4", "TBD"),
            "seed_a": 0,
            "seed_b": 0,
            "winner_id": final_picks.get(semi_1_id),
            "next_game_id": champ_id,
        })
        mock_games.append({
            "id": semi_2_id,
            "region": "Final Four",
            "round": "National Semifinals",
            "game_slot": 2,
            "team_a_id": final_picks.get("mock_e8_2", "TBD"),
            "team_b_id": final_picks.get("mock_e8_3", "TBD"),
            "seed_a": 0,
            "seed_b": 0,
            "winner_id": final_picks.get(semi_2_id),
            "next_game_id": champ_id,
        })

        # Regionals (E8, S16, R32, R64 + Survivals)
        for idx, region_name in enumerate(regions_map):
            reg_num = idx + 1
            target_semi = semi_1_id if idx in [0, 3] else semi_2_id
            e8_id = f"mock_e8_{reg_num}"
            mock_games.append({
                "id": e8_id,
                "region": region_name,
                "round": "Elite_8",
                "game_slot": 1,
                "team_a_id": final_picks.get(f"mock_s16_{reg_num}_1", "TBD"),
                "team_b_id": final_picks.get(f"mock_s16_{reg_num}_2", "TBD"),
                "seed_a": 0,
                "seed_b": 0,
                "winner_id": final_picks.get(e8_id),
                "next_game_id": target_semi,
            })

            for s16_slot in range(1, 3):
                s16_id = f"mock_s16_{reg_num}_{s16_slot}"
                mock_games.append({
                    "id": s16_id,
                    "region": region_name,
                    "round": "Sweet_16",
                    "game_slot": s16_slot,
                    "team_a_id": final_picks.get(f"mock_r32_{reg_num}_{s16_slot*2-1}", "TBD"),
                    "team_b_id": final_picks.get(f"mock_r32_{reg_num}_{s16_slot*2}", "TBD"),
                    "seed_a": 0,
                    "seed_b": 0,
                    "winner_id": final_picks.get(s16_id),
                    "next_game_id": e8_id,
                })

                for r32_slot in range(1, 3):
                    r32_abs_slot = ((s16_slot-1)*2)+r32_slot
                    r32_id = f"mock_r32_{reg_num}_{r32_abs_slot}"
                    mock_games.append({
                        "id": r32_id,
                        "region": region_name,
                        "round": "Round_32",
                        "game_slot": r32_abs_slot,
                        "team_a_id": final_picks.get(f"mock_r64_{reg_num}_{r32_abs_slot*2-1}", "TBD"),
                        "team_b_id": final_picks.get(f"mock_r64_{reg_num}_{r32_abs_slot*2}", "TBD"),
                        "seed_a": 0,
                        "seed_b": 0,
                        "winner_id": final_picks.get(r32_id),
                        "next_game_id": s16_id,
                    })

                    for r64_sub in range(1, 3):
                        slot_num = ((r32_abs_slot-1)*2)+r64_sub
                        r64_id = f"mock_r64_{reg_num}_{slot_num}"
                        cfg = REGION_MAP[reg_num][slot_num]

                        team_a = next(s.team_id for s in seeds_list if s.overall_rank == cfg['a'])
                        if cfg.get("b_is_playin"):
                            p_id = f"mock_p_{reg_num}_{slot_num}"
                            mock_games.append({
                                "id": p_id,
                                "region": region_name,
                                "round": "Survival_16",
                                "game_slot": slot_num,
                                "team_a_id": next(s.team_id for s in seeds_list if s.overall_rank == cfg['p_a']),
                                "team_b_id": next(s.team_id for s in seeds_list if s.overall_rank == cfg['p_b']),
                                "seed_a": cfg['seed_b'],
                                "seed_b": cfg['seed_b'],
                                "winner_id": final_picks.get(p_id),
                                "next_game_id": r64_id,
                            })
                            team_b = final_picks.get(p_id, "TBD")
                        else:
                            team_b = next(s.team_id for s in seeds_list if s.overall_rank == cfg['b'])

                        mock_games.append({
                            "id": r64_id,
                            "region": region_name,
                            "round": "Round_64",
                            "game_slot": slot_num,
                            "team_a_id": team_a,
                            "team_b_id": team_b,
                            "seed_a": cfg['seed_a'],
                            "seed_b": cfg['seed_b'],
                            "winner_id": final_picks.get(r64_id),
                            "next_game_id": r32_id,
                        })

        return mock_games

@router.patch("/brackets/{bracket_id}")
async def rename_bracket(
    bracket_id: str,
    name: str,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        stmt = select(UserBracket).where(UserBracket.id == bracket_id)
        bracket = (await session.exec(stmt)).one_or_none()
        if not bracket or bracket.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Bracket not found.")
        
        bracket.name = name.strip()
        await session.commit()
    return {"status": "success", "new_name": bracket.name}

@router.delete("/brackets/{bracket_id}")
async def delete_bracket(
    bracket_id: str,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        stmt = select(UserBracket).where(UserBracket.id == bracket_id)
        bracket = (await session.exec(stmt)).one_or_none()
        if not bracket or bracket.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Bracket not found.")
        
        # Delete associated picks first
        await session.execute(delete(UserBracketPick).where(UserBracketPick.user_bracket_id == bracket_id))
        await session.delete(bracket)
        await session.commit()
    return {"status": "success"}

@router.post("/groups")
async def create_bracket_group(
    name: str,
    season: int = 2036,
    current_user: User = Depends(get_current_user)
):
    """Creates a new group and generates a unique 6-char join code."""
    async with AsyncSessionLocal() as session:
        # Generate a unique 6-char code
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        group = BracketGroup(
            name=name.strip(),
            season=season,
            owner_user_id=current_user.id,
            join_code=code
        )
        session.add(group)
        
        # Auto-join the creator as a member
        membership = GroupMembership(group_id=group.id, user_id=current_user.id)
        session.add(membership)
        
        await session.commit()
        await session.refresh(group)
    return group

@router.get("/groups/me")
async def list_my_groups(season: int = 2036, current_user: User = Depends(get_current_user)):
    """Returns all groups the user is a member of, including owner info."""
    async with AsyncSessionLocal() as session:
        # Fetch groups where the user is a member
        stmt = select(BracketGroup).join(GroupMembership).where(
            GroupMembership.user_id == current_user.id,
            BracketGroup.season == season
        )
        res = await session.exec(stmt)
        groups = res.all()
        
        # Return as dicts so we are certain owner_user_id is included
        return [g.model_dump() for g in groups]

@router.post("/groups/join")
async def join_bracket_group(
    code: str,
    user_bracket_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Joins a group using a code and submits a specific bracket.
    Enforces: one bracket per user per group, and unique bracket usage globally.
    """
    code = code.strip().upper()
    async with AsyncSessionLocal() as session:
        # --- SURGICAL LOCKDOWN CHECK ---
        # Assuming current season is 2036; we check the phase before allowing join
        stmt_state = select(TournamentState).where(TournamentState.season == 2036)
        state = (await session.exec(stmt_state)).one_or_none()
        if state and state.phase == "LIVE":
            raise HTTPException(status_code=403, detail="Tournament started. Joining groups is disabled.")
        # -------------------------------

        # 1. Find the group
        stmt = select(BracketGroup).where(BracketGroup.join_code == code)
        group = (await session.exec(stmt)).one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Group code not found.")
        
        # 2. Check if user already has an entry in this group
        check_stmt = select(GroupBracket).where(
            GroupBracket.group_id == group.id, 
            GroupBracket.user_id == current_user.id
        )
        if (await session.exec(check_stmt)).one_or_none():
            raise HTTPException(status_code=400, detail="You already have an entry in this group.")

        # 3. Check if this specific bracket ID is already used in ANY group
        # This enforces your "One-Use-Only" rule for bracket IDs
        usage_stmt = select(GroupBracket).where(GroupBracket.user_bracket_id == user_bracket_id)
        if (await session.exec(usage_stmt)).one_or_none():
            raise HTTPException(status_code=400, detail="This bracket is already entered in another group.")

        # 4. Create Group Membership (ONLY if not already a member)
        membership_stmt = select(GroupMembership).where(
            GroupMembership.group_id == group.id, 
            GroupMembership.user_id == current_user.id
        )
        if not (await session.exec(membership_stmt)).one_or_none():
            new_membership = GroupMembership(group_id=group.id, user_id=current_user.id)
            session.add(new_membership)
            
        # 5. Create the Bracket Entry
        entry = GroupBracket(
            group_id=group.id,
            user_bracket_id=user_bracket_id,
            user_id=current_user.id
        )
        session.add(entry)
        await session.commit()

    return {"status": "success", "group_name": group.name}

@router.delete("/groups/{group_id}")
async def delete_bracket_group(
    group_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Deletes a bracket group. Only the owner can delete it.
    Clears all memberships and bracket entries for that group.
    """
    async with AsyncSessionLocal() as session:
        stmt = select(BracketGroup).where(BracketGroup.id == group_id)
        group = (await session.exec(stmt)).one_or_none()
        
        if not group:
            raise HTTPException(status_code=404, detail="Group not found.")
        
        # Only owner (or admin) can delete
        if group.owner_user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Only the owner can delete this group.")
        
        # 1. Delete all bracket entries in this group
        await session.execute(delete(GroupBracket).where(GroupBracket.group_id == group_id))
        # 2. Delete all memberships in this group
        await session.execute(delete(GroupMembership).where(GroupMembership.group_id == group_id))
        # 3. Delete the group itself
        await session.delete(group)
        
        await session.commit()
    return {"status": "success"}

def calculate_bracket_score_summary(
    official_games: list[TournamentBracket],
    seeds: list[TournamentSeedList],
    picks: list[UserBracketPick],
) -> dict:
    point_values = {
        "Survival_16": 1, "Round_64": 2, "Round_32": 4,
        "Sweet_16": 8, "Elite_8": 16, "National Semifinals": 32, "Championship": 64
    }

    team_seed_map = {s.team_id: s.seed for s in seeds}
    official_map = {
        g.id: {
            "winner": g.winner_id,
            "round": g.round,
            "team_a": g.team_a_id,
            "team_b": g.team_b_id,
        }
        for g in official_games
    }
    user_picks_map = {p.tournament_game_id: p.picked_winner_id for p in picks}

    current_score = 0
    points_rem = 0

    for gid, game in official_map.items():
        u_pick = user_picks_map.get(gid)
        if not u_pick or u_pick == "TBD":
            continue

        s_a = team_seed_map.get(game["team_a"], 0)
        s_b = team_seed_map.get(game["team_b"], 0)
        round_pts = point_values.get(game["round"], 0)

        # Upset bonus: only if the numerical higher seed (dog) wins
        bonus = 0
        if s_a != s_b:
            dog_seed = max(s_a, s_b)
            if team_seed_map.get(game["winner"]) == dog_seed:
                bonus = abs(s_a - s_b)

        # Actual points earned so far
        if game["winner"] == u_pick:
            current_score += (round_pts + bonus)

        # Points remaining potential from this pick
        if game["winner"] is None:
            # Game undecided: if the pick is the dog and could win, potential includes bonus
            potential_bonus = 0
            if s_a != s_b and team_seed_map.get(u_pick) == max(s_a, s_b):
                potential_bonus = abs(s_a - s_b)
            points_rem += (round_pts + potential_bonus)

    return {"score": current_score, "pts_rem": points_rem}

@router.get("/brackets/{bracket_id}/score-summary")
async def get_bracket_score_summary(
    bracket_id: str,
    season: int = 2036,
    current_user: User = Depends(get_current_user),
):
    """
    Returns a simple score summary for one bracket:
    {
      "score": int,
      "pts_rem": int
    }
    """
    async with AsyncSessionLocal() as session:
        # 1) Load bracket and check access
        stmt_b = select(UserBracket).where(UserBracket.id == bracket_id)
        res_b = await session.exec(stmt_b)
        bracket = res_b.one_or_none()
        if not bracket:
            raise HTTPException(status_code=404, detail="Bracket not found.")
        if bracket.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not allowed to view this bracket's score.")
        if bracket.season != season:
            raise HTTPException(status_code=400, detail="Season mismatch for this bracket.")

        # 2) Load official games and seeds
        official_games = (await session.exec(
            select(TournamentBracket).where(TournamentBracket.season == season)
        )).all()
        seeds = (await session.exec(
            select(TournamentSeedList).where(TournamentSeedList.season == season)
        )).all()

        # 3) Load this bracket's picks
        picks = (await session.exec(
            select(UserBracketPick).where(UserBracketPick.user_bracket_id == bracket_id)
        )).all()

        summary = calculate_bracket_score_summary(
            official_games=official_games,
            seeds=seeds,
            picks=picks,
        )

    return summary

@router.get("/groups/{group_id}/leaderboard")
async def get_group_leaderboard(
    group_id: str,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        # 1. Verification & Fetch (Surgically changed User.email to User.username)
        stmt = (
            select(GroupBracket, User.username, UserBracket.name, UserBracket.id)
            .join(User, GroupBracket.user_id == User.id)
            .join(UserBracket, GroupBracket.user_bracket_id == UserBracket.id)
            .where(GroupBracket.group_id == group_id)
        )
        results = (await session.exec(stmt)).all()

        # 2. Get Official Status & Seed Map
        official_games = (await session.exec(select(TournamentBracket))).all()
        seeds = (await session.exec(select(TournamentSeedList))).all()
        
        team_seed_map = {s.team_id: s.seed for s in seeds}
        # Official state map
        official_map = {g.id: {"winner": g.winner_id, "round": g.round, "team_a": g.team_a_id, "team_b": g.team_b_id} for g in official_games}

        # Find the Championship game id for this season
        champ_game = next((g for g in official_games if g.round == "Championship"), None)
        champ_game_id = champ_game.id if champ_game else None

        point_values = {
            "Survival_16": 1, "Round_64": 2, "Round_32": 4, 
            "Sweet_16": 8, "Elite_8": 16, "National Semifinals": 32, "Championship": 64
        }

        leaderboard = []
        for entry, username, bracket_name, bracket_id in results:
            picks = (await session.exec(select(UserBracketPick).where(UserBracketPick.user_bracket_id == bracket_id))).all()
            user_picks_map = {p.tournament_game_id: p.picked_winner_id for p in picks}

            current_score = 0
            points_rem = 0

            for gid, game in official_map.items():
                u_pick = user_picks_map.get(gid)
                if not u_pick or u_pick == "TBD": continue
                
                # --- CALC ACTUAL POINTS ---
                if game["winner"] == u_pick:
                    # Base Round Pts
                    round_pts = point_values.get(game["round"], 0)
                    # Upset Bonus: Disparity between seeds
                    s_a, s_b = team_seed_map.get(game["team_a"], 0), team_seed_map.get(game["team_b"], 0)
                    # Only bonus if the numerical higher seed (dog) wins
                    bonus = abs(s_a - s_b) if team_seed_map.get(game["winner"]) == max(s_a, s_b) and s_a != s_b else 0
                    current_score += (round_pts + bonus)

                # --- CALC POINTS REMAINING ---
                # A pick is "Alive" if the real winner is not yet decided OR the real winner matches the pick
                if game["winner"] is None:
                    # Check if the user's picked team is still in the real tournament
                    # (This is a simplified check: we assume all teams in official_map with winner=None are alive)
                    round_pts = point_values.get(game["round"], 0)
                    s_a, s_b = team_seed_map.get(game["team_a"], 0), team_seed_map.get(game["team_b"], 0)
                    bonus = abs(s_a - s_b) if team_seed_map.get(u_pick) == max(s_a, s_b) and s_a != s_b else 0
                    points_rem += (round_pts + bonus)

            # Champion pick (if any)
            champ_pick = None
            if champ_game_id:
                champ_pick = user_picks_map.get(champ_game_id) or None

            leaderboard.append({
                "user_name": username or "Unknown Legend", # Return the real username
                "bracket_name": bracket_name,
                "bracket_id": bracket_id,
                "score": current_score,
                "pts_rem": points_rem,
                "champ_pick": champ_pick,
            })

        leaderboard.sort(key=lambda x: x['score'], reverse=True)
        return leaderboard

@router.post("/groups/{group_id}/leave")
async def leave_bracket_group(
    group_id: str,
    current_user: User = Depends(get_current_user)
):
    """Allows a member to leave a group and removes their bracket entry."""
    async with AsyncSessionLocal() as session:
        # 1. Delete their bracket entry from this group
        await session.execute(delete(GroupBracket).where(
            GroupBracket.group_id == group_id,
            GroupBracket.user_id == current_user.id
        ))
        # 2. Delete their membership
        await session.execute(delete(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == current_user.id
        ))
        await session.commit()
        
    return {"status": "success", "message": "You have left the group."}

