"""
Dev seed: fixture users and teams for richer local testing.

Requires ``DATABASE_URL``, ``SEED_ADMIN_EMAIL``, and a password for hashing fixture accounts
(``SEED_DEV_USER_PASSWORD`` or, if unset, ``SEED_ADMIN_PASSWORD``).

Behavior (idempotent by email):

- Ensures the admin user has a home team (creates one if ``team_id`` is null; name from
  ``SEED_HOME_TEAM_NAME``, default ``Home Table``).
- **Kate** and **Alaina** (``kff.seed.kate@local.test`` / ``kff.seed.alaina@local.test``) are
  upserted and assigned to that same home team.
- **Jordan**, **Riley**, and **Morgan** each get their own team and are the sole member.

All distinct teams are enrolled in Spring Fiesta (``scripts.seed_spring_fiesta``) if that
tournament row exists.

Run automatically after ``seed_spring_fiesta`` via ``python -m scripts.seed_dev``.
"""

from __future__ import annotations

import asyncio
import os
import uuid

from fastapi_users.password import PasswordHelper
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import DEFAULT_USER_TIMEZONE, Team, TeamTournament, User, Tournament
from scripts.seed_spring_fiesta import SPRING_FIESTA_TOURNAMENT_ID

# (email, display_name) — same home team as admin after seed runs.
_FIXTURE_HOME_MEMBERS: tuple[tuple[str, str], ...] = (
    ('kff.seed.kate@local.test', 'Kate'),
    ('kff.seed.alaina@local.test', 'Alaina'),
)

# (email, display_name, team_name)
_FIXTURE_SOLO: tuple[tuple[str, str, str], ...] = (
    ('kff.seed.jordan@local.test', 'Jordan', "Jordan's Table"),
    ('kff.seed.riley@local.test', 'Riley', "Riley's Rapids"),
    ('kff.seed.morgan@local.test', 'Morgan', "Morgan's Moonshots"),
)


def fixture_author_emails(admin_email: str) -> list[str]:
    """Ordered list for sample-post round-robin: admin first, then home members, then solo users."""
    home = [e for e, _ in _FIXTURE_HOME_MEMBERS]
    solo = [e for e, _, _ in _FIXTURE_SOLO]
    return [admin_email, *home, *solo]


async def resolve_fixture_author_users(session: AsyncSession, *, admin_email: str) -> list[User]:
    """Load users for ``fixture_author_emails`` order; raises if any row is missing."""
    emails = fixture_author_emails(admin_email)
    out: list[User] = []
    for em in emails:
        r = await session.execute(select(User).where(User.email == em))
        u = r.scalar_one_or_none()
        if u is None:
            raise SystemExit(
                f'[seed_dev_users] Missing user {em!r}. Run ``python -m scripts.seed_dev_users`` '
                'before seed_sample_posts (``seed_dev`` runs it automatically).'
            )
        out.append(u)
    return out


def _dev_password() -> str:
    p = os.environ.get('SEED_DEV_USER_PASSWORD', '').strip()
    if p:
        return p
    p = os.environ.get('SEED_ADMIN_PASSWORD', '').strip()
    if p:
        return p
    raise SystemExit(
        '[seed_dev_users] Set SEED_DEV_USER_PASSWORD or SEED_ADMIN_PASSWORD to hash fixture user passwords.'
    )


async def _ensure_display_name(session: AsyncSession, desired: str, email: str) -> str:
    """Return ``desired`` if free; otherwise suffix so the row for ``email`` can keep a unique name."""
    r = await session.execute(select(User).where(User.display_name == desired))
    existing = r.scalar_one_or_none()
    if existing is None or existing.email == email:
        return desired[:64]
    suffix = f'_{uuid.uuid4().hex[:6]}'
    return (desired[: max(0, 64 - len(suffix))] + suffix)[:64]


