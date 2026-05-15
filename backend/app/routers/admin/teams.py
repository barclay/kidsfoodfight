"""Admin team CRUD and roster / tournament enrollment."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.content_translations import pick_tournament_text, tournament_translations_map
from app.http_locale import PreferredLocale
from app.models import Team, TeamTournament, Tournament, User
from app.obscene_language import ensure_text_is_clean
from app.schemas_admin import (
    AdminTeamCreate,
    AdminTeamDetail,
    AdminTeamListItem,
    AdminTeamMemberItem,
    AdminTeamMembersPut,
    AdminTeamPatch,
    AdminTeamTournamentEntry,
    AdminTeamTournamentsPut,
)
from app.team_challenge_scoring import resync_team_all_enrolled_tournaments, tournament_entry_points_map

from .deps import DbSession, SuperUser

router = APIRouter(tags=['admin'])


async def _admin_team_detail(
    db: AsyncSession, team_id: uuid.UUID, locale: PreferredLocale
) -> AdminTeamDetail:
    result = await db.execute(_team_detail_stmt(team_id))
    team = result.unique().scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
    entry_ids = [e.id for e in (team.tournament_entries or [])]
    totals = await tournament_entry_points_map(db, team_tournament_ids=entry_ids)
    tids = [e.tournament_id for e in (team.tournament_entries or []) if e.tournament_id]
    tm = await tournament_translations_map(db, tournament_ids=tids)
    users = team.users or []
    entries = team.tournament_entries or []
    tournaments: list[AdminTeamTournamentEntry] = []
    for e in entries:
        tr = e.tournament
        tname = pick_tournament_text(tm, e.tournament_id, locale)[0] if tr is not None else ''
        tournaments.append(
            AdminTeamTournamentEntry(
                id=e.id,
                tournament_id=e.tournament_id,
                tournament_name=tname,
                joined_at=e.joined_at,
                total_points=int(totals.get(e.id, 0)),
            )
        )
    return AdminTeamDetail(
        id=team.id,
        name=team.name,
        invite_code=team.invite_code,
        created_at=team.created_at,
        members=[AdminTeamMemberItem.model_validate(u) for u in users],
        tournaments=tournaments,
    )


def _team_detail_stmt(team_id: uuid.UUID):
    return (
        select(Team)
        .options(
            selectinload(Team.users),
            selectinload(Team.tournament_entries).selectinload(TeamTournament.tournament),
        )
        .where(Team.id == team_id)
    )


@router.get('/teams', response_model=list[AdminTeamListItem])
async def admin_list_teams(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[AdminTeamListItem]:
    stmt = (
        select(Team)
        .options(selectinload(Team.users))
        .order_by(Team.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    teams = list(result.scalars().unique().all())
    return [
        AdminTeamListItem(
            id=t.id,
            name=t.name,
            invite_code=t.invite_code,
            created_at=t.created_at,
            member_count=len(t.users or []),
        )
        for t in teams
    ]


@router.post('/teams', response_model=AdminTeamDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_team(
    db: DbSession, _: SuperUser, body: AdminTeamCreate, locale: PreferredLocale
) -> AdminTeamDetail:
    ensure_text_is_clean(body.name)
    team = Team(name=body.name)
    db.add(team)
    await db.flush()
    return await _admin_team_detail(db, team.id, locale)


@router.get('/teams/{team_id}', response_model=AdminTeamDetail)
async def admin_get_team(
    db: DbSession, _: SuperUser, team_id: uuid.UUID, locale: PreferredLocale
) -> AdminTeamDetail:
    return await _admin_team_detail(db, team_id, locale)


@router.patch('/teams/{team_id}', response_model=AdminTeamDetail)
async def admin_patch_team(
    db: DbSession,
    _: SuperUser,
    team_id: uuid.UUID,
    body: AdminTeamPatch,
    locale: PreferredLocale,
) -> AdminTeamDetail:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
    data = body.model_dump(exclude_unset=True)
    if 'name' in data:
        ensure_text_is_clean(data['name'])
        team.name = data['name']
    await db.flush()
    return await _admin_team_detail(db, team_id, locale)


@router.put('/teams/{team_id}/members', response_model=AdminTeamDetail)
async def admin_put_team_members(
    db: DbSession,
    _: SuperUser,
    team_id: uuid.UUID,
    body: AdminTeamMembersPut,
    locale: PreferredLocale,
) -> AdminTeamDetail:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')

    target_ids = set(body.user_ids)
    affected_team_ids: set[uuid.UUID] = {team_id}

    res_current = await db.execute(select(User).where(User.team_id == team_id))
    for u in res_current.scalars():
        if u.id not in target_ids:
            u.team_id = None

    for uid in target_ids:
        user = await db.get(User, uid)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f'User not found: {uid}',
            )
        prev = user.team_id
        if prev is not None and prev != team_id:
            affected_team_ids.add(prev)
        user.team_id = team_id

    await db.flush()
    for tid in affected_team_ids:
        await resync_team_all_enrolled_tournaments(db, team_id=tid)
    return await _admin_team_detail(db, team_id, locale)


@router.put('/teams/{team_id}/tournaments', response_model=AdminTeamDetail)
async def admin_put_team_tournaments(
    db: DbSession,
    _: SuperUser,
    team_id: uuid.UUID,
    body: AdminTeamTournamentsPut,
    locale: PreferredLocale,
) -> AdminTeamDetail:
    """Replace this team's tournament enrollments (``team_tournaments`` rows)."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
    unique_ids = list(dict.fromkeys(body.tournament_ids))
    for tid in unique_ids:
        tournament = await db.get(Tournament, tid)
        if tournament is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f'Tournament not found: {tid}',
            )
    await db.execute(delete(TeamTournament).where(TeamTournament.team_id == team_id))
    for tid in unique_ids:
        db.add(TeamTournament(team_id=team_id, tournament_id=tid))
    await db.flush()
    await resync_team_all_enrolled_tournaments(db, team_id=team_id)
    return await _admin_team_detail(db, team_id, locale)
