from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import asyncio
from datetime import datetime

from app.deps_auth import get_current_user
from app.models_devices import (
    User, 
    TournamentState, 
    TournamentSeedList, 
    MockBracketResult
)
from app.workers.push_sender import notify_team

from sqlmodel import select, delete
from app.db import AsyncSessionLocal
from sqlalchemy import text  # ADD

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


# --- LCAA TOURNAMENT ADMIN COMMANDS ---

from app.tournament_sync import sync_official_tournament

@router.post("/tournament/sync")
async def admin_sync_tournament(
    season: int = 2036,
    region_mapping: list[str] = ["West", "Midwest", "East", "South"], 
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    try:
        # 1. Trigger the sync
        regional_data = await sync_official_tournament(season, region_mapping)
        
        # 2. Re-enable Rematch Check
        from app.main import GLOBAL_GAMES_LIST
        from app.logic_tournament import check_pod_rematches
        
        all_warnings = []
        for region_name in region_mapping:
            teams = regional_data.get(region_name, [])
            all_warnings.extend(check_pod_rematches(teams, GLOBAL_GAMES_LIST))
        
        return {
            "status": "success",
            "teams_synced": sum(len(teams) for teams in regional_data.values()),
            "consultant_report": {
                "rematch_count": len(all_warnings),
                "rematch_alerts": all_warnings,
                "message": "Sync Success! 16 teams placed."
            }
        }
    except Exception as e:
        print(f"CRITICAL SYNC ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/db/upgrade-userbracketpick")
async def upgrade_userbracketpick(
    current_user: User = Depends(get_current_user),
):
    """
    One-time migration: add user_bracket_id column to userbracketpick.
    Safe to call multiple times (IF NOT EXISTS).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    async with AsyncSessionLocal() as session:
        # IF NOT EXISTS makes this idempotent
        await session.exec(text(
            "ALTER TABLE userbracketpick "
            "ADD COLUMN IF NOT EXISTS user_bracket_id VARCHAR"
        ))
        await session.commit()

    return {"status": "ok", "message": "user_bracket_id column ensured on userbracketpick"}

@router.post("/tournament/set-phase")
async def set_tournament_phase(
    phase: str, 
    season: int = 2036,
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")
    
    async with AsyncSessionLocal() as session:
        stmt = select(TournamentState).where(TournamentState.season == season)
        res = await session.exec(stmt)
        state = res.one_or_none()
        
        if not state:
            state = TournamentState(season=season, phase=phase)
            session.add(state)
        else:
            state.phase = phase
            state.updated_at = datetime.utcnow()
            
        await session.commit()
    return {"status": "success", "new_phase": phase}

@router.post("/db/create-state-table")
async def create_state_table(current_user: User = Depends(get_current_user)):
    # 1. Authority Check
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")
    
    # 2. Localized Imports (Prevents circular import issues)
    from app.db import engine
    from app.models_devices import SQLModel 
    
    # 3. Execution
    async with engine.begin() as conn:
        # This tells the DB: "Look at my models, if a table is missing, make it."
        await conn.run_sync(SQLModel.metadata.create_all)
        
    return {"status": "ok", "message": "Database schema synced successfully."}

@router.post("/tournament/sync-bracketology")
async def admin_sync_bracketology(
    season: int = 2036,
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    from app.sheets_client import get_sheets_service, read_range
    from app.settings import settings
    from app.models_devices import TournamentSeedList
    from app.db import AsyncSessionLocal
    from sqlmodel import delete

    service = get_sheets_service(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    # Target your SPECIFIC Bracketology tab
    values = read_range(service, settings.MASTER_SHEET_ID, "LCAA_Bracketology!A2:C81")
    
    if not values:
        raise HTTPException(status_code=404, detail="No data found in LCAA_Bracketology sheet.")

    field = [{"tid": str(row[0]).strip().upper(), "rank": int(row[1]), "auto": str(row[2]).strip().upper() == "TRUE"} for row in values if len(row) >= 3]

    async with AsyncSessionLocal() as session:
        # Only clear the Seeds for this season, don't touch the Official Bracket tables
        await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))

        for f in field:
            seed_entry = TournamentSeedList(
                season=season,
                team_id=f['tid'],
                overall_rank=f['rank'],
                seed=((f['rank']-1)//5)+1,
                is_autobid=f['auto'],
                resume_score=0.0, # EXPLICITLY SET
                power_value=0.0   # EXPLICITLY SET
            )
            session.add(seed_entry)
        
        await session.commit()

    return {"status": "success", "teams_synced": len(field), "message": "Bracketology Rank List Updated."}

import random

@router.post("/tournament/run-sim")
async def run_bracket_sim(season: int = 2036, current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    async with AsyncSessionLocal() as session:
        # 1. Fetch current Seeds
        stmt = select(TournamentSeedList).where(TournamentSeedList.season == season)
        seeds_res = await session.exec(stmt)
        seeds = seeds_res.all()
        if not seeds: raise HTTPException(status_code=400, detail="No seeds found. Sync Bracketology first.")

        team_power = {s.team_id: s.power_value for s in seeds}
        team_seed_val = {s.team_id: s.seed for s in seeds}

        from app.bracket_constants import REGION_MAP
        import random

        # --- THE LSL LOGIC ENGINE ---
        def get_sim_winner(id_a, id_b, round_name):
            if id_a == "TBD": return id_b
            if id_b == "TBD": return id_a

            s_a, s_b = team_seed_val.get(id_a, 16), team_seed_val.get(id_b, 16)
            p_a, p_b = team_power.get(id_a, 0), team_power.get(id_b, 0)

            # Identify Favorite vs Underdog by seed
            if s_a <= s_b:
                fav_id, dog_id = id_a, id_b
                fav_s, dog_s = s_a, s_b
                fav_p, dog_p = p_a, p_b
            else:
                fav_id, dog_id = id_b, id_a
                fav_s, dog_s = s_b, s_a
                fav_p, dog_p = p_b, p_a

            # 1. Base Prob (Seed Gap Formula)
            prob = 0.50 + ((dog_s - fav_s) * 0.035)

            # 2. Hardcoded Trend Overwrites
            if fav_s == 1 and dog_s == 16: prob = 0.98
            if fav_s == 5 and dog_s == 12: prob = 0.64
            if fav_s == 6 and dog_s == 11: prob = 0.62
            if fav_s == 8 and dog_s == 9: prob = 0.51

            # 3. Analytics Edge
            if fav_p > 0 and dog_p > 0:
                prob += ((fav_p - dog_p) * 0.02)
            elif fav_p > 0: prob += 0.05

            # 4. LCAA Legacy (Xavier Curse)
            if round_name in ["Sweet_16", "Elite_8"]:
                if fav_id == "XAVIER": prob -= 0.15
                if dog_id == "XAVIER": prob += 0.15

            # 5. The Strict 10% Rule
            prob = max(0.10, min(0.90, prob))

            return fav_id if random.random() < prob else dog_id

        # --- EXECUTION ---
        results = {}
        bracket_tree = {} # Local cache to track advancement
        regions = ["West", "Midwest", "East", "South"]
        stmt_seeds = select(TournamentSeedList).where(TournamentSeedList.season == season).order_by(TournamentSeedList.overall_rank)
        all_seeds = (await session.exec(stmt_seeds)).all()
        rank_to_id = {s.overall_rank: s.team_id for s in all_seeds}

        # ROUND 1 (Survival & R64)
        for idx, region_name in enumerate(regions):
            reg_num = idx + 1
            for slot_num in range(1, 9):
                cfg = REGION_MAP[reg_num][slot_num]
                team_b_r64 = rank_to_id.get(cfg.get('b'), "TBD")

                if cfg.get("b_is_playin"):
                    p_id = f"mock_p_{reg_num}_{slot_num}"
                    winner = get_sim_winner(rank_to_id.get(cfg['p_a']), rank_to_id.get(cfg['p_b']), "Survival_16")
                    results[p_id] = winner
                    team_b_r64 = winner

                r64_id = f"mock_r64_{reg_num}_{slot_num}"
                winner_r64 = get_sim_winner(rank_to_id.get(cfg['a']), team_b_r64, "Round_64")
                results[r64_id] = winner_r64
                bracket_tree[r64_id] = winner_r64

        # PROPAGATE R32 -> E8
        for curr, nxt, slots in [("r64", "r32", 4), ("r32", "s16", 2), ("s16", "e8", 1)]:
            round_map = {"r32": "Round_32", "s16": "Sweet_16", "e8": "Elite_8"}
            for reg_num in range(1, 5):
                region_name = regions[reg_num-1]
                for s in range(1, slots + 1):
                    # Find winners of previous two games
                    t_a = bracket_tree[f"mock_{curr}_{reg_num}_{s*2-1}"]
                    t_b = bracket_tree[f"mock_{curr}_{reg_num}_{s*2}"]
                    winner = get_sim_winner(t_a, t_b, round_map[nxt])
                    
                    n_id = f"mock_{nxt}_{reg_num}_{s}" if nxt != "e8" else f"mock_e8_{reg_num}"
                    results[n_id] = winner
                    bracket_tree[n_id] = winner

        # FINAL FOUR (West vs South | Midwest vs East)
        ff1_winner = get_sim_winner(bracket_tree["mock_e8_1"], bracket_tree["mock_e8_4"], "National Semifinals")
        results["mock_ff_1"] = ff1_winner
        ff2_winner = get_sim_winner(bracket_tree["mock_e8_2"], bracket_tree["mock_e8_3"], "National Semifinals")
        results["mock_ff_2"] = ff2_winner
        
        # CHAMPIONSHIP
        results["mock_champ"] = get_sim_winner(ff1_winner, ff2_winner, "Championship")

        # SAVE TO DB
        await session.execute(delete(MockBracketResult).where(MockBracketResult.season == season))
        for gid, win_id in results.items():
            session.add(MockBracketResult(season=season, game_id=gid, winner_id=win_id))
        
        await session.commit()
    return {"status": "success", "message": "LCAA Simulation Published."}
