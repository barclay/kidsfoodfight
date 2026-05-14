"""Tests for invite code normalization helpers."""

from __future__ import annotations

import pytest

from app.invite_code import (
    INVITE_CODE_LENGTH,
    is_valid_invite_code_format,
    normalize_invite_code_input,
)


@pytest.mark.parametrize(
    ('raw', 'expected'),
    [
        (None, None),
        ('', None),
        ('   ', None),
        ('  ABCD  ', 'ABCD'),
        ('ab-cd', 'ABCD'),
        ('A B-C\nD', 'ABCD'),
    ],
)
def test_normalize_invite_code_input(raw: str | None, expected: str | None) -> None:
    assert normalize_invite_code_input(raw) == expected


def test_is_valid_invite_code_format_accepts_generated_shape() -> None:
    code = 'A' * INVITE_CODE_LENGTH
    assert is_valid_invite_code_format(code) is True


def test_is_valid_invite_code_format_rejects_wrong_length() -> None:
    assert is_valid_invite_code_format('A' * (INVITE_CODE_LENGTH - 1)) is False
    assert is_valid_invite_code_format('A' * (INVITE_CODE_LENGTH + 1)) is False


def test_is_valid_invite_code_format_rejects_o_and_zero() -> None:
    bad = 'O' + '1' * (INVITE_CODE_LENGTH - 1)
    assert is_valid_invite_code_format(bad) is False
    bad2 = '0' + '1' * (INVITE_CODE_LENGTH - 1)
    assert is_valid_invite_code_format(bad2) is False
