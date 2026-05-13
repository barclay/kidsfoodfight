"""Unit tests for ``app.obscene_language``."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

import pytest

from app.main import obscene_language_exception_handler
from app.obscene_language import (
    ObsceneLanguageCheck,
    ObsceneLanguageError,
    check_obscene_language,
    ensure_text_is_clean,
)


@pytest.mark.parametrize(
    "text",
    [
        "",
        "Kids Food Fight",
        "We ate class together in school.",
        "Essex county field trip",
        "grass and apples",
        "classic broccoli recipe",
    ],
)
def test_check_clean_text(text: str) -> None:
    result = check_obscene_language(text)
    assert result == ObsceneLanguageCheck(is_clean=True, matched_term=None)


def test_check_obscene_language_none_is_clean() -> None:
    assert check_obscene_language(None) == ObsceneLanguageCheck(is_clean=True, matched_term=None)


@pytest.mark.parametrize(
    ("text", "expected_matched_term"),
    [
        ("That is shitty behavior", "shitty"),
        ("WHAT THE FUCK", "fuck"),
        ("blow  job", "blow job"),
        ("blow.job", "blow job"),
        ("prefix fuck suffix", "fuck"),
        ("nice 🖕 there", "🖕"),
    ],
)
def test_check_detects_blocked_terms(text: str, expected_matched_term: str) -> None:
    result = check_obscene_language(text)
    assert result.is_clean is False
    assert result.matched_term == expected_matched_term


@pytest.mark.parametrize(
    "text",
    [
        "That is shitty behavior",
        "WHAT THE FUCK",
    ],
)
def test_ensure_text_is_clean_raises(text: str) -> None:
    with pytest.raises(ObsceneLanguageError) as exc_info:
        ensure_text_is_clean(text)
    assert exc_info.value.matched_term is not None


def test_ensure_text_is_clean_accepts_clean_string() -> None:
    ensure_text_is_clean("Healthy snacks for everyone")


def test_ensure_text_is_clean_skips_none_and_blank() -> None:
    ensure_text_is_clean(None)
    ensure_text_is_clean("")
    ensure_text_is_clean("   \n\t")


def test_obscene_exception_handler_returns_451() -> None:
    response = asyncio.run(
        obscene_language_exception_handler(MagicMock(), ObsceneLanguageError(matched_term="x"))
    )
    assert response.status_code == 451


def test_obscene_language_error_default_message() -> None:
    err = ObsceneLanguageError(matched_term="test")
    assert str(err) == "Text contains disallowed language."
    assert err.matched_term == "test"