async def _upsert_user(
    session: AsyncSession,
    *,
    email: str,
    display_name: str,
    hashed: str,
    team_id: uuid.UUID | None,
    is_superuser: bool,
) -> User:
    r = await session.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    name = await _ensure_display_name(session, display_name, email)
    if user is not None:
        user.hashed_password = hashed
        user.is_active = True
        user.is_verified = True
        user.is_superuser = is_superuser
        user.display_name = name
        user.team_id = team_id
        return user
    u = User(
        email=email,
        hashed_password=hashed,
        is_active=True,
        is_superuser=is_superuser,
        is_verified=True,
        display_name=name,
        timezone=DEFAULT_USER_TIMEZONE,
        team_id=team_id,
    )
    session.add(u)
    await session.flush()
    return u


async def _ensure_team_tournament(session: AsyncSession, *, team_id: uuid.UUID) -> None:
    r = await session.execute(
        select(TeamTournament.id).where(
            TeamTournament.team_id == team_id,
            TeamTournament.tournament_id == SPRING_FIESTA_TOURNAMENT_ID,
        )
    )
    if r.scalar_one_or_none() is not None:
        return
    tr = await session.get(Tournament, SPRING_FIESTA_TOURNAMENT_ID)
    if tr is None:
        print(
            '[seed_dev_users] Spring Fiesta tournament not found; skipping team_tournaments '
            '(run seed_spring_fiesta with SEED_SPRING_FIESTA=1 first).'
        )
        return
    session.add(TeamTournament(team_id=team_id, tournament_id=SPRING_FIESTA_TOURNAMENT_ID))
    await session.flush()


async def run() -> None:
    admin_email = os.environ.get('SEED_ADMIN_EMAIL', '').strip()
    if not admin_email:
        print('[seed_dev_users] SEED_ADMIN_EMAIL not set; skipping.')
        return

    url = os.environ['DATABASE_URL']
    engine = create_async_engine(url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    ph = PasswordHelper()
    hashed = ph.hash(_dev_password())

    async with factory() as session:
        r = await session.execute(select(User).where(User.email == admin_email))
        admin = r.scalar_one_or_none()
        if admin is None:
            await engine.dispose()
            raise SystemExit(f'[seed_dev_users] No user with email {admin_email!r}. Run seed_admin first.')

        home_team_name = os.environ.get('SEED_HOME_TEAM_NAME', 'Home Table').strip() or 'Home Table'

        if admin.team_id is None:
            team = Team(name=home_team_name)
            session.add(team)
            await session.flush()
            admin.team_id = team.id
            print(f'[seed_dev_users] Created home team {team.name!r} ({team.id}) for admin.')
        else:
            team = await session.get(Team, admin.team_id)
            if team is None:
                team = Team(name=home_team_name)
                session.add(team)
                await session.flush()
                admin.team_id = team.id
                print('[seed_dev_users] Admin had stale team_id; created new home team.')
            else:
                print(f'[seed_dev_users] Admin already on team {team.name!r} ({team.id}).')

        assert team is not None
        home_team_id = team.id

        for em, dn in _FIXTURE_HOME_MEMBERS:
            u = await _upsert_user(
                session,
                email=em,
                display_name=dn,
                hashed=hashed,
                team_id=home_team_id,
                is_superuser=False,
            )
            print(f'[seed_dev_users] Home team member ready: {em} ({u.display_name})')

        team_ids: set[uuid.UUID] = {home_team_id}

        for em, dn, tn in _FIXTURE_SOLO:
            ur = await session.execute(select(User).where(User.email == em))
            existing = ur.scalar_one_or_none()

            solo_team: Team | None = None
            if existing is not None and existing.team_id is not None:
                solo_team = await session.get(Team, existing.team_id)

            if solo_team is None:
                solo_team = Team(name=tn)
                session.add(solo_team)
                await session.flush()
                if existing is not None:
                    existing.team_id = solo_team.id
                    await session.flush()

            u = await _upsert_user(
                session,
                email=em,
                display_name=dn,
                hashed=hashed,
                team_id=solo_team.id,
                is_superuser=False,
            )
            team_ids.add(solo_team.id)
            print(f'[seed_dev_users] Solo user ready: {em} ({u.display_name}) → team {tn!r}')

        for tid in sorted(team_ids, key=lambda x: str(x)):
            await _ensure_team_tournament(session, team_id=tid)

        await session.commit()

    await engine.dispose()
    print('[seed_dev_users] Done.')


def main() -> None:
    asyncio.run(run())


if __name__ == '__main__':
    main()
