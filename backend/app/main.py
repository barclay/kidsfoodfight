from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette import status

from app.routers import admin, challenges, feed, me
from app.auth import auth_backend, fastapi_users
from app.config import settings
from app.obscene_language import ObsceneLanguageError
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

app.include_router(admin.router, prefix='/api/v1')
app.include_router(feed.router, prefix='/api/v1')
app.include_router(challenges.router, prefix='/api/v1')
app.include_router(me.router, prefix='/api/v1')


@app.exception_handler(ObsceneLanguageError)
async def obscene_language_exception_handler(
    _request: Request, _exc: ObsceneLanguageError
) -> JSONResponse:
    """Maps blocked-word policy violations to HTTP 451 for client-side handling."""
    return JSONResponse(
        status_code=status.HTTP_451_UNAVAILABLE_FOR_LEGAL_REASONS,
        content={'detail': 'This text contains language that is not allowed.'},
    )


@app.get('/health', tags=['meta'])
async def health() -> dict:
    return {'status': 'ok'}
