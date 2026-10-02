# Asset workspace

The live board uses `apps/web/public/art/runtime-ktx2`, with `runtime` as the original-texture fallback. `basis`, `dock`, and `environment` supply decoders, UI artwork and island backgrounds. `meshy-island` remains an opt-in experiment; the original island image is the default.

Retained authoring resources:
- `import/`: original user-supplied artwork.
- `assets/image-to-3d/`: Meshy task records, references and regeneration/inspection tools.
- `apps/web/public/art/meshy-*`: original generated models, required by optimization tools and asset inspection pages.
- `assets/runtime/`: preparation, compression and verification scripts plus asset manifests.
- `assets/fonts/`: Chinese font subset tooling.
- `assets/blender/`: original and lighter market models, preserved at the user's request. `create_market.py` now reads the preserved atlas in `public/art/blender-market/market-original-atlas.png`.

Cleanup on 2026-10-02 removed superseded procedural v1/v2 packs, HD-2D and Blender estate prototypes, their five preview pages, Blender autosaves, macOS metadata and rebuildable web build/test output. Current Meshy comparison pages, the interactive scene fixture, texture comparison, both market previews, source artwork, canonical rules, and model/compression backups remain.

Authoring inputs and original model backups are excluded from Docker's build context. They remain available locally; the live compressed assets and their runtime fallback are included.
