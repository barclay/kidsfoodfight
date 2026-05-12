import uuid
from datetime import datetime

from fastapi_users import schemas
from pydantic import field_validator


class UserRead(schemas.BaseUser[uuid.UUID]):
    username: str
    created_at: datetime
    last_seen_at: datetime | None = None

    model_config = {'from_attributes': True}


class UserCreate(schemas.BaseUserCreate):
    username: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('must be at least 6 characters')
        if ' ' in v:
            raise ValueError('must not contain spaces')
        if not any(c.isalpha() for c in v):
            raise ValueError('must contain at least one letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('must contain at least one digit')
        return v


class UserUpdate(schemas.BaseUserUpdate):
    username: str | None = None

    @field_validator('password', mode='before')
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) < 6:
            raise ValueError('must be at least 6 characters')
        if ' ' in v:
            raise ValueError('must not contain spaces')
        if not any(c.isalpha() for c in v):
            raise ValueError('must contain at least one letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('must contain at least one digit')
        return v
