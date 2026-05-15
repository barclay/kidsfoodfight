import uuid
from datetime import datetime, timedelta, timezone
from enum import StrEnum

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid, false as sql_false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.invite_code import generate_invite_code

# Default profile timezone: US Pacific (PST/PDT). Clients should send IANA IDs (e.g. from the phone).
DEFAULT_USER_TIMEZONE = 'America/Los_Angeles'


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ChallengeType(StrEnum):
    FOOD = 'food'
    FITNESS = 'fitness'
    SHOPPING = 'shopping'
    GAME = 'game'


class User(SQLAlchemyBaseUserTableUUID, Base):
    """
    Core user account.

    Identity columns (id, email, hashed_password, is_active, is_superuser,
    is_verified) are inherited from SQLAlchemyBaseUserTableUUID.

    Each user belongs to at most one team (`team_id`); a team has many users.
    Tournament participation is team-scoped (user → team → tournament).

    Optional ``profile_photo_storage_url`` holds a ``data/...`` media key (local disk in dev; S3 TBD).

    `timezone` is an IANA name (e.g. America/Los_Angeles) for displaying local times;
    default is US Pacific. Mobile clients should send the device zone at signup.

    ``language_preference`` mirrors the mobile language setting (``system`` follows device locale,
    ``en`` / ``es`` forces UI copy). ``NULL`` means the user has never synced from a client.
    """

    __tablename__ = 'users'

    __table_args__ = (
        CheckConstraint(
            "language_preference IS NULL OR language_preference IN ('system', 'en', 'es')",
            name='ck_users_language_preference',
        ),
    )

    display_name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=DEFAULT_USER_TIMEZONE,
        server_default=text("'" + DEFAULT_USER_TIMEZONE + "'"),
    )
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
    #: Optional avatar: local ``data/uploads/users/{user_id}/...`` key when ``STORAGE_BACKEND=local``;
    #: production will use the same string shape as an S3 object key (TBD).
    profile_photo_storage_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    language_preference: Mapped[str | None] = mapped_column(String(8), nullable=True)

    team: Mapped['Team | None'] = relationship(back_populates='users')
    posts: Mapped[list['Post']] = relationship(back_populates='author', cascade='all, delete-orphan')


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

    Localized ``name`` / ``description`` live in ``TournamentTranslation`` rows (locales ``en``, ``es``).

    ``end_date`` is derived: last moment of an *inclusive* ``length_days``-day
    window — same time-of-day as ``start_date``, ``length_days - 1`` calendar
    days later (e.g. 7 days → ``start_date`` through ``start_date + 6 days``).
    """

    __tablename__ = 'tournaments'
    __table_args__ = (
        CheckConstraint('length_days > 0', name='ck_tournaments_length_days_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    length_days: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    @property
    def end_date(self) -> datetime:
        """Inclusive last day: ``start_date`` + ``length_days - 1`` (not persisted)."""
        return self.start_date + timedelta(days=self.length_days - 1)

    team_entries: Mapped[list['TeamTournament']] = relationship(
        back_populates='tournament',
        cascade='all, delete-orphan',
    )
    challenges: Mapped[list['Challenge']] = relationship(
        back_populates='tournament',
        passive_deletes=True,
        order_by='Challenge.day',
    )
    translations: Mapped[list['TournamentTranslation']] = relationship(
        back_populates='tournament',
        cascade='all, delete-orphan',
    )


class TournamentTranslation(Base):
    """Localized tournament title and description (``en`` / ``es``)."""

    __tablename__ = 'tournament_translations'
    __table_args__ = (CheckConstraint("locale IN ('en', 'es')", name='ck_tournament_translations_locale'),)

    tournament_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('tournaments.id', ondelete='CASCADE'),
        primary_key=True,
    )
    locale: Mapped[str] = mapped_column(String(8), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    tournament: Mapped['Tournament'] = relationship(back_populates='translations')


class Challenge(Base):
    """
    A task within a tournament (prototype ``event_challenges`` / global challenges).

    Localized ``title`` / ``description`` live in ``ChallengeTranslation`` rows (locales ``en``, ``es``).

    ``tournament_id`` may be NULL after the parent tournament is deleted; challenges, posts,
    and likes are retained. ``day`` is still 1-based relative to the tournament when linked.

    ``start_date`` / ``end_date`` are derived from ``tournament.start_date`` and ``day`` when a
    tournament is linked. Enforce ``day <= tournament.length_days`` in application logic when linked.
    """

    __tablename__ = 'challenges'
    __table_args__ = (
        CheckConstraint('day >= 1', name='ck_challenges_day_positive'),
        CheckConstraint('points >= 0', name='ck_challenges_points_nonnegative'),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey('tournaments.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    challenge_type: Mapped[ChallengeType] = mapped_column(
        SAEnum(ChallengeType, values_callable=lambda x: [e.value for e in x], native_enum=False, length=32),
        nullable=False,
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    tournament: Mapped['Tournament | None'] = relationship(back_populates='challenges')

    posts: Mapped[list['Post']] = relationship(back_populates='challenge', cascade='all, delete-orphan')
    translations: Mapped[list['ChallengeTranslation']] = relationship(
        back_populates='challenge',
        cascade='all, delete-orphan',
    )

    @property
    def start_date(self) -> datetime | None:
        """First instant of this challenge's tournament day (not persisted)."""
        if self.tournament is None:
            return None
        return self.tournament.start_date + timedelta(days=self.day - 1)

    @property
    def end_date(self) -> datetime | None:
        """Last representable instant before the next tournament day boundary (not persisted)."""
        if self.tournament is None:
            return None
        return self.tournament.start_date + timedelta(days=self.day) - timedelta.resolution


