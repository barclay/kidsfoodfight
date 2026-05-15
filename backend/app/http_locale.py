"""FastAPI dependency: preferred locale from ``Accept-Language``."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header

from app.content_locale import AppLocale, parse_accept_language


def _preferred_locale(accept_language: str | None = Header(default=None, alias='Accept-Language')) -> AppLocale:
    return parse_accept_language(accept_language)


PreferredLocale = Annotated[AppLocale, Depends(_preferred_locale)]
