import uuid
from datetime import datetime, timezone

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.invite_code import generate_invite_code


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLAlchemyBaseUserTableUUID, Base):
    """
    Core user account.

    Identity columns (id, email, hashed_password, is_active, is_superuser,
    is_verified) are inherited from SQLAlchemyBaseUserTableUUID.
    """

    __tablename__ = 'users'

    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    team_memberships: Mapped[list['TeamMember']] = relationship(
        back_populates='user',
        cascade='all, delete-orphan',
    )


class Team(Base):
    __tablename__ = 'teams'

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    invite_code: Mapped[str] = mapped_column(
        String(14),
        unique=True,
        nullable=False,
        default=generate_invite_code,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    memberships: Mapped[list['TeamMember']] = relationship(
        back_populates='team',
        cascade='all, delete-orphan',
    )


class TeamMember(Base):
    """Join table: a user may belong to many teams; a team has many users."""

    __tablename__ = 'team_members'
    __table_args__ = (UniqueConstraint('team_id', 'user_id', name='uq_team_members_team_user'),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('teams.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    team: Mapped['Team'] = relationship(back_populates='memberships')
    user: Mapped['User'] = relationship(back_populates='team_memberships')
