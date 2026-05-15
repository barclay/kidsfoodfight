"""Admin tournament CRUD, leaderboard, and clone."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.content_translations import (
    merge_replace_tournament_translations,
    pick_tournament_text,
    replace_challenge_translations,
    replace_tournament_translations,
    tournament_translations_map,
    translations_dict_for_tournament,
)
from app.http_locale import PreferredLocale
from app.models import Challenge, Tournament
from app.schemas_admin import (
    AdminTournamentCreate,
    AdminTournamentDetail,
    AdminTournamentLeaderboardRow,
    AdminTournamentListItem,
    AdminTournamentLocaleOut,
    AdminTournamentPatch,
)
from app.team_challenge_scoring import fetch_tournament_leaderboard_rows

from .deps import DbSession, SuperUser

router = APIRouter(tags=['admin'])


def _locale_out_tournament(
    tm: dict[tuple[uuid.UUID, str], tuple[str, str | None]],
    tournament_id: uuid.UUID,
) -> dict[str, AdminTournamentLocaleOut]:
    raw = translations_dict_for_tournament(tm, tournament_id)
    return {k: AdminTournamentLocaleOut(name=v['name'], description=v['description']) for k, v in raw.items()}


async def _tournament_to_list_item(
    db: DbSession,
    *,
    tournament: Tournament,
    locale: PreferredLocale,
) -> AdminTournamentListItem:
    tm = await tournament_translations_map(db, tournament_ids=[tournament.id])
    name, desc = pick_tournament_text(tm, tournament.id, locale)
    return AdminTournamentListItem(
        id=tournament.id,
        name=name,
        description=desc,
        start_date=tournament.start_date,
        length_days=tournament.length_days,
        created_at=tournament.created_at,
    )


async def _tournament_to_detail(
    db: DbSession,
    *,
    tournament: Tournament,
    locale: PreferredLocale,
) -> AdminTournamentDetail:
    base = await _tournament_to_list_item(db, tournament=tournament, locale=locale)
    tm = await tournament_translations_map(db, tournament_ids=[tournament.id])
    return AdminTournamentDetail(
        **base.model_dump(),
        translations=_locale_out_tournament(tm, tournament.id),
    )


@router.get('/tournaments', response_model=list[AdminTournamentListItem])
async def admin_list_tournaments(
    db: DbSession,
    _: SuperUser,
    locale: PreferredLocale,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[AdminTournamentListItem]:
    stmt = select(Tournament).order_by(Tournament.start_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    tournaments = list(result.scalars().all())
    if not tournaments:
        return []
    tm = await tournament_translations_map(db, tournament_ids=[t.id for t in tournaments])
    out: list[AdminTournamentListItem] = []
    for t in tournaments:
        name, desc = pick_tournament_text(tm, t.id, locale)
        out.append(
            AdminTournamentListItem(
                id=t.id,
                name=name,
                description=desc,
                start_date=t.start_date,
                length_days=t.length_days,
                created_at=t.created_at,
            )
        )
    return out


@router.get('/tournaments/{tournament_id}', response_model=AdminTournamentDetail)
async def admin_get_tournament(
    db: DbSession,
    _: SuperUser,
    tournament_id: uuid.UUID,
    locale: PreferredLocale,
) -> AdminTournamentDetail:
    t = await db.get(Tournament, tournament_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    return await _tournament_to_detail(db, tournament=t, locale=locale)


@router.get(
    '/tournaments/{tournament_id}/leaderboard',
    response_model=list[AdminTournamentLeaderboardRow],
)
async def admin_tournament_leaderboard(
    db: DbSession,
    _: SuperUser,
    tournament_id: uuid.UUID,
) -> list[AdminTournamentLeaderboardRow]:
    """Enrolled teams ranked by sum of challenge credits (approved completions only)."""
    if await db.get(Tournament, tournament_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')

    raw_rows = await fetch_tournament_leaderboard_rows(db, tournament_id=tournament_id)
    return [
        AdminTournamentLeaderboardRow(
            rank=i,
            team_id=r.team_id,
            team_name=r.team_name,
            team_tournament_id=r.team_tournament_id,
            total_points=r.total_points,
            challenges_completed=r.challenges_completed,
        )
        for i, r in enumerate(raw_rows, start=1)
    ]


@router.post('/tournaments', response_model=AdminTournamentDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_tournament(
    db: DbSession,
    _: SuperUser,
    body: AdminTournamentCreate,
    locale: PreferredLocale,
) -> AdminTournamentDetail:
    t = Tournament(
        start_date=body.start_date,
        length_days=body.length_days,
    )
    db.add(t)
    await db.flush()
    await replace_tournament_translations(
        db,
        tournament_id=t.id,
        per_locale={k: (p.name, p.description) for k, p in body.translations.items()},
    )
    await db.flush()
    await db.refresh(t)
    return await _tournament_to_detail(db, tournament=t, locale=locale)


@router.patch('/tournaments/{tournament_id}', response_model=AdminTournamentDetail)
async def admin_patch_tournament(
    db: DbSession,
    _: SuperUser,
    tournament_id: uuid.UUID,
    body: AdminTournamentPatch,
    locale: PreferredLocale,
) -> AdminTournamentDetail:
    t = await db.get(Tournament, tournament_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    data = body.model_dump(exclude_unset=True)
    if 'start_date' in data:
        t.start_date = data['start_date']
    if 'length_days' in data:
        t.length_days = data['length_days']
    if body.translations is not None:
        await merge_replace_tournament_translations(
            db,
            tournament_id=t.id,
            updates={k: (p.name, p.description) for k, p in body.translations.items()},
        )
    await db.flush()
    await db.refresh(t)
    return await _tournament_to_detail(db, tournament=t, locale=locale)


@router.delete('/tournaments/{tournament_id}', status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_tournament(db: DbSession, _: SuperUser, tournament_id: uuid.UUID) -> None:
    t = await db.get(Tournament, tournament_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    await db.delete(t)
    await db.flush()


@router.post(
    '/tournaments/{tournament_id}/clone',
    response_model=AdminTournamentDetail,
    status_code=status.HTTP_201_CREATED,
)
async def admin_clone_tournament(
    db: DbSession,
    _: SuperUser,
    tournament_id: uuid.UUID,
    body: AdminTournamentCreate,
    locale: PreferredLocale,
) -> AdminTournamentDetail:
    stmt = (
        select(Tournament)
        .options(selectinload(Tournament.challenges).selectinload(Challenge.translations))
        .where(Tournament.id == tournament_id)
    )
    result = await db.execute(stmt)
    donor = result.unique().scalar_one_or_none()
    if donor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')

    challenges_sorted = sorted(donor.challenges or [], key=lambda c: (c.day, c.id))
    for c in challenges_sorted:
        if c.day > body.length_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f'length_days ({body.length_days}) is smaller than an existing challenge day ({c.day}); '
                    'increase length or remove/adjust challenges on the source tournament first.'
                ),
            )

    new_t = Tournament(
        start_date=body.start_date,
        length_days=body.length_days,
    )
    db.add(new_t)
    await db.flush()
    await replace_tournament_translations(
        db,
        tournament_id=new_t.id,
        per_locale={k: (p.name, p.description) for k, p in body.translations.items()},
    )

    for c in challenges_sorted:
        nc = Challenge(
            tournament_id=new_t.id,
            challenge_type=c.challenge_type,
            points=c.points,
            day=c.day,
        )
        db.add(nc)
        await db.flush()
        per: dict[str, tuple[str, str | None]] = {}
        for tr in c.translations or []:
            per[tr.locale] = (tr.title, tr.description)
        await replace_challenge_translations(db, challenge_id=nc.id, per_locale=per)

    await db.flush()
    await db.refresh(new_t)
    return await _tournament_to_detail(db, tournament=new_t, locale=locale)
