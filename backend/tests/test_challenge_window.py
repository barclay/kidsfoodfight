"""Tests for ``challenge_window`` local tournament day indexing."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.challenge_window import local_tournament_day_index, resolve_user_zone


def test_resolve_user_zone_invalid_falls_back() -> None:
    z = resolve_user_zone('Not/A/Real/Zone')
    assert z == ZoneInfo('America/Los_Angeles')


def test_local_day_one_utc() -> None:
    start = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    now_utc = datetime(2026, 3, 1, 15, 0, tzinfo=timezone.utc)
    got = local_tournament_day_index(
        tournament_start=start,
        tournament_length_days=7,
        now_utc=now_utc,
        user_tz=ZoneInfo('UTC'),
    )
    assert got == 1


def test_local_day_before_start_utc() -> None:
    start = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    now_utc = datetime(2026, 2, 28, 12, 0, tzinfo=timezone.utc)
    got = local_tournament_day_index(
        tournament_start=start,
        tournament_length_days=7,
        now_utc=now_utc,
        user_tz=ZoneInfo('UTC'),
    )
    assert got is None


def test_local_day_last_inclusive_utc() -> None:
    start = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    now_utc = datetime(2026, 3, 7, 23, 0, tzinfo=timezone.utc)
    got = local_tournament_day_index(
        tournament_start=start,
        tournament_length_days=7,
        now_utc=now_utc,
        user_tz=ZoneInfo('UTC'),
    )
    assert got == 7


def test_local_day_after_tournament_utc() -> None:
    start = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    now_utc = datetime(2026, 3, 8, 12, 0, tzinfo=timezone.utc)
    got = local_tournament_day_index(
        tournament_start=start,
        tournament_length_days=7,
        now_utc=now_utc,
        user_tz=ZoneInfo('UTC'),
    )
    assert got is None


def test_local_day_la_day_two() -> None:
    start = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    # March 2 afternoon UTC → March 2 in Los Angeles (PST)
    now_utc = datetime(2026, 3, 2, 20, 0, tzinfo=timezone.utc)
    got = local_tournament_day_index(
        tournament_start=start,
        tournament_length_days=7,
        now_utc=now_utc,
        user_tz=ZoneInfo('America/Los_Angeles'),
    )
    assert got == 2


def test_length_zero_returns_none() -> None:
    got = local_tournament_day_index(
        tournament_start=datetime(2026, 3, 1, tzinfo=timezone.utc),
        tournament_length_days=0,
        now_utc=datetime(2026, 3, 1, tzinfo=timezone.utc),
        user_tz=ZoneInfo('UTC'),
    )
    assert got is None
