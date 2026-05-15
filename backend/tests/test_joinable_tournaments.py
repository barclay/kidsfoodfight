"""Joinable tournament list and team enrollment (requires ``DATABASE_URL``)."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Iterator
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from app.database import AsyncSessionLocal
from app.main import app
from app.models import TeamTournament, Tournament, TournamentTranslation, User


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def _unique_email() -> str:
    return f'join-t-{uuid.uuid4().hex[:12]}@example.com'


@pytest.fixture(scope='module')
def _require_db() -> None:
    async def ping() -> bool:
        try:
            async with AsyncSessionLocal() as s:
                await s.execute(select(1))
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

    async def insert_tournament() -> str:
        async with AsyncSessionLocal() as s:
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

    tournament_id = asyncio.run(insert_tournament())

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

    async def assert_team_tournament_row() -> None:
        async with AsyncSessionLocal() as s:
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

    asyncio.run(assert_team_tournament_row())

    dup = client.post(
        '/api/v1/challenges/join-tournament',
        headers=headers,
        json={'tournament_id': tournament_id},
    )
    assert dup.status_code == 409
