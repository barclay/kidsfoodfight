import uuid
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi_users import schemas
from pydantic import BaseModel, Field, field_validator

from app.models import DEFAULT_USER_TIMEZONE


def _validate_iana_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as e:
        raise ValueError(
            'timezone must be a valid IANA name (e.g. America/Los_Angeles, Europe/Paris)'
        ) from e
    return value


class UserRead(schemas.BaseUser[uuid.UUID]):
    display_name: str
    timezone: str
    created_at: datetime
    last_seen_at: datetime | None = None
    profile_photo_storage_url: str | None = None

    model_config = {'from_attributes': True}


class UserCreate(schemas.BaseUserCreate):
    display_name: str
    timezone: str | None = Field(
        default=None,
        description='IANA time zone from the client; defaults to US Pacific if omitted.',
    )

    @field_validator('timezone', mode='before')
    @classmethod
    def timezone_default_and_valid(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not v.strip()):
            return DEFAULT_USER_TIMEZONE
        s = str(v).strip()
        return _validate_iana_timezone(s)

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
    display_name: str | None = None
    timezone: str | None = None

    @field_validator('timezone')
    @classmethod
    def timezone_valid_when_set(cls, v: str | None) -> str | None:
        if v is None:
            return v
        s = v.strip()
        if not s:
            raise ValueError('timezone cannot be empty')
        return _validate_iana_timezone(s)

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


class FeedPostPhoto(BaseModel):
    sort_order: int
    url: str
    description: str | None = None


class FeedPostCreated(BaseModel):
    id: uuid.UUID
    photo_count: int


class FeedPostItem(BaseModel):
    id: uuid.UUID
    created_at: datetime
    author_display_name: str
    challenge_title: str
    comment: str | None
    approved: bool
    photos: list[FeedPostPhoto]


class AvailableChallengeItem(BaseModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    tournament_name: str
    title: str
    description: str | None
    challenge_type: str
    points: int
    day: int
    #: ``True`` when this challenge's ``day`` matches the user's current local tournament day.
    is_focus_day: bool
