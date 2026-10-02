# Game board runtime art

The web app now uses all 53 approved subjects: 23 buildings, six estates/quarry, five worker variants, five goods crates, seven role tiles, six boats, and the trader depot. Runtime mapping lives in `apps/web/src/scene/modelCatalog.ts`.

The original Meshy exports remain untouched. `prepare.py` creates intermediates in `/tmp/rico-runtime` with 512px JPEG textures. `optimize.mjs` performs UV/normal-aware simplification with locked boundaries and a 0.003 error limit, stopping above the 12k target when necessary. It gzip-compresses standalone GLBs into `apps/web/public/art/runtime/`. The collection totals about 41 MB. Thin foliage is approximate at this LOD; source assets remain available for close-up views.

Rebuild from the repository root, using Python with Pillow and Node 24:

```sh
python3 assets/runtime/prepare.py
node assets/runtime/optimize.mjs
```

`Model.tsx` loads on demand with at most three concurrent decodes, caches source meshes/materials, and clones only scene objects for repeated pieces. Resources intentionally live for the page and are not disposed when an individual piece unmounts. Downloads support both raw gzip and automatic HTTP Content-Encoding decoding. A failed asset retains its primitive fallback; failure is isolated to that model. Simple selection hit boxes preserve interaction while art loads and avoid raycasting dense triangles.

Gameplay state still comes exclusively from PlayerView. Labels, occupied/empty worker slots, visible goods counts, ship capacity/load counts, role ownership/coins, and sold-out building counts remain explicit. Crates on ships are a countable overlay above the sculpted deck rather than assumed generated slot positions. Worker variants have identical gameplay meaning. Command artwork retains the supplied English text; Chinese gameplay labels remain overlays.

The existing player mats and piece layout remain; no new mat GLB was supplied in these batches. The live game backend was restarted locally with its default in-memory store (rooms do not survive backend restarts).

Validation: web unit tests and production build; runtime coverage tests check 53 named files and both gzip response modes; five-player revision-120 fixture visually inspected at `/scene-preview.html?game=5p&at=120`. Full multiplayer regression and broad hardware performance measurements are not part of this art pass.

## Board readability

The game now starts with a closer shared-board view. The camera toolbar offers Shared area, Building market, My island and Whole table presets (Chinese labels matching the UI), plus zoom buttons. Wheel/pinch zoom and drag pan work with fixed tilt; game-state updates preserve the chosen view. Clicking a preset again resets that view. Production builds copy only runtime variants and their decoder files, preserving full source art for development previews without duplicating it into dist. Camera behavior is covered by unit tests; browser visual verification for this follow-up was blocked by repeated browser-tool timeouts.

## Optional GPU texture compression — 2026-10-02

The game now prefers `public/art/runtime-ktx2/`, using KTX2/UASTC textures. The entire previous `public/art/runtime/` folder is preserved byte-for-byte as the backup; hashes are recorded in `backup-sha256.json`. The source Meshy models are also unchanged. Geometry and accessor data are identical between the two runtime variants.

- Normal game URL: compressed textures, with automatic original-asset fallback on a fetch/transcode/parse failure.
- `/?art=original`: force the previous runtime textures. Reload without that query to restore compression.
- `/texture-preview.html`: single-model comparison, with original/compressed switch and texture payload readout. No five-player game test was run.
- Workers and goods crates: 256px; buildings/estates/boats: 512px. Seven command tiles remain byte-identical to protect text. Texture-only change: no new mesh simplification.
- UASTC quality 2 with Zstandard level 18, mipmaps, sRGB color maps and linear normal/metallic-roughness maps. Encoder: official Khronos KTX-Software 4.4.2, unpacked under `/tmp/rico-ktx-tools` without system installation.
- Browser transcoders are copied from the installed Three.js 0.186.1 package into `public/art/basis/`. See its accompanying README for license/provenance. Three.js KTX2Loader documentation: https://threejs.org/docs/pages/KTX2Loader.html

Rebuild (Python with Pillow; pass the path to the official `toktx` binary):

```sh
python3 assets/runtime/compress-textures.py --toktx /path/to/toktx
python3 assets/runtime/verify-compression.py
```

`compression-estimate.json` records totals for all 53 unique assets loaded at once, including mipmaps. Texture memory estimates: original RGBA8 198.8 MB; compressed 26.1–46.3 MB depending on 4-/8-bit GPU block format. Devices without a supported compressed GPU format can expand textures to RGBA (~167.4 MB with the smaller worker/crate textures); memory savings are device-dependent. These figures exclude geometry, render targets, decoder working memory, browser overhead and transient copies, and are not measured total-tab RAM. GPU geometry remains about 57 MB for the complete collection.

Tradeoff: compressed-variant downloads total 64.8 MB, versus 41.0 MB for the JPEG-backed originals. UASTC preserves texture quality and reduces GPU memory; it is not a bandwidth win. The build includes both variants and local decoder files, but normal loading fetches only the selected variant (plus originals if a failure triggers fallback).

Validation: all 53 backup hashes and non-image buffer views verified; command files exactly unchanged; 63 web tests passed. Single-model WebGL checks covered Small Market, Banana Estate, Worker 01, Corn Crate and Captain Command Tile. Small Market's displayed texture payload was 1.05 MB compressed versus 4.19 MB original; worker/crate compressed payload was 0.26 MB. The comparison screenshot is `texture-comparison.jpg`. This does not establish total game memory or performance under a full five-player load.
