"""Blocked-word checks using the LDNOOBW English list (vendored copy).

Source: https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
Raw file: ``en`` on the default branch. License follows that repository (see upstream).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

_WORD_LIST_PATH = Path(__file__).resolve().parent / "data" / "bad_words_en.txt"


@dataclass(frozen=True)
class ObsceneLanguageCheck:
    """Outcome of scanning text against the blocked list."""

    is_clean: bool
    """True if no list entry matched."""
    matched_term: str | None = None
    """The raw list line that matched (for logging only; do not expose to end users)."""


class ObsceneLanguageError(ValueError):
    """Raised when text matches a blocked word or phrase."""

    matched_term: str | None

    def __init__(
        self,
        message: str = "Text contains disallowed language.",
        *,
        matched_term: str | None = None,
    ) -> None:
        super().__init__(message)
        self.matched_term = matched_term


def _read_terms(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    return [line.strip() for line in text.splitlines() if line.strip()]


def _uses_word_boundary_matching(term: str) -> bool:
    """Entries with spaces or without letters/digits use other strategies."""
    if " " in term:
        return False
    return any(ch.isalnum() for ch in term)


def _compile_entry(term: str) -> re.Pattern[str]:
    flags = re.IGNORECASE | re.UNICODE
    normalized = " ".join(term.split())
    if " " in normalized:
        parts = normalized.split(" ")
        sep = r"(?:\s|_|-|\.|)+"
        body = sep.join(rf"\b{re.escape(p)}\b" for p in parts)
        return re.compile(body, flags)
    if _uses_word_boundary_matching(normalized):
        return re.compile(rf"\b{re.escape(normalized)}\b", flags)
    return re.compile(re.escape(normalized))


def _build_scanners(terms: list[str]) -> list[tuple[re.Pattern[str], str]]:
    return [( _compile_entry(t), t) for t in terms]


_SCANNERS: list[tuple[re.Pattern[str], str]] = _build_scanners(_read_terms(_WORD_LIST_PATH))


def check_obscene_language(text: str) -> ObsceneLanguageCheck:
    """Return whether ``text`` matches any blocked word or phrase (English list)."""
    if not text:
        return ObsceneLanguageCheck(is_clean=True, matched_term=None)
    for pattern, term in _SCANNERS:
        if pattern.search(text):
            return ObsceneLanguageCheck(is_clean=False, matched_term=term)
    return ObsceneLanguageCheck(is_clean=True, matched_term=None)


def ensure_text_is_clean(text: str) -> None:
    """Raise :class:`ObsceneLanguageError` if ``text`` matches the blocked list."""
    result = check_obscene_language(text)
    if not result.is_clean:
        raise ObsceneLanguageError(matched_term=result.matched_term)
