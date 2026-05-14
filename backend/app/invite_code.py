"""14-character team invite codes: A–Z (except O), digits 1–9 (no 0)."""

import secrets

# Uppercase A–Z minus O, plus 1–9 (no zero, no letter O)
INVITE_CODE_ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'
INVITE_CODE_LENGTH = 14


def generate_invite_code() -> str:
    return ''.join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))


def normalize_invite_code_input(raw: str | None) -> str | None:
    """
    Normalize user-entered invite text: strip, uppercase, drop spaces and hyphens.

    Returns ``None`` when there is no usable code (so signup treats it as “new team”).
    """

    if raw is None:
        return None
    compact = ''.join(c for c in raw.strip().upper() if c not in ' \t\n\r-')
    return compact or None


def is_valid_invite_code_format(code: str) -> bool:
    """True if ``code`` matches the generated invite alphabet and length."""

    return len(code) == INVITE_CODE_LENGTH and all(c in INVITE_CODE_ALPHABET for c in code)
