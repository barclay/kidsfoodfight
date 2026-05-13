"""Tournament calendar windows using the user's IANA timezone (local dates)."""

from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Keep in sync with ``app.models.DEFAULT_USER_TIMEZONE``.
_FALLBACK_USER_TIMEZONE = 'America/Los_Angeles'


def resolve_user_zone(timezone_name: str) -> ZoneInfo:
    """Return ``ZoneInfo`` for ``timezone_name``, falling back to the app default if invalid."""
    try:
        return ZoneInfo(timezone_name.strip())
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(_FALLBACK_USER_TIMEZONE)


def local_tournament_day_index(
    *,
    tournament_start: datetime,
    tournament_length_days: int,
    now_utc: datetime,
    user_tz: ZoneInfo,
) -> int | None:
    """
    1-based tournament day index from the **user's local calendar** (``start_date`` and ``now``
    converted to ``user_tz``, then date difference + 1).

    Returns ``None`` if ``now`` is before the tournament's first local day or after the last
    local day (``length_days`` inclusive from the local start date).
    """
    if tournament_length_days < 1:
        return None
    if tournament_start.tzinfo is None:
        raise ValueError('tournament_start must be timezone-aware')
    if now_utc.tzinfo is None:
        raise ValueError('now_utc must be timezone-aware')

    start_local_date = tournament_start.astimezone(user_tz).date()
    today_local = now_utc.astimezone(user_tz).date()
    day_index = (today_local - start_local_date).days + 1
    if day_index < 1 or day_index > tournament_length_days:
        return None
    return day_index
