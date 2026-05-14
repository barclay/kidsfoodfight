"""Tournament-scoped team points: one credit per challenge while any teammate has an approved post."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import NamedTuple

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Challenge,
    Post,
    Team,
    TeamTournament,
    TeamTournamentChallengeCredit,
    TeamTournamentScoreEvent,
    User,
)


class TournamentLeaderboardRowRaw(NamedTuple):
    team_id: uuid.UUID
    team_name: str
    team_tournament_id: uuid.UUID
    total_points: int
    challenges_completed: int


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def sync_team_challenge_credit(
    db: AsyncSession,
    *,
    team_id: uuid.UUID,
    challenge_id: uuid.UUID,
) -> None:
    """
    Ensure ``TeamTournamentChallengeCredit`` matches approved posts from **current** roster.

    No-op when the team is not enrolled in the challenge's tournament.
    """
    ch_row = await db.execute(
        select(Challenge.points, Challenge.tournament_id).where(Challenge.id == challenge_id)
    )
    ch = ch_row.one_or_none()
    if ch is None:
        return
    challenge_points, tournament_id = int(ch.points), ch.tournament_id
    if tournament_id is None:
        return

    tt_id = await db.scalar(
        select(TeamTournament.id).where(
            TeamTournament.team_id == team_id,
            TeamTournament.tournament_id == tournament_id,
        )
    )
    if tt_id is None:
        return

    approved_rows = (
        (
            await db.execute(
                select(Post.id, Post.created_at)
                .join(User, Post.user_id == User.id)
                .where(
                    Post.challenge_id == challenge_id,
                    Post.approved.is_(True),
                    User.team_id == team_id,
                )
                .order_by(Post.created_at.asc(), Post.id.asc())
            )
        )
        .all()
    )
    anchor_id: uuid.UUID | None = approved_rows[0][0] if approved_rows else None

    credit = await db.scalar(
        select(TeamTournamentChallengeCredit).where(
            TeamTournamentChallengeCredit.team_tournament_id == tt_id,
            TeamTournamentChallengeCredit.challenge_id == challenge_id,
        )
    )

    if anchor_id is not None:
        if credit is None:
            new_id = uuid.uuid4()
            ins = (
                insert(TeamTournamentChallengeCredit)
                .values(
                    id=new_id,
                    team_tournament_id=tt_id,
                    challenge_id=challenge_id,
                    points_awarded=challenge_points,
                    anchor_post_id=anchor_id,
                    created_at=_utcnow(),
                )
                .on_conflict_do_nothing(constraint='uq_team_tournament_challenge_credits_tt_challenge')
                .returning(TeamTournamentChallengeCredit.id)
            )
            inserted = (await db.execute(ins)).scalar_one_or_none()
            if inserted is not None:
                db.add(
                    TeamTournamentScoreEvent(
                        team_tournament_id=tt_id,
                        challenge_id=challenge_id,
                        delta=challenge_points,
                        reason='grant',
                        source_post_id=anchor_id,
                        created_at=_utcnow(),
                    )
                )
            else:
                credit = await db.scalar(
                    select(TeamTournamentChallengeCredit).where(
                        TeamTournamentChallengeCredit.team_tournament_id == tt_id,
                        TeamTournamentChallengeCredit.challenge_id == challenge_id,
                    )
                )
                if credit is not None and credit.anchor_post_id != anchor_id:
                    credit.anchor_post_id = anchor_id
        else:
            if credit.anchor_post_id != anchor_id:
                credit.anchor_post_id = anchor_id
        return

    if credit is not None:
        lost = int(credit.points_awarded)
        await db.delete(credit)
        await db.flush()
        db.add(
            TeamTournamentScoreEvent(
                team_tournament_id=tt_id,
                challenge_id=challenge_id,
                delta=-lost,
                reason='revoke',
                source_post_id=None,
                created_at=_utcnow(),
            )
        )


async def resync_team_tournament_challenges(
    db: AsyncSession,
    *,
    team_id: uuid.UUID,
    tournament_id: uuid.UUID,
) -> None:
    """Recompute credits for every challenge in a tournament (e.g. after enrollment)."""
    cids = (
        await db.execute(select(Challenge.id).where(Challenge.tournament_id == tournament_id))
    ).scalars().all()
    for cid in cids:
        await sync_team_challenge_credit(db, team_id=team_id, challenge_id=cid)


async def resync_team_all_enrolled_tournaments(db: AsyncSession, *, team_id: uuid.UUID) -> None:
    """Recompute all challenge credits for each tournament this team is enrolled in."""
    tids = (
        await db.execute(
            select(TeamTournament.tournament_id).where(TeamTournament.team_id == team_id)
        )
    ).scalars().all()
    for tid in tids:
        await resync_team_tournament_challenges(db, team_id=team_id, tournament_id=tid)


async def backfill_all_team_challenge_credits(db: AsyncSession) -> int:
    """
    Sync credits for every distinct (team, challenge) that has at least one approved post
    from a user on that team. Returns number of (team_id, challenge_id) pairs processed.
    """
    res = await db.execute(
        select(User.team_id, Post.challenge_id)
        .distinct()
        .select_from(Post)
        .join(User, Post.user_id == User.id)
        .where(Post.approved.is_(True), User.team_id.isnot(None)),
    )
    pairs = res.all()
    for team_id, cid in pairs:
        await sync_team_challenge_credit(db, team_id=team_id, challenge_id=cid)
    return len(pairs)


async def fetch_tournament_leaderboard_rows(
    db: AsyncSession, *, tournament_id: uuid.UUID
) -> list[TournamentLeaderboardRowRaw]:
    """Enrolled teams ranked by sum of challenge credits (same ordering as admin leaderboard)."""
    total_pts = func.coalesce(func.sum(TeamTournamentChallengeCredit.points_awarded), 0).label('total_points')
    n_done = func.count(TeamTournamentChallengeCredit.id).label('challenges_completed')

    stmt = (
        select(
            Team.id.label('team_id'),
            Team.name.label('team_name'),
            TeamTournament.id.label('team_tournament_id'),
            total_pts,
            n_done,
        )
        .select_from(TeamTournament)
        .join(Team, TeamTournament.team_id == Team.id)
        .outerjoin(
            TeamTournamentChallengeCredit,
            TeamTournamentChallengeCredit.team_tournament_id == TeamTournament.id,
        )
        .where(TeamTournament.tournament_id == tournament_id)
        .group_by(Team.id, Team.name, TeamTournament.id)
        .order_by(total_pts.desc(), Team.name.asc())
    )
    result = await db.execute(stmt)
    rows = result.mappings().all()
    return [
        TournamentLeaderboardRowRaw(
            team_id=r['team_id'],
            team_name=r['team_name'],
            team_tournament_id=r['team_tournament_id'],
            total_points=int(r['total_points']),
            challenges_completed=int(r['challenges_completed']),
        )
        for r in rows
    ]


async def tournament_entry_points_map(
    db: AsyncSession, *, team_tournament_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """Sum ``points_awarded`` per ``team_tournaments.id``."""
    if not team_tournament_ids:
        return {}
    res = await db.execute(
        select(
            TeamTournamentChallengeCredit.team_tournament_id,
            func.coalesce(func.sum(TeamTournamentChallengeCredit.points_awarded), 0),
        )
        .where(TeamTournamentChallengeCredit.team_tournament_id.in_(team_tournament_ids))
        .group_by(TeamTournamentChallengeCredit.team_tournament_id)
    )
    rows = res.all()
    return {row[0]: int(row[1]) for row in rows}


async def delete_all_scoring_rows(db: AsyncSession) -> None:
    """Clear credits and score events (e.g. after bulk post delete in dev)."""
    await db.execute(delete(TeamTournamentScoreEvent))
    await db.execute(delete(TeamTournamentChallengeCredit))
    await db.flush()
