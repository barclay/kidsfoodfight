"""Pydantic schemas for admin API responses and request bodies."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class AdminTeamSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    invite_code: str


class AdminUserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str
    is_active: bool
    is_superuser: bool
    is_verified: bool
    created_at: datetime
    last_seen_at: datetime | None
    team_id: uuid.UUID | None
    team: AdminTeamSummary | None = None


class AdminUserDetail(AdminUserListItem):
    pass


class AdminUserPatch(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    password: str | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None
    is_verified: bool | None = None
    team_id: uuid.UUID | None = Field(
        default=None,
        description='Omit to leave unchanged; set null JSON to remove from team',
    )


class AdminTeamDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    invite_code: str
    created_at: datetime


class AdminTeamPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)


class AdminPostListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    challenge_id: uuid.UUID
    author_username: str
    challenge_title: str
    comment: str | None
    approved: bool
    created_at: datetime
    photo_count: int = 0


class AdminPostDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    challenge_id: uuid.UUID
    author_username: str
    challenge_title: str
    comment: str | None
    approved: bool
    created_at: datetime
    photo_urls: list[str]


class AdminPostPatch(BaseModel):
    comment: str | None = None
    approved: bool | None = None


class AdminTournamentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    start_date: datetime
    length_days: int
    created_at: datetime


class AdminTournamentDetail(AdminTournamentListItem):
    pass


class AdminTournamentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description: str | None = None
    start_date: datetime
    length_days: int = Field(ge=1)

    @field_validator('start_date')
    @classmethod
    def start_must_be_tz_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError('start_date must be timezone-aware')
        return v


class AdminTournamentPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = None
    start_date: datetime | None = None
    length_days: int | None = Field(default=None, ge=1)

    @field_validator('start_date')
    @classmethod
    def start_must_be_tz_aware(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            raise ValueError('start_date must be timezone-aware')
        return v
