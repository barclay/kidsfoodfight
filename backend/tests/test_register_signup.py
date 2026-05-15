"""Registration with new team or invite code (requires ``DATABASE_URL``)."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from app.database import AsyncSessionLocal
from app.invite_code import generate_invite_code
from app.main import app
from app.models import Team, User


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def _unique_email() -> str:
    return f'signup-{uuid.uuid4().hex[:12]}@example.com'


@pytest.fixture(scope='module')
def _require_db() -> None:
    """Skip entire module if Postgres is not reachable (same expectation as local smoke)."""

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
def test_register_new_team_then_login(client: TestClient) -> None:
    email = _unique_email()
    body = {
        'email': email,
        'password': 'secret1',
        'display_name': f'Player {uuid.uuid4().hex[:6]}',
        'timezone': 'America/Los_Angeles',
        'team_name': f'Family {uuid.uuid4().hex[:6]}',
    }
    r = client.post('/api/v1/auth/register', json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data['email'] == email

    token_r = client.post(
        '/api/v1/auth/login',
        data={'username': email, 'password': 'secret1'},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    assert token_r.status_code == 200, token_r.text
    token = token_r.json()['access_token']

    me = client.get('/api/v1/users/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200
    assert me.json()['email'] == email


@pytest.mark.usefixtures('_require_db')
def test_register_duplicate_email(client: TestClient) -> None:
    email = _unique_email()
    base = {
        'email': email,
        'password': 'secret1',
        'display_name': f'Dup {uuid.uuid4().hex[:6]}',
        'team_name': f'Team {uuid.uuid4().hex[:6]}',
    }
    assert client.post('/api/v1/auth/register', json=base).status_code == 201
    r2 = client.post('/api/v1/auth/register', json={**base, 'display_name': f'Other {uuid.uuid4().hex[:6]}'})
    assert r2.status_code == 400
    assert r2.json()['detail'] == 'REGISTER_USER_ALREADY_EXISTS'


@pytest.mark.usefixtures('_require_db')
def test_register_with_invite_joins_team(client: TestClient) -> None:
    async def make_team_with_known_code() -> tuple[str, str]:
        code = generate_invite_code()
        async with AsyncSessionLocal() as s:
            team = Team(name=f'Invite test {uuid.uuid4().hex[:6]}', invite_code=code)
            s.add(team)
            await s.commit()
            await s.refresh(team)
            return str(team.id), code

    team_id, code = asyncio.run(make_team_with_known_code())
    email = _unique_email()
    body = {
        'email': email,
        'password': 'secret1',
        'display_name': f'Joiner {uuid.uuid4().hex[:6]}',
        'invite_code': f'{code[:4]}-{code[4:8]}-{code[8:]}',
    }
    r = client.post('/api/v1/auth/register', json=body)
    assert r.status_code == 201, r.text

    async def assert_user_on_team() -> None:
        async with AsyncSessionLocal() as s:
            u = await s.execute(select(User).where(User.email == email))
            user = u.scalar_one()
            assert user.team_id is not None
            assert str(user.team_id) == team_id

    asyncio.run(assert_user_on_team())


@pytest.mark.usefixtures('_require_db')
def test_register_invalid_invite(client: TestClient) -> None:
    body = {
        'email': _unique_email(),
        'password': 'secret1',
        'display_name': f'X {uuid.uuid4().hex[:6]}',
        'invite_code': 'A' * 14,
    }
    r = client.post('/api/v1/auth/register', json=body)
    assert r.status_code == 400
    assert r.json()['detail'] == 'No team matches that invite code.'


@pytest.mark.usefixtures('_require_db')
def test_users_me_patch_language_preference(client: TestClient) -> None:
    email = _unique_email()
    reg = {
        'email': email,
        'password': 'secret1',
        'display_name': f'Lang {uuid.uuid4().hex[:6]}',
        'timezone': 'America/Los_Angeles',
        'team_name': f'Family {uuid.uuid4().hex[:6]}',
    }
    assert client.post('/api/v1/auth/register', json=reg).status_code == 201
    token_r = client.post(
        '/api/v1/auth/login',
        data={'username': email, 'password': 'secret1'},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    assert token_r.status_code == 200
    token = token_r.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    me0 = client.get('/api/v1/users/me', headers=headers)
    assert me0.status_code == 200
    assert me0.json().get('language_preference') is None

    bad = client.patch('/api/v1/users/me', headers=headers, json={'language_preference': 'fr'})
    assert bad.status_code == 422

    ok = client.patch('/api/v1/users/me', headers=headers, json={'language_preference': 'es'})
    assert ok.status_code == 200, ok.text
    assert ok.json()['language_preference'] == 'es'

    me1 = client.get('/api/v1/users/me', headers=headers)
    assert me1.json()['language_preference'] == 'es'
