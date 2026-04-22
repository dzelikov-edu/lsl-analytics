from typing import Optional
from datetime import datetime
from uuid import uuid4
from sqlmodel import Field, SQLModel

class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    email: Optional[str] = None
    hashed_password: Optional[str] = None  # NEW
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_admin: bool = False


class Device(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: Optional[str] = Field(default=None, foreign_key="user.id", index=True)
    expo_push_token: str = Field(index=True)
    device_id: Optional[str] = None
    platform: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True

class Favorite(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    team_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NotificationLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    game_key: str = Field(index=True, unique=True)
    sent_at: datetime = Field(default_factory=datetime.utcnow)
