"""Crop existing role portraits above their printed English captions for localized UI cards.
Original portraits and models remain unchanged. Requires Pillow.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2] / 'apps/web/public/art/dock'
for path in root.glob('*Command Tile.webp'):
    image = Image.open(path)
    width, height = image.size
    image.crop((round(width * .045), round(height * .04), round(width * .955), round(height * .62))).save(
        path.with_stem(path.stem + ' Illustration'), quality=90, method=6)
