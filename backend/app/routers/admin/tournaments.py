"""Admin tournament CRUD, leaderboard, and clone."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Challenge, Tournament
from app.schemas_admin import (
    AdminTournamentCreate,
    AdminTournamentDetail,
    AdminTournamentLeaderboardRow,
    AdminTournamentListItem,
    AdminTournamentPatch,
)
from app.team_challenge_scoring import fetch_tournament_leaderboard_rows

from .deps import DbSession, SuperUser

router = APIRouter(tags=['admin'])


@router.get('/tournaments', response_model=list[AdminTournamentListItem])
async def admin_list_tournaments(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[Tournament]:
    stmt = select(Tournament).order_by(Tournament.start_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get('/tournaments/{tournament_id}', response_model=AdminTournamentDetail)
async def admin_get_tournament(db: DbSession, _: SuperUser, tournament_id: uuid.UUID) -> Tournament:
    t = await db.get(Tournament, tournament_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    return t


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
async def admin_create_tournament(db: DbSession, _: SuperUser, body: AdminTournamentCreate) -> Tournament:
    t = Tournament(
        name=body.name,
        description=body.description,
        start_date=body.start_date,
        length_days=body.length_days,
    )
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return t


@router.patch('/tournaments/{tournament_id}', response_model=AdminTournamentDetail)
async def admin_patch_tournament(
    db: DbSession,
    _: SuperUser,
    tournament_id: uuid.UUID,
    body: AdminTournamentPatch,
) -> Tournament:
    t = await db.get(Tournament, tournament_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    data = body.model_dump(exclude_unset=True)
    for key in ('name', 'description', 'start_date', 'length_days'):
        if key in data:
            setattr(t, key, data[key])
    await db.flush()
    await db.refresh(t)
    return t


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
) -> Tournament:
    stmt = (
        select(Tournament)
        .options(selectinload(Tournament.challenges))
        .where(Tournament.id == tournament_id)
    )
    result = await db.execute(stmt)
    donor = result.unique().scalar_one_or_none()
    if donor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')

    challenges_sorted = sorted(donor.challenges or [], key=lambda c: (c.day, c.title))
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
        name=body.name,
        description=body.description,
        start_date=body.start_date,
        length_days=body.length_days,
    )
    db.add(new_t)
    await db.flush()

    for c in challenges_sorted:
        db.add(
            Challenge(
                tournament_id=new_t.id,
                title=c.title,
                description=c.description,
                challenge_type=c.challenge_type,
                points=c.points,
                day=c.day,
            )
        )
    await db.flush()
    await db.refresh(new_t)
    return new_t
