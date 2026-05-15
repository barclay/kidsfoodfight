"""AI-assisted EN→ES translation for tournament / challenge copy.

Requires ``ANTHROPIC_API_KEY`` in the environment; returns 503 when it is absent.
"""

from __future__ import annotations

import json
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=['admin'])
log = logging.getLogger(__name__)


def _is_anthropic_overloaded(exc: BaseException) -> bool:
    """529 / overloaded_error — API surface differs across anthropic SDK versions."""
    if getattr(exc, 'status_code', None) == 529:
        return True
    if type(exc).__name__ == 'OverloadedError':
        return True
    body = getattr(exc, 'body', None)
    if isinstance(body, dict):
        err = body.get('error')
        if isinstance(err, dict) and err.get('type') == 'overloaded_error':
            return True
    return False


_KFF_CONTEXT = (
    "Kids Food Fight (KFF) is a family wellness game that turns healthy eating and fitness "
    "into a fun, competitive family adventure. It targets families with children ages 6–16. "
    "The tone is playful, encouraging, and energetic — like a sports coach cheering on a team. "
    "Challenge titles are short action phrases (e.g. 'Eat RED Challenge', 'Family Dance Chain'). "
    "Descriptions are 1–3 sentences of friendly instructions, sometimes ending with 'Post a pic!'."
)

_SYSTEM_PROMPT = (
    "You are a professional translator specializing in family-friendly health and wellness content. "
    + _KFF_CONTEXT
    + "\n\nTranslate English text to Latin American Spanish. "
    "Preserve the playful, action-oriented tone. Keep proper nouns and brand names in English. "
    "Do not add explanations — return only valid JSON with the same keys as the input, values translated."
)


class TranslateRequest(BaseModel):
    content_type: Literal['challenge', 'tournament']
    en_fields: dict[str, str]
    """Keys are field names (e.g. 'title', 'description', 'name'); values are English source text."""


class TranslateResponse(BaseModel):
    es_fields: dict[str, str]
    """Same keys as ``en_fields``; values are the Spanish translations."""


@router.post('/translate', response_model=TranslateResponse)
async def admin_translate(body: TranslateRequest) -> TranslateResponse:
    """
    Translate a set of English strings to Spanish using Claude.

    Returns 503 when ``ANTHROPIC_API_KEY`` is not configured.
    Non-empty fields only — callers should omit blank descriptions.
    """
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Translation service is not configured (ANTHROPIC_API_KEY missing).',
        )

    # Filter out empty / whitespace-only values before sending
    source: dict[str, str] = {k: v for k, v in body.en_fields.items() if v and v.strip()}
    if not source:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='en_fields must contain at least one non-empty value.',
        )

    user_message = (
        f"Translate these {body.content_type} fields from English to Spanish.\n\n"
        f"Input JSON:\n{json.dumps(source, ensure_ascii=False, indent=2)}\n\n"
        "Return a JSON object with the same keys and Spanish translations as values. "
        "No markdown, no explanation — raw JSON only."
    )

    import anthropic  # lazy import so startup isn't affected when key is absent

    _MODELS = ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5']

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, max_retries=2)
    last_exc: Exception | None = None
    raw: str | None = None
    for model in _MODELS:
        try:
            message = client.messages.create(
                model=model,
                max_tokens=1024,
                system=_SYSTEM_PROMPT,
                messages=[{'role': 'user', 'content': user_message}],
            )
            raw = message.content[0].text.strip()
            if model != _MODELS[0]:
                log.info('Translation fell back to %s', model)
            break
        except Exception as exc:
            if _is_anthropic_overloaded(exc):
                log.warning('Anthropic model %s overloaded, trying next: %s', model, exc)
                last_exc = exc
                continue
            log.exception('Anthropic translation failed with model %s: %s', model, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f'Translation request failed: {exc}',
            ) from exc

    if raw is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Translation service is temporarily overloaded — try again in a moment.',
        ) from last_exc

    # Strip markdown code fences if Claude wraps the JSON anyway
    if raw.startswith('```'):
        lines = raw.splitlines()
        raw = '\n'.join(
            line for line in lines if not line.startswith('```')
        ).strip()

    try:
        parsed: dict[str, str] = json.loads(raw)
    except json.JSONDecodeError as exc:
        log.error('Claude returned non-JSON: %r', raw)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Translation service returned an unexpected response format.',
        ) from exc

    # Ensure we only return keys that were actually requested
    es_fields = {k: str(parsed[k]) for k in source if k in parsed}
    if not es_fields:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Translation service returned no matching fields.',
        )

    return TranslateResponse(es_fields=es_fields)
