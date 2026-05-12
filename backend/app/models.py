import uuid
from datetime import datetime, timezone

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import DateTime, ForeignKey, String, Uuid
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
