import uuid
from datetime import datetime, timezone

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
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

    Each user belongs to at most one team (`team_id`); a team has many users.
    Tournament participation is team-scoped (user → team → tournament).
    """

    __tablename__ = 'users'

    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey('teams.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )

    team: Mapped['Team | None'] = relationship(back_populates='users')


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

    users: Mapped[list['User']] = relationship(back_populates='team')
    tournament_entries: Mapped[list['TeamTournament']] = relationship(
        back_populates='team',
        cascade='all, delete-orphan',
    )


class Tournament(Base):
    """
    Time-bounded competition (formerly "events" in the prototype).
    Teams enroll; users on those teams participate through the team link.
    """

    __tablename__ = 'tournaments'
    __table_args__ = (
        CheckConstraint('length_days > 0', name='ck_tournaments_length_days_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    length_days: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    team_entries: Mapped[list['TeamTournament']] = relationship(
        back_populates='tournament',
        cascade='all, delete-orphan',
    )


class TeamTournament(Base):
    """A team's enrollment in a tournament (many teams per tournament, many tournaments per team)."""

    __tablename__ = 'team_tournaments'
    __table_args__ = (UniqueConstraint('team_id', 'tournament_id', name='uq_team_tournaments_team_tournament'),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('teams.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('tournaments.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    team: Mapped['Team'] = relationship(back_populates='tournament_entries')
    tournament: Mapped['Tournament'] = relationship(back_populates='team_entries')
