"""Generate the MarketHub favicon set from one vector-ish definition.

The mark: a rounded-square tile with an indigo→violet gradient, a white
stylised "M" (two peaks joined by a valley), and an amber accent dot in the
counter. Drawn at 1024px and downsampled with LANCZOS so every size is crisp.
"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "client", "public")
os.makedirs(OUT, exist_ok=True)

S = 1024
SS = 4  # supersample factor for smooth curves
W = S * SS

# Brand colours
INDIGO = (79, 45, 214)      # hsl(255 72% 52%)
VIOLET = (139, 61, 214)     # hsl(272 70% 52%)
MAGENTA = (168, 62, 200)    # hsl(288 62% 56%)
AMBER = (250, 176, 20)      # hsl(38 95% 55%)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_tile(size):
    """Diagonal indigo→violet→magenta gradient, clipped to a rounded square."""
    img = Image.new("RGB", (size, size), INDIGO)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x / size * 0.55) + (y / size * 0.45)
            if t < 0.5:
                c = lerp(INDIGO, VIOLET, t / 0.5)
            else:
                c = lerp(VIOLET, MAGENTA, (t - 0.5) / 0.5)
            px[x, y] = c
    return img


def rounded_mask(size, radius_ratio=0.225):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask


def draw_mark(size):
    """White M with an amber dot. Coordinates are fractions of `size`."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def p(fx, fy):
        return (fx * size, fy * size)

    # Stroke geometry: an M built from two chevrons, drawn as thick polylines
    # with round joins so it reads at 16px.
    stroke = int(size * 0.105)
    pts = [p(0.255, 0.735), p(0.255, 0.315), p(0.5, 0.575), p(0.745, 0.315), p(0.745, 0.735)]
    d.line(pts, fill=WHITE, width=stroke, joint="curve")
    # Round the two open ends.
    for end in (pts[0], pts[-1]):
        d.ellipse(
            [end[0] - stroke / 2, end[1] - stroke / 2, end[0] + stroke / 2, end[1] + stroke / 2],
            fill=WHITE,
        )

    # Amber accent: a dot sitting in the M's valley, the "hub" of MarketHub.
    r = size * 0.062
    cx, cy = p(0.5, 0.775)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=AMBER)

    return layer


def build(size):
    tile = gradient_tile(size)
    tile.putalpha(rounded_mask(size))
    tile = tile.convert("RGBA")
    tile.alpha_composite(draw_mark(size))
    return tile


master = build(W).resize((S, S), Image.LANCZOS)

# ── PNG icons ───────────────────────────────────────────────────────────────
for px in (16, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512):
    master.resize((px, px), Image.LANCZOS).save(os.path.join(OUT, f"icon-{px}.png"))

# Apple touch icon: no transparency, square (iOS applies its own mask).
apple = Image.new("RGB", (180, 180), INDIGO)
apple.paste(master.resize((180, 180), Image.LANCZOS), (0, 0), master.resize((180, 180), Image.LANCZOS))
apple.save(os.path.join(OUT, "apple-touch-icon.png"))

# ── favicon.ico (multi-resolution) ──────────────────────────────────────────
master.save(
    os.path.join(OUT, "favicon.ico"),
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)],
)

# ── SVG (crisp at any size, used by the in-app logo component) ──────────────
svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="MarketHub">
  <defs>
    <linearGradient id="mh" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4F2DD6"/>
      <stop offset="55%" stop-color="#8B3DD6"/>
      <stop offset="100%" stop-color="#A83EC8"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14.4" fill="url(#mh)"/>
  <path d="M16.3 47V20.2L32 36.8 47.7 20.2V47" fill="none" stroke="#fff"
        stroke-width="6.7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="49.6" r="4" fill="#FAB014"/>
</svg>
"""
with open(os.path.join(OUT, "logo-mark.svg"), "w") as f:
    f.write(svg)

# ── Open Graph image (1200×630) ─────────────────────────────────────────────
og = Image.new("RGB", (1200, 630), (255, 255, 255))
d = ImageDraw.Draw(og)
# Brand band
band = gradient_tile(1200).resize((1200, 630), Image.LANCZOS)
og.paste(band, (0, 0))
mark = master.resize((300, 300), Image.LANCZOS)
og.paste(mark, (110, 165), mark)
og.save(os.path.join(OUT, "og-image.png"))

print("wrote:", sorted(os.listdir(OUT)))
