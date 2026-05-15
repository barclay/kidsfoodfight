"""Parse ``Accept-Language`` into a supported app locale (``en`` | ``es``)."""

from __future__ import annotations

from typing import Literal

AppLocale = Literal['en', 'es']

SUPPORTED_LOCALES: tuple[AppLocale, ...] = ('en', 'es')
FALLBACK_LOCALE: AppLocale = 'en'


def parse_accept_language(header: str | None) -> AppLocale:
    """
    First language tag in ``Accept-Language`` whose primary subtag is ``en`` or ``es``.
    RFC 7231 quality values are ignored for ordering beyond comma sequence.
    """
    if not header or not header.strip():
        return FALLBACK_LOCALE
    for part in header.split(','):
        token = part.split(';', 1)[0].strip()
        if not token:
            continue
        primary = token.split('-', 1)[0].lower()
        if primary == 'es':
            return 'es'
        if primary == 'en':
            return 'en'
    return FALLBACK_LOCALE
