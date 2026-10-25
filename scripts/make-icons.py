"""Draws the app icons into public/icons (run from the project root: python scripts/make-icons.py).

An open book on a dark tile with a yellow scan line across it. Drawn at 4x and scaled down
for smooth edges.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

BG = (17, 18, 20, 255)
PAPER = (242, 242, 243, 255)
INK = (150, 153, 160, 255)
ACCENT = (245, 197, 66, 255)
OUT = Path('public/icons')
S = 4  # supersampling


def book(draw: ImageDraw.ImageDraw, scale: float, cx: float, cy: float) -> None:
    """The open book, `scale` = size of the 512px design within the image."""
    def p(x, y):
        return (cx + (x - 256) * scale, cy + (y - 256) * scale)

    for side in (-1, 1):
        outer = 256 + side * 140
        page = [p(256, 176), p(outer, 146), p(outer, 352), p(256, 382)]
        draw.polygon(page, fill=PAPER)
        # Text lines, following the page's slant.
        for i in range(6):
            y0 = 196 + i * 26
            start, end = 256 + side * 24, outer - side * 22
            slant = lambda x: (x - 256) / (outer - 256) * -30
            draw.line([p(start, y0 + slant(start)), p(end, y0 + slant(end))], fill=INK, width=max(1, round(10 * scale)))
    draw.line([p(256, 176), p(256, 382)], fill=BG, width=max(1, round(6 * scale)))


def icon(size: int, maskable: bool) -> Image.Image:
    big = size * S
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if maskable:
        draw.rectangle([0, 0, big, big], fill=BG)
        # Keep the artwork inside the 80% safe zone that launchers may crop to.
        scale = big / 512 * 0.72
    else:
        draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.22, fill=BG)
        scale = big / 512 * 0.92
    c = big / 2
    book(draw, scale, c, c)

    # The scan line, with a soft glow.
    y = c + 6 * scale
    x0, x1 = c - 190 * scale, c + 190 * scale
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).line([(x0, y), (x1, y)], fill=ACCENT[:3] + (150,), width=round(34 * scale))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(14 * scale)))
    ImageDraw.Draw(img).line([(x0, y), (x1, y)], fill=ACCENT, width=round(12 * scale))
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icon(192, False).save(OUT / 'icon-192.png')
    icon(512, False).save(OUT / 'icon-512.png')
    icon(512, True).save(OUT / 'icon-maskable-512.png')
    # iOS rounds the corners itself and shows transparency as black: use the full-bleed tile.
    icon(180, True).convert('RGB').save(OUT / 'apple-touch-icon.png')
    icon(32, False).save(OUT / 'favicon-32.png')
    print('icons written to', OUT)


main()
