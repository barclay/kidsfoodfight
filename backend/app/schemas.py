import uuid
from datetime import datetime
from typing import Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi_users import schemas
from pydantic import BaseModel, Field, field_validator, model_validator

from app.invite_code import INVITE_CODE_LENGTH, is_valid_invite_code_format, normalize_invite_code_input
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
    team_name: str | None = Field(
        default=None,
        max_length=128,
        description='Required when not using an invite code: name for the new family team.',
    )
    invite_code: str | None = Field(
        default=None,
        description='Optional team invite code; when set, the user joins that team.',
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

    @model_validator(mode='after')
    def team_name_or_invite(self) -> Self:
        invite = normalize_invite_code_input(self.invite_code)
        if invite is not None:
            if not is_valid_invite_code_format(invite):
                raise ValueError(
                    f'invite_code must be exactly {INVITE_CODE_LENGTH} characters '
                    '(letters A–Z except O, digits 1–9; spaces and hyphens are ignored)'
                )
            return self
        name = (self.team_name or '').strip()
        if not name:
            raise ValueError('team_name is required when invite_code is not provided')
        if len(name) > 128:
            raise ValueError('team_name must be at most 128 characters')
        return self.model_copy(update={'team_name': name})


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
    #: Same ``/api/v1/media/...`` JWT-protected URL pattern as post photos; ``None`` if unset.
    author_profile_photo_url: str | None = None
    #: Poster team name when ``user.team_id`` is set; ``None`` if not on a team.
    author_team_name: str | None = None
    challenge_title: str
    comment: str | None
    approved: bool
    photos: list[FeedPostPhoto]
    like_count: int = Field(ge=0)
    liked_by_me: bool


class FeedPostLikeState(BaseModel):
    """Returned by like/unlike so the client can refresh counts without reloading the feed."""

    like_count: int = Field(ge=0)
    liked_by_me: bool


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


class MeTournamentLeaderboardRow(BaseModel):
    rank: int = Field(ge=1)
    team_id: uuid.UUID
    team_name: str
    total_points: int = Field(ge=0)
    challenges_completed: int = Field(ge=0)


class MeActiveTournamentLeaderboard(BaseModel):
    tournament_id: uuid.UUID
    tournament_name: str
    rows: list[MeTournamentLeaderboardRow]


class MeTournamentLeaderboardsPayload(BaseModel):
    """Leaderboards for tournaments the user's team is enrolled in and that are active on their local calendar."""

    my_team_id: uuid.UUID | None
    active_leaderboards: list[MeActiveTournamentLeaderboard]
