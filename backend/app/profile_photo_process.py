"""Square JPEG profile avatars from arbitrary raster uploads."""

from __future__ import annotations

from io import BytesIO


def square_jpeg_from_upload(data: bytes, *, max_edge: int = 512, jpeg_quality: int = 88) -> bytes:
    """
    Open image bytes, center-crop to a square (min side), resize so max edge is ``max_edge``,
    and return JPEG bytes. Raises ``UnidentifiedImageError`` if the payload is not a raster image.
    """
    from PIL import Image

    im = Image.open(BytesIO(data))
    if im.mode in ('RGBA', 'P'):
        rgba = im.convert('RGBA')
        rgb = Image.new('RGB', rgba.size, (255, 255, 255))
        rgb.paste(rgba, mask=rgba.split()[3])
        im = rgb
    else:
        im = im.convert('RGB')

    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))
    im.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)

    out = BytesIO()
    im.save(out, format='JPEG', quality=jpeg_quality, optimize=True)
    return out.getvalue()


def sniff_is_probably_image(content_type: str | None, filename: str | None) -> bool:
    ct = (content_type or '').split(';')[0].strip().lower()
    if ct in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
        return True
    name = (filename or '').lower()
    return name.endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif'))
