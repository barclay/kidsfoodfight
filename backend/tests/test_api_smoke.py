"""Smoke tests: every registered HTTP route responds without a server error.

Each case sends a minimal unauthenticated request (no body, placeholder path
params). Expected outcomes are client errors (401, 404, 422, …) or success —
never 5xx. This guards wiring, dependency injection, and DB connectivity in CI.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Callable, Iterator

import pytest
from fastapi.routing import APIRoute
from httpx import Response
from starlette.testclient import TestClient

from app.main import app

_PLACEHOLDER_UUID = str(uuid.UUID('00000000-0000-4000-8000-000000000001'))


def _fill_path_params(path: str) -> str:
    """Replace ``{name}`` / ``{name:type}`` with literals safe for smoke calls."""

    def repl(match: re.Match[str]) -> str:
        raw = match.group(1)
        name = raw.split(':', 1)[0]
        if name == 'storage_path':
            return f'data/uploads/{_PLACEHOLDER_UUID}/smoke-nonexistent.bin'
        return _PLACEHOLDER_UUID

    return re.sub(r'\{([^}]+)\}', repl, path)


def _method_path_pairs() -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        filled = _fill_path_params(route.path)
        for method in sorted(route.methods):
            if method == 'HEAD':
                continue
            if method == 'GET' and filled == '/health':
                continue
            pairs.append((method, filled))
    return pairs


_SMOKE_PAIRS = _method_path_pairs()
_SMOKE_IDS = [f'{method} {path}' for method, path in _SMOKE_PAIRS]


def _request_fn(client: TestClient, method: str) -> Callable[..., Response]:
    m = method.upper()
    mapping: dict[str, Callable[..., Response]] = {
        'GET': client.get,
        'POST': client.post,
        'PUT': client.put,
        'PATCH': client.patch,
        'DELETE': client.delete,
        'OPTIONS': client.options,
    }
    if m not in mapping:
        pytest.skip(f'Unsupported HTTP method for smoke: {m}')
    return mapping[m]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def test_health_ok(client: TestClient) -> None:
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json() == {'status': 'ok'}


@pytest.mark.parametrize(('method', 'path'), _SMOKE_PAIRS, ids=_SMOKE_IDS)
def test_route_not_server_error(client: TestClient, method: str, path: str) -> None:
    fn = _request_fn(client, method)
    r = fn(path)
    assert r.status_code < 500, f'{method} {path} -> {r.status_code}: {r.text[:500]}'
