"""BLIP image captioning (CPU/GPU). Lazy-loaded; optional when torch/transformers are not installed.

Hugging Face downloads respect ``HF_HOME`` (see Docker Compose: bind ``./data/hf-cache`` so weights
survive container restarts). See https://huggingface.co/docs/huggingface_hub/package_reference/environment_variables
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path

from app.config import settings

log = logging.getLogger(__name__)

_MODEL_ID = 'Salesforce/blip-image-captioning-base'
_lock = threading.Lock()
_bundle: tuple[object, object, object, object] | None = None


def _load_bundle() -> tuple[object, object, object, object]:
    global _bundle
    with _lock:
        if _bundle is not None:
            return _bundle
        hf_home = os.environ.get('HF_HOME', '').strip()
        if hf_home:
            log.info('BLIP: using Hugging Face cache HF_HOME=%s', hf_home)
        import torch
        from transformers import BlipForConditionalGeneration, BlipProcessor

        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        processor = BlipProcessor.from_pretrained(_MODEL_ID)
        model = BlipForConditionalGeneration.from_pretrained(_MODEL_ID).to(device)
        model.eval()
        _bundle = (device, processor, model, torch)
        return _bundle


def caption_image_file(path: Path) -> str | None:
    """
    Return a short English caption, or ``None`` if BLIP is disabled / deps missing / read fails.

    Uses greedy decoding (single beam) for lower latency than beam search.
    """
    if settings.blip_disable:
        return None
    if not path.is_file():
        return None
    try:
        device, processor, model, torch = _load_bundle()
    except ImportError:
        log.warning('BLIP skipped: install torch, transformers, pillow (see backend/requirements.txt).')
        return None
    try:
        from PIL import Image

        img = Image.open(path).convert('RGB')
    except OSError as e:
        log.warning('BLIP skipped: cannot read %s (%s)', path, e)
        return None

    gen_kw: dict[str, int | float | bool] = {
        'max_length': 140,
        'repetition_penalty': 1.15,
    }
    with torch.inference_mode():
        inputs = processor(img, return_tensors='pt')
        inputs = {k: v.to(device) if isinstance(v, torch.Tensor) else v for k, v in inputs.items()}
        out = model.generate(**inputs, **gen_kw)
    text = processor.batch_decode(out, skip_special_tokens=True)[0].strip()
    return text or None
