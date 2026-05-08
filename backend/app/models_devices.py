from typing import Optional
from datetime import datetime
from uuid import uuid4
from sqlmodel import Field, SQLModel

class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    email: Optional[str] = None
    username: Optional[str] = Field(default=None, index=True, unique=True)
    hashed_password: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_admin: bool = False
    
class PasswordResetToken(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    token: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    used: bool = Field(default=False)

class Device(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: Optional[str] = Field(default=None, foreign_key="user.id", index=True)
    expo_push_token: str = Field(index=True)
    device_id: Optional[str] = Field(None, max_length=100)
    platform: Optional[str] = Field(None, max_length=20)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True
    notifications_enabled: bool = Field(default=True)

class Favorite(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    team_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NotificationLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    game_key: str = Field(index=True, unique=True)
    sent_at: datetime = Field(default_factory=datetime.utcnow)

class Game(SQLModel, table=True):
    game_key: str = Field(primary_key=True)
    phase: str
    week: str
    team_a: str
    team_b: str
    venue: str
    home_id: str
    away_id: str
    a_score: Optional[int] = None
    b_score: Optional[int] = None
    date_key: Optional[str] = None

# --- LCAA TOURNAMENT MODELS ---

class TournamentBracket(SQLModel, table=True):
    """
    Stores the 'Master' version of the LCAA tournament.
    Used for 'Selection Sunday' results and the 'Official' bracket.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    season: int = Field(index=True) # e.g., 2024
    status: str = Field(default="PREDICTION_OPEN") # PREDICTION_OPEN, SURVIVAL_16, LIVE, FINAL
    
    # Tournament Structure
    region: str = Field(index=True) # East, West, Midwest, South, Survival
    round: str = Field(index=True)  # Survival_16, Round_64, Round_32, etc.
    game_slot: int = Field(index=True) # Position in the bracket (1-32)
    
    # Matchup Data
    team_a_id: str = Field(index=True)
    team_b_id: str = Field(index=True)
    seed_a: int
    seed_b: int
    
    # Results
    winner_id: Optional[str] = None
    score_a: Optional[int] = None
    score_b: Optional[int] = None
    
    # Linking: Where does the winner of this game go next?
    next_game_id: Optional[str] = None 
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserBracketPick(SQLModel, table=True):
    """
    Stores the 'Pick'em' choices made by the users, tied to a specific bracket.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    user_bracket_id: str = Field(foreign_key="userbracket.id", index=True)  # NEW
    tournament_game_id: str = Field(foreign_key="tournamentbracket.id")
    picked_winner_id: str
    is_correct: Optional[bool] = None  # Calculated after the sim runs
    points_awarded: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserBracket(SQLModel, table=True):
    """
    A named bracket a user owns for a given season.
    Users can have up to 10 per season.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    season: int = Field(index=True)
    name: str = Field(max_length=100)
    is_locked: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    locked_at: Optional[datetime] = None

class TournamentSeedList(SQLModel, table=True):
    """
    Internal cache for the S-Curve.
    Speeds up the 'Selection Sunday' screen in the app.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    season: int
    team_id: str = Field(index=True)
    overall_rank: int # 1 through 80
    seed: int         # 1 through 16
    is_autobid: bool
    resume_score: float
    power_value: float
    sos: float = Field(default=0.0)
    form: float = Field(default=0.0)

    # Core Stats (Already Averages)
    ppg: float = Field(default=0.0)
    rpg: float = Field(default=0.0)
    apg: float = Field(default=0.0)
    fg_pct: float = Field(default=0.0)
    three_pct: float = Field(default=0.0)
    
    # Advanced Stats (The ones the Backend will calculate from Totals)
    oppg: float = Field(default=0.0)  # Total Points Against / Games
    topg: float = Field(default=0.0)  # Total Turnovers / Games
    fpg: float = Field(default=0.0)   # Total Fouls / Games
    
    # Tracking
    games_played: int = Field(default=0)

class BracketGroup(SQLModel, table=True):
    """
    A group/league for comparing brackets.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str = Field(max_length=100)
    season: int = Field(index=True)
    owner_user_id: str = Field(foreign_key="user.id", index=True)
    join_code: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GroupMembership(SQLModel, table=True):
    """
    Which users are members of which groups.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    group_id: str = Field(foreign_key="bracketgroup.id", index=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GroupBracket(SQLModel, table=True):
    """
    A specific bracket entered into a specific group.
    - Enforces: one bracket per user per group.
    - Enforces: a UserBracket can be used in at most one group.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    group_id: str = Field(foreign_key="bracketgroup.id", index=True)
    user_bracket_id: str = Field(foreign_key="userbracket.id", index=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TournamentState(SQLModel, table=True):
    """
    Global toggle for the LCAA Tournament tab.
    phase: 'BRACKETOLOGY' (Mock) or 'LIVE' (Official)
    """
    id: int = Field(default=1, primary_key=True)
    season: int = Field(default=2036)
    phase: str = Field(default="BRACKETOLOGY") # BRACKETOLOGY, SELECTION_SUNDAY, LIVE, FINISHED
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MockBracketResult(SQLModel, table=True):
    """
    Stores the results of the LATEST simulation run.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    season: int = Field(index=True)
    game_id: str = Field(index=True) # e.g. mock_r64_1_1
    winner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
