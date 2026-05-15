"""Bulk load and resolve localized challenge / tournament copy."""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Mapping

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_locale import FALLBACK_LOCALE, AppLocale
from app.models import ChallengeTranslation, TournamentTranslation


async def challenge_translations_map(
    db: AsyncSession, *, challenge_ids: Iterable[uuid.UUID]
) -> dict[tuple[uuid.UUID, str], tuple[str, str | None]]:
    ids = list(dict.fromkeys(challenge_ids))
    if not ids:
        return {}
    r = await db.execute(select(ChallengeTranslation).where(ChallengeTranslation.challenge_id.in_(ids)))
    return {(row.challenge_id, row.locale): (row.title, row.description) for row in r.scalars().all()}


def pick_challenge_text(
    m: Mapping[tuple[uuid.UUID, str], tuple[str, str | None]],
    challenge_id: uuid.UUID,
    locale: AppLocale,
) -> tuple[str, str | None]:
    if (challenge_id, locale) in m:
        return m[challenge_id, locale]
    if (challenge_id, FALLBACK_LOCALE) in m:
        return m[challenge_id, FALLBACK_LOCALE]
    return ('', None)


async def tournament_translations_map(
    db: AsyncSession, *, tournament_ids: Iterable[uuid.UUID]
) -> dict[tuple[uuid.UUID, str], tuple[str, str | None]]:
    ids = list(dict.fromkeys(tournament_ids))
    if not ids:
        return {}
    r = await db.execute(select(TournamentTranslation).where(TournamentTranslation.tournament_id.in_(ids)))
    return {(row.tournament_id, row.locale): (row.name, row.description) for row in r.scalars().all()}


def pick_tournament_text(
    m: Mapping[tuple[uuid.UUID, str], tuple[str, str | None]],
    tournament_id: uuid.UUID,
    locale: AppLocale,
) -> tuple[str, str | None]:
    if (tournament_id, locale) in m:
        return m[tournament_id, locale]
    if (tournament_id, FALLBACK_LOCALE) in m:
        return m[tournament_id, FALLBACK_LOCALE]
    return ('', None)


async def replace_challenge_translations(
    db: AsyncSession,
    *,
    challenge_id: uuid.UUID,
    per_locale: dict[str, tuple[str, str | None]],
) -> None:
    """Replace all translation rows for a challenge from editor payload (non-empty titles only)."""
    await db.execute(delete(ChallengeTranslation).where(ChallengeTranslation.challenge_id == challenge_id))
    for loc, (title, desc) in per_locale.items():
        if loc not in ('en', 'es'):
            continue
        t = title.strip()
        if not t:
            continue
        db.add(
            ChallengeTranslation(
                challenge_id=challenge_id,
                locale=loc,
                title=t,
                description=(desc.strip() if isinstance(desc, str) and desc.strip() else None),
            )
        )


async def replace_tournament_translations(
    db: AsyncSession,
    *,
    tournament_id: uuid.UUID,
    per_locale: dict[str, tuple[str, str | None]],
) -> None:
    await db.execute(delete(TournamentTranslation).where(TournamentTranslation.tournament_id == tournament_id))
    for loc, (name, desc) in per_locale.items():
        if loc not in ('en', 'es'):
            continue
        n = name.strip()
        if not n:
            continue
        db.add(
            TournamentTranslation(
                tournament_id=tournament_id,
                locale=loc,
                name=n,
                description=(desc.strip() if isinstance(desc, str) and desc.strip() else None),
            )
        )


def translations_dict_for_challenge(
    m: Mapping[tuple[uuid.UUID, str], tuple[str, str | None]],
    challenge_id: uuid.UUID,
) -> dict[str, dict[str, str | None]]:
    """All locales for admin editor (empty strings when a row is missing)."""
    out: dict[str, dict[str, str | None]] = {}
    for loc in ('en', 'es'):
        if (challenge_id, loc) in m:
            t, d = m[challenge_id, loc]
            out[loc] = {'title': t, 'description': d}
        else:
            out[loc] = {'title': '', 'description': None}
    return out


def translations_dict_for_tournament(
    m: Mapping[tuple[uuid.UUID, str], tuple[str, str | None]],
    tournament_id: uuid.UUID,
) -> dict[str, dict[str, str | None]]:
    out: dict[str, dict[str, str | None]] = {}
    for loc in ('en', 'es'):
        if (tournament_id, loc) in m:
            n, d = m[tournament_id, loc]
            out[loc] = {'name': n, 'description': d}
        else:
            out[loc] = {'name': '', 'description': None}
    return out


async def merge_replace_challenge_translations(
    db: AsyncSession,
    *,
    challenge_id: uuid.UUID,
    updates: dict[str, tuple[str, str | None]],
) -> None:
    """Overlay ``updates`` onto existing rows, then replace (PATCH-safe)."""
    cm = await challenge_translations_map(db, challenge_ids=[challenge_id])
    merged: dict[str, tuple[str, str | None]] = {}
    for loc in ('en', 'es'):
        merged[loc] = cm.get((challenge_id, loc), ('', None))
    for loc, tup in updates.items():
        if loc in ('en', 'es'):
            merged[loc] = tup
    await replace_challenge_translations(db, challenge_id=challenge_id, per_locale=merged)


async def merge_replace_tournament_translations(
    db: AsyncSession,
    *,
    tournament_id: uuid.UUID,
    updates: dict[str, tuple[str, str | None]],
) -> None:
    tm = await tournament_translations_map(db, tournament_ids=[tournament_id])
    merged: dict[str, tuple[str, str | None]] = {}
    for loc in ('en', 'es'):
        merged[loc] = tm.get((tournament_id, loc), ('', None))
    for loc, tup in updates.items():
        if loc in ('en', 'es'):
            merged[loc] = tup
    await replace_tournament_translations(db, tournament_id=tournament_id, per_locale=merged)
