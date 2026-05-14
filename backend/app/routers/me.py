"""Authenticated ``/me/*`` routes (avoid clashing with ``/users/{id}``)."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette import status

from app.auth import current_active_user
from app.challenge_window import local_tournament_day_index, resolve_user_zone
from app.config import settings
from app.database import get_db
from app.models import Team, TeamTournament, User
from app.profile_photo_process import sniff_is_probably_image, square_jpeg_from_upload
from app.schemas import (
    MeActiveTournamentLeaderboard,
    MeTournamentLeaderboardRow,
    MeTournamentLeaderboardsPayload,
    UserRead,
)
from app.storage_local import save_user_profile_photo_bytes, unlink_local_media_key
from app.team_challenge_scoring import fetch_tournament_leaderboard_rows

router = APIRouter(tags=['me'])

DbSession = Annotated[AsyncSession, Depends(get_db)]

_MAX_BYTES = 8 * 1024 * 1024


@router.post('/me/profile-photo', response_model=UserRead)
async def upload_profile_photo(
    db: DbSession,
    user: User = Depends(current_active_user),
    file: UploadFile = File(..., description='Profile image (jpeg, png, webp, or gif)'),
) -> UserRead:
    """Replace the current user's profile photo with a new square JPEG (center-cropped server-side)."""
    if settings.storage_backend != 'local':
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail='Only local storage is implemented; set STORAGE_BACKEND=local',
        )
    if not sniff_is_probably_image(file.content_type, file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='File must be an image (jpeg, png, webp, or gif)',
        )

    raw = await file.read()
    if len(raw) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f'Image must be at most {_MAX_BYTES // (1024 * 1024)} MiB',
        )
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Empty file')

    try:
        jpeg_bytes = square_jpeg_from_upload(raw)
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Could not read image; use a valid JPEG, PNG, WebP, or GIF',
        ) from exc

    db_user = await db.get(User, user.id)
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    old_key = db_user.profile_photo_storage_url
    new_key = save_user_profile_photo_bytes(user_id=user.id, data=jpeg_bytes, filename_suffix='.jpg')
    db_user.profile_photo_storage_url = new_key
    await db.flush()

    if old_key and old_key != new_key:
        unlink_local_media_key(old_key)

    await db.refresh(db_user)
    return UserRead.model_validate(db_user)


@router.get('/me/tournament-leaderboards', response_model=MeTournamentLeaderboardsPayload)
async def get_me_tournament_leaderboards(
    db: DbSession,
    user: User = Depends(current_active_user),
) -> MeTournamentLeaderboardsPayload:
    """
    For each tournament the user's team is enrolled in that is **active** on the user's local
    calendar (same window as ``/challenges/available``), return the full team leaderboard.
    """
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(User)
        .where(User.id == user.id)
        .options(
            selectinload(User.team)
            .selectinload(Team.tournament_entries)
            .selectinload(TeamTournament.tournament),
        )
    )
    result = await db.execute(stmt)
    db_user = result.scalar_one_or_none()
    if db_user is None or db_user.team_id is None or db_user.team is None:
        return MeTournamentLeaderboardsPayload(my_team_id=None, active_leaderboards=[])

    user_tz = resolve_user_zone(db_user.timezone)
    team = db_user.team
    assert team is not None

    boards: list[MeActiveTournamentLeaderboard] = []
    for entry in team.tournament_entries:
        tournament = entry.tournament
        if tournament is None:
            continue
        active_day = local_tournament_day_index(
            tournament_start=tournament.start_date,
            tournament_length_days=tournament.length_days,
            now_utc=now_utc,
            user_tz=user_tz,
        )
        if active_day is None:
            continue

        raw_rows = await fetch_tournament_leaderboard_rows(db, tournament_id=tournament.id)
        rows = [
            MeTournamentLeaderboardRow(
                rank=i,
                team_id=r.team_id,
                team_name=r.team_name,
                total_points=r.total_points,
                challenges_completed=r.challenges_completed,
            )
            for i, r in enumerate(raw_rows, start=1)
        ]
        boards.append(
            MeActiveTournamentLeaderboard(
                tournament_id=tournament.id,
                tournament_name=tournament.name,
                rows=rows,
            )
        )

    boards.sort(key=lambda b: b.tournament_name.lower())
    return MeTournamentLeaderboardsPayload(my_team_id=team.id, active_leaderboards=boards)
