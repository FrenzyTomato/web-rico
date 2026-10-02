"""Prepare user-supplied island textures; retain original PNGs in import/. Requires Pillow."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[2]
output = root / 'apps/web/public/art/environment'
output.mkdir(parents=True, exist_ok=True)
for name in ['player-island', 'main-island', 'ocean']:
    image = Image.open(root / 'import' / f'{name}.png')
    image.thumbnail((2048, 2048) if name != 'ocean' else (1024, 1024), Image.Resampling.LANCZOS)
    image.save(output / f'{name}.webp', quality=90, method=6)
    print(name, image.size, (output / f'{name}.webp').stat().st_size)
