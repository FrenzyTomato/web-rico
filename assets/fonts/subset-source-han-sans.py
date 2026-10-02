"""Regenerate the Source Han Sans UI subset with fonttools[woff]. Full font covers other text."""
from pathlib import Path
import hashlib
from fontTools.ttLib import TTFont
from fontTools.subset import Options, Subsetter
root = Path(__file__).resolve().parents[2]
folder = root / 'apps/web/src/fonts/source-han-sans'
source = folder / 'SourceHanSansCN-VF.woff2'
font = TTFont(source)
chars = set(range(32, 127))
for path in (root / 'apps/web/src').rglob('*'):
    if path.suffix in {'.ts', '.tsx', '.css'}:
        chars.update(map(ord, path.read_text()))
chars &= set(font.getBestCmap())
options = Options(); options.flavor = 'woff2'; options.layout_features = ['*']
sub = Subsetter(options=options); sub.populate(unicodes=chars); sub.subset(font)
# Rename the derived subset's internal family to respect Adobe's reserved name.
for record in font['name'].names:
    if record.nameID in {1, 3, 4, 6, 16}:
        record.string = 'RicoUIHan' if record.nameID == 6 else 'Rico UI Han'
font.flavor = 'woff2'; font.save(folder / 'SourceHanSansCN-ui.woff2')
ranges = ','.join(f'U+{c:X}' for c in sorted(chars))
css = '''/* Official Adobe Source Han Sans CN, OFL-1.1. Full coverage loads only for text outside the UI subset. */
@font-face {
  font-family: 'Source Han Sans CN'; font-style: normal; font-weight: 250 900; font-display: swap;
  src: url('./SourceHanSansCN-VF.woff2') format('woff2');
}
@font-face {
  font-family: 'Source Han Sans CN'; font-style: normal; font-weight: 250 900; font-display: swap;
  src: url('./SourceHanSansCN-ui.woff2') format('woff2');
  unicode-range: RANGES;
}
'''.replace('RANGES', ranges)
(folder / 'font.css').write_text(css)
print(len(chars), 'UI code points;', (folder / 'SourceHanSansCN-ui.woff2').stat().st_size, 'bytes')
print('Full font SHA256:', hashlib.sha256(source.read_bytes()).hexdigest())
print('Font:',font['name'].getDebugName(1),font['name'].getDebugName(5))
