from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_postgres_url_for_async_sqlalchemy(url: str) -> str:
    """Render/Heroku-style ``DATABASE_URL`` is often ``postgres://`` or ``postgresql://`` without a
    driver. SQLAlchemy async needs ``postgresql+asyncpg`` or it falls back to sync psycopg2."""
    u = url.strip()
    if not u:
        return u
    if u.startswith('postgres://'):
        u = 'postgresql://' + u.removeprefix('postgres://')
    if '://' not in u:
        return u
    scheme, _, rest = u.partition('://')
    if '+' in scheme:
        return u
    if scheme == 'postgresql':
        return f'postgresql+asyncpg://{rest}'
    return u


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    database_url: str = 'postgresql+asyncpg://kff:kff@db:5432/kff'

    @field_validator('database_url', mode='before')
    @classmethod
    def database_url_asyncpg(cls, v: object) -> object:
        if isinstance(v, str):
            return normalize_postgres_url_for_async_sqlalchemy(v)
        return v
    secret_key: str = 'change-me-in-production'
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    cors_origins: list[str] = [
        'http://localhost:8081',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
    ]

    #: ``local`` = files under ``data/`` on disk (see ``media_public_root``). ``s3`` reserved for production uploads.
    storage_backend: Literal['local', 's3'] = Field(default='local', validation_alias='STORAGE_BACKEND')

    #: When ``storage_backend`` is ``s3``, these will select the bucket and region (upload not implemented yet).
    s3_bucket: str | None = Field(default=None, validation_alias='S3_BUCKET')
    s3_region: str | None = Field(default=None, validation_alias='S3_REGION')

    #: Directory whose resolved path is the parent of the ``data/`` folder on disk (e.g. ``/media`` when
    #: Compose mounts ``./data`` to ``/media/data``). ``PostPhoto.storage_url`` values are ``data/...`` keys.
    media_public_root: Path | None = Field(default=None, validation_alias='MEDIA_PUBLIC_ROOT')

    #: Skip loading BLIP / writing ``PostPhoto.description`` (faster dev without torch).
    blip_disable: bool = Field(default=False, validation_alias='BLIP_DISABLE')


settings = Settings()
