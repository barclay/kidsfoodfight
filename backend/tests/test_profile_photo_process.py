"""Tests for ``profile_photo_process``."""

from io import BytesIO

import pytest

from app.profile_photo_process import sniff_is_probably_image, square_jpeg_from_upload


def test_sniff_image_types() -> None:
    assert sniff_is_probably_image('image/png', None) is True
    assert sniff_is_probably_image(None, 'x.JPG') is True
    assert sniff_is_probably_image('text/plain', 'x.txt') is False


def test_square_jpeg_output_is_square_jpeg() -> None:
    pytest.importorskip('PIL')
    from PIL import Image

    buf = BytesIO()
    Image.new('RGB', (40, 30), (10, 20, 30)).save(buf, format='PNG')
    out = square_jpeg_from_upload(buf.getvalue(), max_edge=64)
    im = Image.open(BytesIO(out))
    assert im.format == 'JPEG'
    assert im.size[0] == im.size[1] == 30