class ChallengeTranslation(Base):
    """Localized challenge title and description (``en`` / ``es``)."""

    __tablename__ = 'challenge_translations'
    __table_args__ = (CheckConstraint("locale IN ('en', 'es')", name='ck_challenge_translations_locale'),)

    challenge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('challenges.id', ondelete='CASCADE'),
        primary_key=True,
    )
    locale: Mapped[str] = mapped_column(String(8), primary_key=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    challenge: Mapped['Challenge'] = relationship(back_populates='translations')


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
    challenge_credits: Mapped[list['TeamTournamentChallengeCredit']] = relationship(
        back_populates='team_tournament',
        cascade='all, delete-orphan',
    )
    score_events: Mapped[list['TeamTournamentScoreEvent']] = relationship(
        back_populates='team_tournament',
        cascade='all, delete-orphan',
    )


class Post(Base):
    """
    User submission for a challenge: optional text (``comment``), optional photo(s) via
    ``photos``. At least one of a non-empty comment or one photo is required — enforce in
    the API layer (not expressible cleanly as a single-table CHECK).

    Each user may have **at most one** post per challenge (multiple teammates may each have
    their own post for the same challenge). Enforced in the database, not only in the API.

    ``approved`` gates visibility of user-generated content until a moderator accepts it.
    """

    __tablename__ = 'posts'
    __table_args__ = (
        UniqueConstraint('user_id', 'challenge_id', name='uq_posts_user_id_challenge_id'),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    #: ``ON DELETE CASCADE`` — removing the challenge deletes this post; ``post_photos`` cascade from ``posts``.
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('challenges.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sql_false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    author: Mapped['User'] = relationship(back_populates='posts')
    challenge: Mapped['Challenge'] = relationship(back_populates='posts')
    photos: Mapped[list['PostPhoto']] = relationship(
        back_populates='post',
        cascade='all, delete-orphan',
        order_by='PostPhoto.sort_order',
    )


class PostLike(Base):
    """
    One row per (user, post) while the post exists.

    ``post_id`` is nullable and the FK uses ``ON DELETE SET NULL`` so removing a post leaves
    historical like rows without deleting them (see product policy on not auto-cleaning).
    """

    __tablename__ = 'post_likes'
    __table_args__ = (UniqueConstraint('user_id', 'post_id', name='uq_post_likes_user_post'),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey('posts.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


class PostPhoto(Base):
    """One image attached to a post (ordering via ``sort_order``)."""

    __tablename__ = 'post_photos'
    __table_args__ = (CheckConstraint('sort_order >= 0', name='ck_post_photos_sort_order_nonnegative'),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('posts.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    storage_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    #: Smaller JPEG beside the full image (``*_thumb.jpg`` under the same ``data/uploads/posts/{post_id}/``).
    thumbnail_storage_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    #: Auto-generated image caption (e.g. BLIP) for moderation / accessibility; optional.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')

    post: Mapped['Post'] = relationship(back_populates='photos')


class TeamTournamentChallengeCredit(Base):
    """
    At most one credit per enrolled team (``team_tournament``) per challenge.

    Exists while at least one **current** team member has an **approved** post for that challenge.
    ``points_awarded`` is a snapshot of ``Challenge.points`` at grant time (used on revoke).
    """

    __tablename__ = 'team_tournament_challenge_credits'
    __table_args__ = (
        UniqueConstraint(
            'team_tournament_id',
            'challenge_id',
            name='uq_team_tournament_challenge_credits_tt_challenge',
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    team_tournament_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('team_tournaments.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('challenges.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    points_awarded: Mapped[int] = mapped_column(Integer, nullable=False)
    anchor_post_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey('posts.id', ondelete='SET NULL'),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    team_tournament: Mapped['TeamTournament'] = relationship(back_populates='challenge_credits')


class TeamTournamentScoreEvent(Base):
    """Append-only audit trail for tournament-scoped team points (grant / revoke)."""

    __tablename__ = 'team_tournament_score_events'

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    team_tournament_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('team_tournaments.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey('challenges.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    source_post_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey('posts.id', ondelete='SET NULL'),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    team_tournament: Mapped['TeamTournament'] = relationship(back_populates='score_events')
