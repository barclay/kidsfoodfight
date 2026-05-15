"""Admin challenge CRUD within tournaments."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.content_translations import (
    challenge_translations_map,
    merge_replace_challenge_translations,
    pick_challenge_text,
    pick_tournament_text,
    replace_challenge_translations,
    translations_dict_for_challenge,
    translations_dict_for_tournament,
    tournament_translations_map,
)
from app.content_locale import AppLocale
from app.http_locale import PreferredLocale
from app.models import Challenge, ChallengeType, Tournament
from app.schemas_admin import (
    AdminChallengeCreate,
    AdminChallengeDetail,
    AdminChallengeListItem,
    AdminChallengeLocaleOut,
    AdminChallengeLocalePayload,
    AdminChallengePatch,
    AdminTournamentLocaleOut,
)

from .deps import DbSession, SuperUser

router = APIRouter(tags=['admin'])


def _assert_challenge_day(tournament: Tournament, day: int) -> None:
    if day < 1 or day > tournament.length_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'day must be between 1 and {tournament.length_days} for this tournament',
        )


def _locale_out_for_challenge(
    cm: dict[tuple[uuid.UUID, str], tuple[str, str | None]],
    challenge_id: uuid.UUID,
) -> dict[str, AdminChallengeLocaleOut]:
    raw = translations_dict_for_challenge(cm, challenge_id)
    return {k: AdminChallengeLocaleOut(title=v['title'], description=v['description']) for k, v in raw.items()}


def _tournament_locale_out_for_challenge(
    tm: dict[tuple[uuid.UUID, str], tuple[str, str | None]],
    tournament_id: uuid.UUID,
) -> dict[str, AdminTournamentLocaleOut]:
    raw = translations_dict_for_tournament(tm, tournament_id)
    return {k: AdminTournamentLocaleOut(name=v['name'], description=v['description']) for k, v in raw.items()}


async def _build_challenge_detail(
    db: DbSession,
    *,
    challenge: Challenge,
    tournament_name_fallback: str | None,
    locale: AppLocale,
) -> AdminChallengeDetail:
    cm = await challenge_translations_map(db, challenge_ids=[challenge.id])
    tid = challenge.tournament_id
    tm = await tournament_translations_map(db, tournament_ids=[tid] if tid else [])
    if tid:
        tname = pick_tournament_text(tm, tid, locale)[0] or '(tournament deleted)'
    else:
        tname = tournament_name_fallback or '(tournament deleted)'
    title, desc = pick_challenge_text(cm, challenge.id, locale)
    tourn_locales: dict[str, AdminTournamentLocaleOut] = {}
    if tid:
        tourn_locales = _tournament_locale_out_for_challenge(tm, tid)
    return AdminChallengeDetail(
        id=challenge.id,
        tournament_id=challenge.tournament_id,
        tournament_name=tname,
        title=title,
        description=desc,
        challenge_type=challenge.challenge_type.value,
        points=challenge.points,
        day=challenge.day,
        created_at=challenge.created_at,
        translations=_locale_out_for_challenge(cm, challenge.id),
        tournament_translations=tourn_locales,
    )


@router.get('/challenges', response_model=list[AdminChallengeListItem])
async def admin_list_challenges(
    db: DbSession,
    _: SuperUser,
    locale: PreferredLocale,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tournament_id: uuid.UUID | None = Query(None, description='Filter by tournament'),
) -> list[AdminChallengeListItem]:
    stmt = (
        select(Challenge, Tournament.id.label('tid'))
        .outerjoin(Tournament, Challenge.tournament_id == Tournament.id)
        .order_by(Tournament.start_date.desc().nulls_last(), Challenge.day.asc())
        .offset(skip)
        .limit(limit)
    )
    if tournament_id is not None:
        stmt = stmt.where(Challenge.tournament_id == tournament_id)
    result = await db.execute(stmt)
    rows = result.all()
    if not rows:
        return []
    challenges = [c for c, _ in rows]
    tids = {c.tournament_id for c in challenges if c.tournament_id}
    cids = [c.id for c in challenges]
    cm = await challenge_translations_map(db, challenge_ids=cids)
    tm = await tournament_translations_map(db, tournament_ids=tids)
    items: list[AdminChallengeListItem] = []
    for challenge, _tid in rows:
        tid = challenge.tournament_id
        if tid:
            tname = pick_tournament_text(tm, tid, locale)[0] or '(tournament deleted)'
        else:
            tname = '(tournament deleted)'
        title, desc = pick_challenge_text(cm, challenge.id, locale)
        items.append(
            AdminChallengeListItem(
                id=challenge.id,
                tournament_id=challenge.tournament_id,
                tournament_name=tname,
                title=title,
                description=desc,
                challenge_type=challenge.challenge_type.value,
                points=challenge.points,
                day=challenge.day,
                created_at=challenge.created_at,
            )
        )
    items.sort(key=lambda row: (row.tournament_name.lower(), row.day, row.title.lower()))
    return items


@router.get('/challenges/{challenge_id}', response_model=AdminChallengeDetail)
async def admin_get_challenge(
    db: DbSession,
    _: SuperUser,
    challenge_id: uuid.UUID,
    locale: PreferredLocale,
) -> AdminChallengeDetail:
    stmt = (
        select(Challenge, Tournament.id.label('tid'))
        .outerjoin(Tournament, Challenge.tournament_id == Tournament.id)
        .where(Challenge.id == challenge_id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')
    challenge, _ = row
    return await _build_challenge_detail(db, challenge=challenge, tournament_name_fallback=None, locale=locale)


def _translations_to_rows(body_trans: dict[str, AdminChallengeLocalePayload]) -> dict[str, tuple[str, str | None]]:
    return {loc: (p.title, p.description) for loc, p in body_trans.items()}


@router.post('/challenges', response_model=AdminChallengeDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_challenge(
    db: DbSession,
    _: SuperUser,
    body: AdminChallengeCreate,
    locale: PreferredLocale,
) -> AdminChallengeDetail:
    tournament = await db.get(Tournament, body.tournament_id)
    if tournament is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    _assert_challenge_day(tournament, body.day)
    c = Challenge(
        tournament_id=body.tournament_id,
        challenge_type=ChallengeType(body.challenge_type),
        points=body.points,
        day=body.day,
    )
    db.add(c)
    await db.flush()
    await replace_challenge_translations(
        db,
        challenge_id=c.id,
        per_locale=_translations_to_rows(body.translations),
    )
    await db.flush()
    await db.refresh(c)
    return await _build_challenge_detail(db, challenge=c, tournament_name_fallback=None, locale=locale)


@router.patch('/challenges/{challenge_id}', response_model=AdminChallengeDetail)
async def admin_patch_challenge(
    db: DbSession,
    _: SuperUser,
    challenge_id: uuid.UUID,
    body: AdminChallengePatch,
    locale: PreferredLocale,
) -> AdminChallengeDetail:
    c = await db.get(Challenge, challenge_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')

    data = body.model_dump(exclude_unset=True)
    if 'tournament_id' in data:
        new_tid = data.pop('tournament_id')
        if new_tid is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='tournament_id cannot be null',
            )
        tournament = await db.get(Tournament, new_tid)
        if tournament is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
        c.tournament_id = new_tid

    if 'challenge_type' in data:
        c.challenge_type = ChallengeType(data['challenge_type'])
    if 'points' in data:
        c.points = data['points']
    if 'day' in data:
        c.day = data['day']

    if body.translations is not None:
        await merge_replace_challenge_translations(
            db,
            challenge_id=c.id,
            updates=_translations_to_rows(dict(body.translations)),
        )

    tournament = await db.get(Tournament, c.tournament_id)
    if tournament is not None:
        _assert_challenge_day(tournament, c.day)
    elif c.day < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='day must be at least 1',
        )

    await db.flush()
    await db.refresh(c)
    return await _build_challenge_detail(db, challenge=c, tournament_name_fallback=None, locale=locale)


@router.delete('/challenges/{challenge_id}', status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_challenge(db: DbSession, _: SuperUser, challenge_id: uuid.UUID) -> None:
    c = await db.get(Challenge, challenge_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')
    await db.delete(c)
    await db.flush()
