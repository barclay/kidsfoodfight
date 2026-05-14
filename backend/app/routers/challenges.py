"""Authenticated challenge discovery for the mobile app."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import current_active_user
from app.challenge_window import local_tournament_day_index, resolve_user_zone
from app.database import get_db
from app.models import Post, Team, TeamTournament, Tournament, User
from app.schemas import (
    AvailableChallengeItem,
    JoinTournamentBody,
    JoinTournamentResult,
    JoinableTournamentItem,
)
from app.team_challenge_scoring import resync_team_tournament_challenges

router = APIRouter(tags=['challenges'])

DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get('/challenges/available', response_model=list[AvailableChallengeItem])
async def list_available_challenges(
    db: DbSession,
    user: User = Depends(current_active_user),
) -> list[AvailableChallengeItem]:
    """
    Challenges the signed-in user can work on now: their team's enrolled tournaments that are
    active in the user's local calendar, challenges on days **up to and including** that local day
    index, **excluding** any challenge the user already has a **post** for (any approval state).
    """
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(User)
        .where(User.id == user.id)
        .options(
            selectinload(User.team)
            .selectinload(Team.tournament_entries)
            .selectinload(TeamTournament.tournament)
            .selectinload(Tournament.challenges),
        )
    )
    result = await db.execute(stmt)
    db_user = result.scalar_one_or_none()
    if db_user is None or db_user.team_id is None or db_user.team is None:
        return []

    completed_res = await db.execute(select(Post.challenge_id).where(Post.user_id == user.id).distinct())
    completed_challenge_ids = set(completed_res.scalars().all())

    user_tz = resolve_user_zone(db_user.timezone)
    out: list[AvailableChallengeItem] = []

    for entry in db_user.team.tournament_entries:
        tournament = entry.tournament
        active_day = local_tournament_day_index(
            tournament_start=tournament.start_date,
            tournament_length_days=tournament.length_days,
            now_utc=now_utc,
            user_tz=user_tz,
        )
        if active_day is None:
            continue

        challenges = sorted(tournament.challenges, key=lambda c: (c.day, c.title))
        for c in challenges:
            if c.day > active_day:
                continue
            if c.id in completed_challenge_ids:
                continue
            out.append(
                AvailableChallengeItem(
                    id=c.id,
                    tournament_id=tournament.id,
                    tournament_name=tournament.name,
                    title=c.title,
                    description=c.description,
                    challenge_type=c.challenge_type.value,
                    points=c.points,
                    day=c.day,
                    is_focus_day=c.day == active_day,
                )
            )

    out.sort(key=lambda row: (row.tournament_name.lower(), row.day, row.title.lower()))
    return out


@router.get('/challenges/joinable-tournaments', response_model=list[JoinableTournamentItem])
async def list_joinable_tournaments(
    db: DbSession,
    user: User = Depends(current_active_user),
) -> list[JoinableTournamentItem]:
    """
    Tournaments that are **active** on the user's local calendar (same window as
    ``/challenges/available``) but whose team the user is **not** enrolled in yet.
    """
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.team).selectinload(Team.tournament_entries))
    )
    result = await db.execute(stmt)
    db_user = result.scalar_one_or_none()
    if db_user is None or db_user.team_id is None or db_user.team is None:
        return []

    enrolled_ids = {e.tournament_id for e in db_user.team.tournament_entries}
    user_tz = resolve_user_zone(db_user.timezone)

    t_rows = (await db.execute(select(Tournament))).scalars().all()
    out: list[JoinableTournamentItem] = []
    for tournament in t_rows:
        if tournament.id in enrolled_ids:
            continue
        active_day = local_tournament_day_index(
            tournament_start=tournament.start_date,
            tournament_length_days=tournament.length_days,
            now_utc=now_utc,
            user_tz=user_tz,
        )
        if active_day is None:
            continue
        out.append(
            JoinableTournamentItem(
                tournament_id=tournament.id,
                tournament_name=tournament.name,
                current_local_day=active_day,
                length_days=tournament.length_days,
            )
        )
    out.sort(key=lambda row: row.tournament_name.lower())
    return out


@router.post('/challenges/join-tournament', response_model=JoinTournamentResult)
async def join_tournament(
    db: DbSession,
    body: JoinTournamentBody,
    user: User = Depends(current_active_user),
) -> JoinTournamentResult:
    """Enroll the user's team in a tournament that is joinable on their local calendar."""
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.team).selectinload(Team.tournament_entries))
    )
    result = await db.execute(stmt)
    db_user = result.scalar_one_or_none()
    if db_user is None or db_user.team_id is None or db_user.team is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='You must be on a team to join a tournament.',
        )
    team = db_user.team

    tournament = await db.get(Tournament, body.tournament_id)
    if tournament is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found.')

    user_tz = resolve_user_zone(db_user.timezone)
    active_day = local_tournament_day_index(
        tournament_start=tournament.start_date,
        tournament_length_days=tournament.length_days,
        now_utc=now_utc,
        user_tz=user_tz,
    )
    if active_day is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='This tournament is not open for joining on your calendar right now.',
        )

    for entry in team.tournament_entries:
        if entry.tournament_id == tournament.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail='Your team is already enrolled in this tournament.',
            )

    db.add(TeamTournament(team_id=team.id, tournament_id=tournament.id))
    await db.flush()
    await resync_team_tournament_challenges(db, team_id=team.id, tournament_id=tournament.id)
    return JoinTournamentResult(tournament_id=tournament.id, tournament_name=tournament.name)
