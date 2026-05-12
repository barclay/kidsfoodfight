"""14-character team invite codes: A–Z (except O), digits 1–9 (no 0)."""

import secrets

# Uppercase A–Z minus O, plus 1–9 (no zero, no letter O)
INVITE_CODE_ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'
INVITE_CODE_LENGTH = 14


def generate_invite_code() -> str:
    return ''.join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))
