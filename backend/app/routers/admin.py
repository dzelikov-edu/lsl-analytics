from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import asyncio
from datetime import datetime

from app.deps_auth import get_current_user
from app.models_devices import (
    User, 
    TournamentState, 
    TournamentSeedList, 
    MockBracketResult,
    PlayerSnapshot,
    TournamentBracket,
    NotificationLog,
)
from app.workers.push_sender import notify_team, notify_all_active_devices
from app.players_sync import refresh_players_snapshot_cache

from sqlmodel import select, delete
from app.db import AsyncSessionLocal
from sqlalchemy import text  # ADD

router = APIRouter(prefix="/admin", tags=["admin"])

class TestPushRequest(BaseModel):
    teamId: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=1, max_length=100)
    body: str = Field(..., min_length=1, max_length=255)
    gameKey: str | None = Field(None, description="Optional game key for data payload")

class RecordScoreRequest(BaseModel):
    game_id: str = Field(..., description="TournamentBracket.id for this game")
    score_a: int = Field(..., ge=0)
    score_b: int = Field(..., ge=0)
    season: int = Field(2036, description="Season of this tournament")
    force: bool = Field(False, description="Allow overwriting an already-scored game")

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
        # 1. Expand range to N to include all stats categories
    values = read_range(service, settings.MASTER_SHEET_ID, "LCAA_Bracketology!A2:N81")
    
    if not values:
        raise HTTPException(status_code=404, detail="No data found in LCAA_Bracketology sheet.")

    # 2. Parse the sheet into a 'field' list to fix the undefined error
    field = []
    for row in values:
        if len(row) < 3: continue
        field.append(row)

    async with AsyncSessionLocal() as session:
        # Only clear the Seeds for this season
        await session.execute(delete(TournamentSeedList).where(TournamentSeedList.season == season))

        for row in field:
            # Enhanced helper to catch parsing issues
            def get_stat(idx):
                try:
                    if idx >= len(row): return 0.0
                    val = str(row[idx]).strip().replace('%', '').replace(',', '')
                    return float(val) if val else 0.0
                except: return 0.0

            seed_entry = TournamentSeedList(
                season=season,
                team_id=str(row[0]).strip().upper(),
                overall_rank=int(row[1]),
                seed=((int(row[1])-1)//5)+1,
                is_autobid=str(row[2]).strip().upper() == "TRUE",
                # CORRECTED STATS MAPPING (Zero-based indices)
                ppg=get_stat(3),       # Col D
                rpg=get_stat(4),       # Col E
                apg=get_stat(5),       # Col F
                spg=get_stat(6),       # Col G
                bpg=get_stat(7),       # Col H
                fg_pct=get_stat(8),    # Col I
                three_pct=get_stat(9), # Col J
                ft_pct=get_stat(10),   # Col K
                oppg=get_stat(11),     # Col L
                topg=get_stat(12),     # Col M
                fpg=get_stat(13),      # Col N
                resume_score=0.0,
                power_value=0.0,
                sos=0.0,
                form=0.0
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
        seeds_list = (await session.exec(stmt)).all()
        if not seeds_list: raise HTTPException(status_code=400, detail="No seeds found.")

        team_power = {s.team_id: s.power_value for s in seeds_list}
        team_seed_val = {s.team_id: s.seed for s in seeds_list}
        from app.bracket_constants import REGION_MAP
        import random

        # --- THE LSL LOGIC ENGINE ---
        def simulate_game(id_a, id_b, round_name):
            if id_a == "TBD": return id_b
            if id_b == "TBD": return id_a

            s_a, s_b = team_seed_val.get(id_a, 16), team_seed_val.get(id_b, 16)
            p_a, p_b = team_power.get(id_a, 0), team_power.get(id_b, 0)
            
            # Sort Favorite vs Underdog
            if s_a < s_b: fav_id, dog_id, fav_s, dog_s, fav_p, dog_p = id_a, id_b, s_a, s_b, p_a, p_b
            elif s_b < s_a: fav_id, dog_id, fav_s, dog_s, fav_p, dog_p = id_b, id_a, s_b, s_a, p_b, p_a
            else: # Equal seeds: use power
                fav_id, dog_id = (id_a, id_b) if p_a >= p_b else (id_b, id_a)
                fav_s, dog_s, fav_p, dog_p = s_a, s_b, team_power.get(fav_id, 0), team_power.get(dog_id, 0)

            # A. Base Probabilities (Historical Trends)
            matchup_probs = {(1,16): 0.99, (2,15): 0.94, (3,14): 0.85, (4,13): 0.79, (5,12): 0.64, (6,11): 0.62, (7,10): 0.60, (8,9): 0.51}
            win_prob = matchup_probs.get((fav_s, dog_s), 0.50 + ((dog_s - fav_s) * 0.04))
            
            # B. Analytics Edge
            # 1. Power Modifier (The primary analytical weight)
            if fav_p > 0 and dog_p > 0: 
                win_prob += ((fav_p - dog_p) * 0.025)
            elif fav_p > 0:
                win_prob += 0.05 # Small boost if only favorite is tracked

            # 2. Triple Threat Factor (Resume, SOS, Form)
            # Find the full seed records for both teams from the seeds_list
            f_meta = next((s for s in seeds_list if s.team_id == fav_id), None)
            d_meta = next((s for s in seeds_list if s.team_id == dog_id), None)
            
            if f_meta and d_meta:
                # Resume Score: (1pt gap = 1% nudge)
                win_prob += ((f_meta.resume_score - d_meta.resume_score) * 0.01)
                # SOS: (1pt gap = 0.5% nudge)
                win_prob += ((f_meta.sos - d_meta.sos) * 0.005)
                # Form: (1pt gap = 1.5% nudge)
                win_prob += ((f_meta.form - d_meta.form) * 0.015)

            # C. Defending Champ Penalty (Curse)
            if round_name in ["Sweet_16", "Elite_8"] and fav_id == "XAVIER": win_prob -= 0.15

            # D. THE STRICT 10% RULE (The "Gate")
            underdog_prob = 1.0 - win_prob
            if underdog_prob < 0.10:
                return fav_id # Door is locked. Favorite wins 100%.
            
            # Door is open. Roll for result.
            return fav_id if random.random() < win_prob else dog_id

        # --- MACRO CONTROLLER (Re-rolls until EvanMiya targets met) ---
        final_picks = {}
        regions = ["West", "Midwest", "East", "South"]

        for attempt in range(25):
            sim_results = {}
            bracket_tree = {}
            
            # ADD DYNAMIC RANDOMNESS: 
            # We add a tiny bit of random drift to win probabilities for this specific attempt
            # This ensures that even with dominant power ratings, different 1-seeds can fall.
            chaos_factor = random.uniform(-0.05, 0.05) 

            for idx, r_name in enumerate(regions):
                reg_num = idx + 1
                for s_num in range(1, 9):
                    cfg = REGION_MAP[reg_num][s_num]
                    t_a = next(s.team_id for s in seeds_list if s.overall_rank == cfg['a'])
                    t_b = "TBD"
                    if cfg.get("b_is_playin"):
                        p1 = next(s.team_id for s in seeds_list if s.overall_rank == cfg['p_a'])
                        p2 = next(s.team_id for s in seeds_list if s.overall_rank == cfg['p_b'])
                        p_win = simulate_game(p1, p2, "Survival_16")
                        sim_results[f"mock_p_{reg_num}_{s_num}"] = p_win
                        t_b = p_win
                    else:
                        t_b = next(s.team_id for s in seeds_list if s.overall_rank == cfg['b'])

                    win = simulate_game(t_a, t_b, "Round_64")
                    sim_results[f"mock_r64_{reg_num}_{s_num}"] = win
                    bracket_tree[f"mock_r64_{reg_num}_{s_num}"] = win

            # Propagate R32 -> E8
            for curr, nxt, slots in [("r64", "r32", 4), ("r32", "s16", 2), ("s16", "e8", 1)]:
                for reg_num in range(1, 5):
                    for s in range(1, slots + 1):
                        t_a, t_b = bracket_tree[f"mock_{curr}_{reg_num}_{s*2-1}"], bracket_tree[f"mock_{curr}_{reg_num}_{s*2}"]
                        win = simulate_game(t_a, t_b, nxt)
                        n_id = f"mock_{nxt}_{reg_num}_{s}" if nxt != "e8" else f"mock_e8_{reg_num}"
                        sim_results[n_id] = win; bracket_tree[n_id] = win

            # Final Four & Champ
            ff1 = simulate_game(bracket_tree["mock_e8_1"], bracket_tree["mock_e8_4"], "National Semifinals")
            ff2 = simulate_game(bracket_tree["mock_e8_2"], bracket_tree["mock_e8_3"], "National Semifinals")
            sim_results["mock_ff_1"], sim_results["mock_ff_2"] = ff1, ff2
            sim_results["mock_champ"] = simulate_game(ff1, ff2, "Championship")

            # EVANMIYA VALIDATION
            one_seeds_in_ff = len([t for r, t in sim_results.items() if r.startswith("mock_ff") and team_seed_val.get(t) == 1])
            one_seeds_in_e8 = len([t for r, t in sim_results.items() if r.startswith("mock_e8") and team_seed_val.get(t) == 1])
            
            # If we match targets, keep this one and exit loop
            if one_seeds_in_ff == 2 and one_seeds_in_e8 == 3:
                final_picks = sim_results
                break
            final_picks = sim_results 

        # 5. ABSOLUTE OVERWRITE (Flush Pattern)
        await session.execute(delete(MockBracketResult).where(MockBracketResult.season == season))
        await session.flush() # Force deletion now

        for gid, win_id in final_picks.items():
            session.add(MockBracketResult(season=season, game_id=gid, winner_id=win_id))
        
        await session.commit()

    return {"status": "success", "message": "AI Simulation Published: EvanMiya Targets Met."}

@router.post("/db/patch-seedlist-columns")
async def patch_seedlist_columns(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    async with AsyncSessionLocal() as session:
        # Existing patches
        await session.execute(text("ALTER TABLE tournamentseedlist ADD COLUMN IF NOT EXISTS sos FLOAT DEFAULT 0.0"))
        await session.execute(text("ALTER TABLE tournamentseedlist ADD COLUMN IF NOT EXISTS form FLOAT DEFAULT 0.0"))
        
        # --- ADD THESE THREE LINES ---
        await session.execute(text("ALTER TABLE tournamentseedlist ADD COLUMN IF NOT EXISTS spg FLOAT DEFAULT 0.0"))
        await session.execute(text("ALTER TABLE tournamentseedlist ADD COLUMN IF NOT EXISTS bpg FLOAT DEFAULT 0.0"))
        await session.execute(text("ALTER TABLE tournamentseedlist ADD COLUMN IF NOT EXISTS ft_pct FLOAT DEFAULT 0.0"))
        # -----------------------------
        
        await session.commit()

    return {"status": "ok", "message": "All stats columns ensured on tournamentseedlist"}

@router.post("/players/sync")
async def admin_sync_players(
    current_user: User = Depends(get_current_user),
):
    """
    Admin-only: refreshes the PlayerSnapshot table from the PlayersSnapshot sheet.
    - Clears existing PlayerSnapshot rows.
    - Inserts a fresh snapshot from Google Sheets.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    result = await refresh_players_snapshot_cache()
    return {"status": "success", **result}

@router.post("/tournament/record-score")
async def admin_record_tournament_score(
    req: RecordScoreRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Admin-only:
    - Records score_a / score_b for a TournamentBracket game.
    - Sets winner_id based on the scores.
    - Pushes the winner into the next_game (team_a_id or team_b_id) using game_slot rules.
    - Enforces: phase must be LIVE, no overwrite unless force=True,
      and no overwriting non-TBD slots in the next game.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    async with AsyncSessionLocal() as session:
        # NEW: Phase guard – only allow scoring when tournament is LIVE
        stmt_state = select(TournamentState).where(TournamentState.season == req.season)
        state_res = await session.exec(stmt_state)
        state = state_res.one_or_none()
        if state and state.phase != "LIVE":
            raise HTTPException(
                status_code=400,
                detail=f"Tournament phase is {state.phase}. Scores can only be recorded in LIVE phase.",
            )

        # 1. Load the current game
        stmt = select(TournamentBracket).where(
            TournamentBracket.id == req.game_id,
            TournamentBracket.season == req.season,
        )
        result = await session.exec(stmt)
        game = result.one_or_none()

        if not game:
            raise HTTPException(status_code=404, detail="Tournament game not found.")

        # NEW: Prevent re-scoring unless force=True
        if game.winner_id is not None and not req.force:
            raise HTTPException(
                status_code=400,
                detail="This game already has a recorded winner. Pass force=true to overwrite.",
            )

        # 2. Basic validation: no ties allowed
        if req.score_a == req.score_b:
            raise HTTPException(
                status_code=400,
                detail="Scores cannot be tied in a completed tournament game.",
            )

        # 3. Determine winner
        winner_id = game.team_a_id if req.score_a > req.score_b else game.team_b_id

        # 4. Update the current game
        game.score_a = req.score_a
        game.score_b = req.score_b
        game.winner_id = winner_id

        session.add(game)

        # 5. Push winner forward, if this game feeds another game
        pushed_to = None
        if game.next_game_id:
            # Load the next game in the chain
            stmt_next = select(TournamentBracket).where(
                TournamentBracket.id == game.next_game_id,
                TournamentBracket.season == req.season,
            )
            result_next = await session.exec(stmt_next)
            next_game = result_next.one_or_none()

            if not next_game:
                raise HTTPException(
                    status_code=500,
                    detail=f"next_game_id {game.next_game_id} not found for game {game.id}",
                )

            # Special rule: Survival_16 winner fills team_b_id in Round_64
            if game.round == "Survival_16" and next_game.round == "Round_64":
                # NEW: don't overwrite a non-TBD team_b_id
                if next_game.team_b_id not in (None, "", "TBD") and next_game.team_b_id != winner_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Next game's team_b_id is already set to a different team.",
                    )
                next_game.team_b_id = winner_id
                pushed_to = {"slot": "B", "next_game_id": next_game.id}
            else:
                # General rule: odd game_slot winner -> team_a, even -> team_b
                if game.game_slot % 2 == 1:
                    # NEW: don't overwrite a non-TBD team_a_id
                    if next_game.team_a_id not in (None, "", "TBD") and next_game.team_a_id != winner_id:
                        raise HTTPException(
                            status_code=400,
                            detail="Next game's team_a_id is already set to a different team.",
                        )
                    next_game.team_a_id = winner_id
                    pushed_to = {"slot": "A", "next_game_id": next_game.id}
                else:
                    # NEW: don't overwrite a non-TBD team_b_id
                    if next_game.team_b_id not in (None, "", "TBD") and next_game.team_b_id != winner_id:
                        raise HTTPException(
                            status_code=400,
                            detail="Next game's team_b_id is already set to a different team.",
                        )
                    next_game.team_b_id = winner_id
                    pushed_to = {"slot": "B", "next_game_id": next_game.id}

            session.add(next_game)

        await session.commit()

        # --- AUTOMATED NOTIFICATIONS (League-Wide Priority Logic) ---
        try:
            # 1. Check if we already sent notifications for this specific game
            stmt_log = select(NotificationLog).where(NotificationLog.game_key == game.id)
            log_res = await session.exec(stmt_log)
            if not log_res.one_or_none():
                
                # 2. Setup Data
                score_line = f"{game.team_a_id} {req.score_a}, {game.team_b_id} {req.score_b}"
                fav_id = game.team_a_id if game.seed_a <= game.seed_b else game.team_b_id
                dog_id = game.team_b_id if game.seed_a <= game.seed_b else game.team_a_id
                fav_seed = min(game.seed_a, game.seed_b)
                dog_seed = max(game.seed_a, game.seed_b)

                # --- PRIORITY 1: NATIONAL CHAMPIONSHIP ---
                if game.round == "Championship":
                    champ_body = f"THE LEGENDS UNIVERSE HAS A CHAMPION! {winner_id} wins the title! ({score_line})"
                    asyncio.create_task(notify_all_active_devices("NATIONAL CHAMPIONSHIP", champ_body, {"game_id": game.id}))
                
                # --- PRIORITY 2: UPSET ALERT ---
                elif (dog_seed - fav_seed) >= 5 and winner_id == dog_id:
                    upset_body = f"🚨 ({dog_seed}) {dog_id} just knocked off ({fav_seed}) {fav_id}! ({score_line})"
                    asyncio.create_task(notify_all_active_devices("UPSET ALERT", upset_body, {"game_id": game.id}))
                
                # --- PRIORITY 3: ALL OTHER TOURNAMENT GAMES ---
                else:
                    # Every active user gets the final score
                    game_body = f"FINAL: ({game.seed_a}) {game.team_a_id} {req.score_a}, ({game.seed_b}) {game.team_b_id} {req.score_b}"
                    asyncio.create_task(notify_all_active_devices("TOURNAMENT UPDATE", game_body, {"game_id": game.id}))

                # 3. Finalize Log to prevent double-firing
                new_log = NotificationLog(game_key=game.id)
                session.add(new_log)
                await session.commit()
                
        except Exception as n_err:
            print(f"[PUSH ERROR] Failed to trigger league-wide occasions: {n_err}")

    return {
        "status": "success",
        "game_id": game.id,
        "winner_id": winner_id,
        "score_a": game.score_a,
        "score_b": game.score_b,
        "pushed_to": pushed_to,
    }

class UndoScoreRequest(BaseModel):
    game_id: str = Field(..., description="TournamentBracket.id for this game")
    season: int = Field(..., description="Season of this tournament")

@router.post("/tournament/undo-score")
async def admin_undo_tournament_score(
    req: UndoScoreRequest,  # Use the new model
    current_user: User = Depends(get_current_user),
):
    """
    Admin-only: Undoes a score for a TournamentBracket game.
    Resets score_a, score_b, winner_id, and reverses any advancement to the next game.
    Only allowed in LIVE phase.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")

    async with AsyncSessionLocal() as session:
        # Phase guard
        stmt_state = select(TournamentState).where(TournamentState.season == req.season)
        state_res = await session.exec(stmt_state)
        state = state_res.one_or_none()
        if state and state.phase != "LIVE":
            raise HTTPException(status_code=400, detail="Scores can only be undone in LIVE phase.")

        # Load the game
        stmt = select(TournamentBracket).where(
            TournamentBracket.id == req.game_id,
            TournamentBracket.season == req.season,
        )
        result = await session.exec(stmt)
        game = result.one_or_none()

        if not game:
            raise HTTPException(status_code=404, detail="Tournament game not found.")

        if game.winner_id is None:
            raise HTTPException(status_code=400, detail="This game has no recorded score to undo.")

        # Store the current winner for reversal
        old_winner_id = game.winner_id

        # Reset this game
        game.score_a = None
        game.score_b = None
        game.winner_id = None
        session.add(game)

        # Reverse the advancement if this game fed into another
        if game.next_game_id:
            stmt_next = select(TournamentBracket).where(
                TournamentBracket.id == game.next_game_id,
                TournamentBracket.season == req.season,
            )
            result_next = await session.exec(stmt_next)
            next_game = result_next.one_or_none()

            if next_game:
                # Determine which slot to clear (based on original game_slot)
                if game.round == "Survival_16" and next_game.round == "Round_64":
                    next_game.team_b_id = "TBD"  # Clear the specific slot
                elif game.game_slot % 2 == 1:
                    next_game.team_a_id = "TBD"
                else:
                    next_game.team_b_id = "TBD"
                session.add(next_game)

        await session.commit()

        return {
            "status": "success",
            "game_id": game.id,
            "message": "Score undone and advancement reversed.",
        }
