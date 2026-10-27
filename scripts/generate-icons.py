"""Regenerate all GrokRelay icons from one geometry. Requires Pillow.

Run: python scripts/generate-icons.py
Generated assets are committed; normal builds need no Python dependencies.
"""
from pathlib import Path
from io import BytesIO
import struct
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
# One monochrome mark: two open links joined on a diagonal.
# Coordinates drive both the SVG and all raster sizes.
SHAPES = [
    ("round", (1, 1, 63, 63), "#141414", 15),
]

svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">']
canvas = Image.new("RGBA", (1024, 1024))
draw = ImageDraw.Draw(canvas)
for kind, points, color, radius in SHAPES:
    if kind == "round":
        x1, y1, x2, y2 = points
        svg.append(f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" rx="{radius}" fill="{color}"/>')
        draw.rounded_rectangle(tuple(v*16 for v in points), radius=radius*16, fill=color)
    else:
        coords = " ".join(f"{x},{y}" for x, y in points)
        svg.append(f'<polygon points="{coords}" fill="{color}"/>')
        draw.polygon([(x*16, y*16) for x, y in points], fill=color)
svg.append('<g transform="rotate(-45 32 32)" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">')
links = [((28, 22), (20, 22), (12, 30), (12, 34), (20, 42), (28, 42)),
         ((36, 22), (44, 22), (52, 30), (52, 34), (44, 42), (36, 42)),
         ((24, 32), (40, 32))]
layer = Image.new('RGBA', canvas.size)
link_draw = ImageDraw.Draw(layer)
for points in links:
    coords = ' '.join(f'{x},{y}' for x, y in points)
    svg.append(f'<polyline points="{coords}"/>')
    link_draw.line([(x*16, y*16) for x,y in points], fill='#FFFFFF', width=80, joint='curve')
    for x, y in points:
        link_draw.ellipse((x*16-40, y*16-40, x*16+40, y*16+40), fill='#FFFFFF')
canvas.alpha_composite(layer.rotate(45, resample=Image.Resampling.BICUBIC))
svg.append('</g></svg>')
(ROOT / 'panel/logo.svg').write_text('\n'.join(svg) + '\n', encoding='utf-8')
brand = ROOT / 'assets'
brand.mkdir(exist_ok=True)
canvas.resize((256, 256), Image.Resampling.LANCZOS).save(brand / 'icon.png')
# Include exact small sizes so Explorer and the taskbar do not upscale a tiny icon.
images = []
for size in (16, 20, 24, 32, 40, 48, 64, 128, 256):
    stream = BytesIO()
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(stream, format='PNG')
    images.append((size, stream.getvalue()))
offset = 6 + len(images)*16
entries = []
for size, data in images:
    entries.append(struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), offset))
    offset += len(data)
(brand / 'icon.ico').write_bytes(struct.pack('<HHH', 0, 1, len(images)) + b''.join(entries) + b''.join(data for _, data in images))
print('Generated panel/logo.svg, assets/icon.png and assets/icon.ico')
