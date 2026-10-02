# Source Han Sans CN / 思源黑体

Adobe Source Han Sans CN variable font, version 2.005, SIL OFL 1.1 (see OFL.txt).

Upstream file: https://github.com/adobe-fonts/source-han-sans/blob/release/Variable/WOFF2/TTF/Subset/SourceHanSansCN-VF.ttf.woff2
Original SHA-256: `f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799`.

`SourceHanSansCN-VF.woff2` is the unmodified upstream font. `SourceHanSansCN-ui.woff2`
is a variable web subset covering current UI strings and ASCII. Its internal
family is renamed Rico UI Han to respect the upstream reserved font name.
Both faces are selected through the CSS family Source Han Sans CN; the full
font supplies characters outside the UI subset, including player names.

Regenerate the subset and Unicode ranges after adding UI strings:
`python assets/fonts/subset-source-han-sans.py` (requires `fonttools[woff]`).
Generated files are checked in; normal app builds need no Python/font tooling.
