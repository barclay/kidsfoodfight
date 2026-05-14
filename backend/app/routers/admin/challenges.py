"""Admin challenge CRUD within tournaments."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.models import Challenge, ChallengeType, Tournament
from app.schemas_admin import (
    AdminChallengeCreate,
    AdminChallengeDetail,
    AdminChallengeListItem,
    AdminChallengePatch,
)

from .deps import DbSession, SuperUser

router = APIRouter(tags=['admin'])


def _assert_challenge_day(tournament: Tournament, day: int) -> None:
    if day < 1 or day > tournament.length_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'day must be between 1 and {tournament.length_days} for this tournament',
        )


def _challenge_to_admin_item(challenge: Challenge, tournament_name: str | None) -> AdminChallengeListItem:
    display_name = tournament_name if tournament_name is not None else '(tournament deleted)'
    return AdminChallengeListItem(
        id=challenge.id,
        tournament_id=challenge.tournament_id,
        tournament_name=display_name,
        title=challenge.title,
        description=challenge.description,
        challenge_type=challenge.challenge_type.value,
        points=challenge.points,
        day=challenge.day,
        created_at=challenge.created_at,
    )


@router.get('/challenges', response_model=list[AdminChallengeListItem])
async def admin_list_challenges(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tournament_id: uuid.UUID | None = Query(None, description='Filter by tournament'),
) -> list[AdminChallengeListItem]:
    stmt = (
        select(Challenge, Tournament.name.label('tournament_name'))
        .outerjoin(Tournament, Challenge.tournament_id == Tournament.id)
        .order_by(Tournament.start_date.desc().nulls_last(), Challenge.day.asc(), Challenge.title.asc())
        .offset(skip)
        .limit(limit)
    )
    if tournament_id is not None:
        stmt = stmt.where(Challenge.tournament_id == tournament_id)
    result = await db.execute(stmt)
    return [
        _challenge_to_admin_item(challenge, tournament_name)
        for challenge, tournament_name in result.all()
    ]


@router.get('/challenges/{challenge_id}', response_model=AdminChallengeDetail)
async def admin_get_challenge(db: DbSession, _: SuperUser, challenge_id: uuid.UUID) -> AdminChallengeDetail:
    stmt = (
        select(Challenge, Tournament.name.label('tournament_name'))
        .outerjoin(Tournament, Challenge.tournament_id == Tournament.id)
        .where(Challenge.id == challenge_id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')
    challenge, tournament_name = row
    return _challenge_to_admin_item(challenge, tournament_name)


@router.post('/challenges', response_model=AdminChallengeDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_challenge(db: DbSession, _: SuperUser, body: AdminChallengeCreate) -> AdminChallengeDetail:
    tournament = await db.get(Tournament, body.tournament_id)
    if tournament is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    _assert_challenge_day(tournament, body.day)
    c = Challenge(
        tournament_id=body.tournament_id,
        title=body.title,
        description=body.description,
        challenge_type=ChallengeType(body.challenge_type),
        points=body.points,
        day=body.day,
    )
    db.add(c)
    await db.flush()
    await db.refresh(c)
    return _challenge_to_admin_item(c, tournament.name)


@router.patch('/challenges/{challenge_id}', response_model=AdminChallengeDetail)
async def admin_patch_challenge(
    db: DbSession,
    _: SuperUser,
    challenge_id: uuid.UUID,
    body: AdminChallengePatch,
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

    if 'title' in data:
        c.title = data['title']
    if 'description' in data:
        c.description = data['description']
    if 'challenge_type' in data:
        c.challenge_type = ChallengeType(data['challenge_type'])
    if 'points' in data:
        c.points = data['points']
    if 'day' in data:
        c.day = data['day']

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
    tournament = await db.get(Tournament, c.tournament_id)
    tname = tournament.name if tournament is not None else None
    return _challenge_to_admin_item(c, tname)


@router.delete('/challenges/{challenge_id}', status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_challenge(db: DbSession, _: SuperUser, challenge_id: uuid.UUID) -> None:
    c = await db.get(Challenge, challenge_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')
    await db.delete(c)
    await db.flush()
