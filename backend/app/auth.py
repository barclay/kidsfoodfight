import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, Request, Response
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, exceptions
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User


# ── Database adapter ──────────────────────────────────────────────────────────

async def get_user_db(session: AsyncSession = Depends(get_db)):
    yield SQLAlchemyUserDatabase(session, User)


# ── User manager ──────────────────────────────────────────────────────────────

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
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
