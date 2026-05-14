import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, exceptions
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.invite_code import normalize_invite_code_input
from app.models import Team, User
from app.obscene_language import ensure_text_is_clean
from app.schemas import UserCreate, UserUpdate


# ── Database adapter ──────────────────────────────────────────────────────────

async def get_user_db(session: AsyncSession = Depends(get_db)):
    yield SQLAlchemyUserDatabase(session, User)


# ── User manager ──────────────────────────────────────────────────────────────

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    """JWT login uses OAuth2PasswordRequestForm: the ``username`` field must be the account email."""

    reset_password_token_secret = settings.secret_key
    verification_token_secret = settings.secret_key

    async def validate_password(self, password: str, user: User | object) -> None:
        if len(password) < 6:
            raise exceptions.InvalidPasswordException('must be at least 6 characters')
        if ' ' in password:
            raise exceptions.InvalidPasswordException('must not contain spaces')
        if not any(c.isalpha() for c in password):
            raise exceptions.InvalidPasswordException('must contain at least one letter')
        if not any(c.isdigit() for c in password):
            raise exceptions.InvalidPasswordException('must contain at least one digit')

    async def on_after_register(self, user: User, request: Optional[Request] = None) -> None:
        print(f'[auth] User registered: {user.id} ({user.email})')

    async def on_after_login(
        self,
        user: User,
        request: Optional[Request] = None,
        response: Optional[Response] = None,
    ) -> None:
        await self.user_db.update(user, {'last_seen_at': datetime.now(timezone.utc)})

    async def create(
        self,
        user_create: UserCreate,
        safe: bool = False,
        request: Optional[Request] = None,
    ) -> User:
        ensure_text_is_clean(user_create.display_name)
        await self.validate_password(user_create.password, user_create)

        existing_user = await self.user_db.get_by_email(user_create.email)
        if existing_user is not None:
            raise exceptions.UserAlreadyExists()

        session = self.user_db.session
        invite = normalize_invite_code_input(user_create.invite_code)

        team_id: uuid.UUID
        if invite is not None:
            result = await session.execute(select(Team).where(Team.invite_code == invite))
            team = result.scalar_one_or_none()
            if team is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='No team matches that invite code.',
                )
            team_id = team.id
        else:
            team_name = (user_create.team_name or '').strip()
            ensure_text_is_clean(team_name)
            new_team = Team(name=team_name)
            session.add(new_team)
            await session.flush()
            team_id = new_team.id

        user_dict: dict[str, Any] = (
            user_create.create_update_dict()
            if safe
            else user_create.create_update_dict_superuser()
        )
        password = user_dict.pop('password')
        user_dict['hashed_password'] = self.password_helper.hash(password)
        user_dict.pop('invite_code', None)
        user_dict.pop('team_name', None)
        user_dict['team_id'] = team_id

        created_user = await self.user_db.create(user_dict)
        await self.on_after_register(created_user, request)
        return created_user

    async def update(
        self,
        user_update: UserUpdate,
        user: User,
        safe: bool = False,
        request: Optional[Request] = None,
    ) -> User:
        if user_update.display_name is not None:
            ensure_text_is_clean(user_update.display_name)
        return await super().update(user_update, user, safe=safe, request=request)


async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)


# ── JWT backend ───────────────────────────────────────────────────────────────

bearer_transport = BearerTransport(tokenUrl='/api/v1/auth/login')


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.secret_key,
        lifetime_seconds=settings.access_token_expire_minutes * 60,
    )


auth_backend = AuthenticationBackend(
    name='jwt',
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)


# ── FastAPIUsers instance ─────────────────────────────────────────────────────

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)
