"""Admin-only REST API (requires JWT for an active superuser)."""

from fastapi import APIRouter

from . import challenges, posts, teams, tournaments, users

router = APIRouter(prefix='/admin', tags=['admin'])
router.include_router(teams.router)
router.include_router(users.router)
router.include_router(posts.router)
router.include_router(tournaments.router)
router.include_router(challenges.router)
