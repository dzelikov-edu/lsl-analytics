from pydantic import Field
from pydantic_settings import BaseSettings
import pathlib
from typing import Optional

class Settings(BaseSettings):
    # existing/required env vars (uppercase names preserved)
    MASTER_SHEET_ID: str = Field(..., env="MASTER_SHEET_ID")
    GOOGLE_SERVICE_ACCOUNT_JSON: str = Field(..., env="GOOGLE_SERVICE_ACCOUNT_JSON")
    GOOGLE_SERVICE_ACCOUNT_VALUE: Optional[str] = Field(None, env="GOOGLE_SERVICE_ACCOUNT_VALUE")

    # new config fields (useful for other code)
    jwt_secret_key: str = Field(..., env="JWT_SECRET_KEY")
    database_url: str = Field("sqlite+aiosqlite:///./dev.db", env="DATABASE_URL")
    cors_extra_origins: str | None = Field(None, env="CORS_EXTRA_ORIGINS")

    # keep your existing app defaults
    TEAMS_INDEX_TAB: str = "TeamsIndex"
    DEFAULT_EXPORT_TAB: str = "ScheduleExport"

    model_config = {
        "env_file": str(pathlib.Path(__file__).resolve().parent.parent / ".env"),
        "env_file_encoding": "utf-8",
    }

settings = Settings()
