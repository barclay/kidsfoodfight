"""Pydantic schemas for admin API responses and request bodies."""

import uuid
from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

ChallengeTypeLiteral = Literal['food', 'fitness', 'shopping', 'game']


class AdminTeamSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    invite_code: str


class AdminUserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    timezone: str
    is_active: bool
    is_superuser: bool
    is_verified: bool
    created_at: datetime
    last_seen_at: datetime | None
    team_id: uuid.UUID | None
    team: AdminTeamSummary | None = None
    profile_photo_storage_url: str | None = None


class AdminUserDetail(AdminUserListItem):
    pass


class AdminUserPatch(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = None
    timezone: str | None = None
    password: str | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None
    is_verified: bool | None = None
    team_id: uuid.UUID | None = Field(
        default=None,
        description='Omit to leave unchanged; set null JSON to remove from team',
    )


class AdminTeamMemberItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str


class AdminTeamTournamentEntry(BaseModel):
    """Team enrollment in a tournament (``team_tournaments`` row)."""

    id: uuid.UUID
    tournament_id: uuid.UUID
    tournament_name: str
    joined_at: datetime


class AdminTeamListItem(BaseModel):
    id: uuid.UUID
    name: str
    invite_code: str
    created_at: datetime
    member_count: int = 0


class AdminTeamDetail(BaseModel):
    id: uuid.UUID
    name: str
    invite_code: str
    created_at: datetime
    members: list[AdminTeamMemberItem] = Field(default_factory=list)
    tournaments: list[AdminTeamTournamentEntry] = Field(default_factory=list)


class AdminTeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class AdminTeamPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)


class AdminTeamMembersPut(BaseModel):
    """Replace roster: these users are on the team; everyone else is removed from this team."""

    user_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)


class AdminTeamTournamentsPut(BaseModel):
    """Replace tournament enrollments for this team (empty list clears all)."""

    tournament_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)


class AdminPostListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    challenge_id: uuid.UUID
    author_display_name: str
    challenge_title: str
    comment: str | None
    approved: bool
    created_at: datetime
    photo_count: int = 0
    #: First photo: thumbnail ``data/...`` key if present, else full image key (for admin list preview).
    list_preview_storage_url: str | None = None


class AdminPostPhotoOut(BaseModel):
    storage_url: str
    thumbnail_storage_url: str | None = None
    description: str | None = None


class AdminPostDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    challenge_id: uuid.UUID
    author_display_name: str
    challenge_title: str
    comment: str | None
    approved: bool
    created_at: datetime
    photos: list[AdminPostPhotoOut]


class AdminPostPatch(BaseModel):
    comment: str | None = None
    approved: bool | None = None


class AdminPostsBulkDeleteResult(BaseModel):
    """Result of deleting every post (development / admin cleanup)."""

    deleted: int


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


class AdminChallengeListItem(BaseModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    tournament_name: str
    title: str
    description: str | None
    challenge_type: ChallengeTypeLiteral
    points: int
    day: int
    created_at: datetime


class AdminChallengeDetail(AdminChallengeListItem):
    pass


class AdminChallengeCreate(BaseModel):
    tournament_id: uuid.UUID
    title: str = Field(min_length=1, max_length=256)
    description: str | None = None
    challenge_type: ChallengeTypeLiteral
    points: int = Field(ge=0)
    day: int = Field(ge=1)


class AdminChallengePatch(BaseModel):
    tournament_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = None
    challenge_type: ChallengeTypeLiteral | None = None
    points: int | None = Field(default=None, ge=0)
    day: int | None = Field(default=None, ge=1)
