from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import auth_backend, fastapi_users
from app.config import settings
from app.schemas import UserCreate, UserRead, UserUpdate

app = FastAPI(
    title='Kids Food Fight API',
    version='0.1.0',
    docs_url='/docs',
    redoc_url='/redoc',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# ── Auth routes (/api/v1/auth/login, /api/v1/auth/logout) ────────────────────
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix='/api/v1/auth',
    tags=['auth'],
)

# ── Registration route (/api/v1/auth/register) ───────────────────────────────
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix='/api/v1/auth',
    tags=['auth'],
)

# ── User self-service (/api/v1/users/me) ─────────────────────────────────────
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix='/api/v1/users',
    tags=['users'],
)


@app.get('/health', tags=['meta'])
async def health() -> dict:
    return {'status': 'ok'}
