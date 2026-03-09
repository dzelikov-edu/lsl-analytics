from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MASTER_SHEET_ID: str
    GOOGLE_SERVICE_ACCOUNT_JSON: str

    TEAMS_INDEX_TAB: str = "TeamsIndex"
    DEFAULT_EXPORT_TAB: str = "ScheduleExport"

    class Config:
        env_file = ".env"


settings = Settings()