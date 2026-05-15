"""Joinable tournament list and team enrollment (requires ``DATABASE_URL``)."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable, Iterator
from datetime import datetime
from typing import TypeVar
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from starlette.testclient import TestClient

from app.config import settings
from app.main import app
from app.models import TeamTournament, Tournament, TournamentTranslation, User

_T = TypeVar('_T')


async def _run_on_fresh_engine(fn: Callable[[AsyncSession], Awaitable[_T]]) -> _T:
    """Run ``fn`` with a disposable async engine.

    ``Starlette.TestClient`` uses the app's global async engine on its own event loop.
    ``asyncio.run(...)`` uses a different loop; reusing ``AsyncSessionLocal`` there raises
    "Future attached to a different loop" from asyncpg. A one-off engine keeps tests isolated.
    """
    engine = create_async_engine(settings.database_url, echo=False)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with maker() as session:
            return await fn(session)
    finally:
        await engine.dispose()


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def _unique_email() -> str:
    return f'join-t-{uuid.uuid4().hex[:12]}@example.com'


@pytest.fixture(scope='module')
def _require_db() -> None:
    async def ping_session(s: AsyncSession) -> None:
        await s.execute(select(1))

    async def ping() -> bool:
        try:
            await _run_on_fresh_engine(ping_session)
            return True
        except Exception:
            return False

    if not asyncio.run(ping()):
        pytest.skip('DATABASE_URL not available or DB unreachable')


@pytest.mark.usefixtures('_require_db')
def test_joinable_tournaments_and_join(client: TestClient) -> None:
    la = ZoneInfo('America/Los_Angeles')
    today_la = datetime.now(la).date()
    start_la = datetime(today_la.year, today_la.month, today_la.day, 12, 0, 0, tzinfo=la)

    async def insert_tournament(s: AsyncSession) -> str:
        label = f'Joinable API {uuid.uuid4().hex[:6]}'
        t = Tournament(start_date=start_la, length_days=7)
        s.add(t)
        await s.flush()
        for loc in ('en', 'es'):
            s.add(
                TournamentTranslation(
                    tournament_id=t.id,
                    locale=loc,
                    name=label,
                    description=None,
                )
            )
        await s.commit()
        await s.refresh(t)
        return str(t.id)

    tournament_id = asyncio.run(_run_on_fresh_engine(insert_tournament))

    email = _unique_email()
    reg = {
        'email': email,
        'password': 'secret1',
        'display_name': f'Joiner {uuid.uuid4().hex[:6]}',
        'timezone': 'America/Los_Angeles',
        'team_name': f'Family {uuid.uuid4().hex[:6]}',
    }
    assert client.post('/api/v1/auth/register', json=reg).status_code == 201

    token_r = client.post(
        '/api/v1/auth/login',
        data={'username': email, 'password': 'secret1'},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    assert token_r.status_code == 200, token_r.text
    token = token_r.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    listed = client.get('/api/v1/challenges/joinable-tournaments', headers=headers)
    assert listed.status_code == 200, listed.text
    ids = {row['tournament_id'] for row in listed.json()}
    assert tournament_id in ids

    join = client.post(
        '/api/v1/challenges/join-tournament',
        headers=headers,
        json={'tournament_id': tournament_id},
    )
    assert join.status_code == 200, join.text
    body = join.json()
    assert body['tournament_id'] == tournament_id

    listed2 = client.get('/api/v1/challenges/joinable-tournaments', headers=headers)
    assert listed2.status_code == 200
    ids2 = {row['tournament_id'] for row in listed2.json()}
    assert tournament_id not in ids2

    async def assert_team_tournament_row(s: AsyncSession) -> None:
        u = (await s.execute(select(User).where(User.email == email))).scalar_one()
        assert u.team_id is not None
        rows = (
            await s.execute(
                select(TeamTournament).where(
                    TeamTournament.team_id == u.team_id,
                    TeamTournament.tournament_id == uuid.UUID(tournament_id),
                )
            )
        ).scalars().all()
        assert len(rows) == 1

    asyncio.run(_run_on_fresh_engine(assert_team_tournament_row))

    dup = client.post(
        '/api/v1/challenges/join-tournament',
        headers=headers,
        json={'tournament_id': tournament_id},
    )
    assert dup.status_code == 409
