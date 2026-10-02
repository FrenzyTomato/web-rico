# Imported building models

This batch generates exactly the 18 labeled buildings in the six PNG sheets in `import/`. Output filenames match the labels, using an ASCII apostrophe in `Builder's Yard.glb`. No buildings absent from the imported references are invented. Existing building and estate assets are preserved.

`manifest.json` maps every building name to its source sheet, crop rectangle, reference and output filename. `prepare.py` crops individual buildings and excludes captions; a few remaining Wharf caption pixels outside the tile are cleared. It does not create new artwork. References are saved under `references/`.

Meshy settings: `meshy-6-lite`, 2K textures, PBR maps, no remeshing, GLB only. Full meshes are retained to avoid the leaf damage seen in earlier aggressive simplification. Published estimate: 15 credits per model, 270 credits total. Initial balance: 1,055 credits. Credentials are read from the ignored root `.env`, never written into outputs. No new API keys, subscriptions or credit purchases are created.

From the repository root with Node 24:

```sh
node --env-file=.env assets/image-to-3d/building-api/generate.mjs submit
node --env-file=.env assets/image-to-3d/building-api/run.mjs
python3 assets/image-to-3d/building-api/inspect.py
```

`submit` sends at most six unsubmitted entries. `run` resumes saved task IDs and waits for each group before submitting the next. Failed or uncertain POST submissions require inspection; the runner never automatically regenerates a task. Polling and downloads can be resumed. Signed asset URLs and the API key are not stored in the metadata. `tasks.json` holds generation progress; do not delete it to retry a batch.

Outputs: `apps/web/public/art/meshy-buildings/<Building Name>.glb`.

Preview: `apps/web/meshy-buildings-preview.html`, with a building selector. This is a standalone art preview, not gameplay integration. `inspect.py` checks GLB structure, accessor/index bounds, embedded textures and records file hashes and triangle counts. Full meshes are not yet optimized for board performance. Applicable Meshy account license terms govern the generated assets; no unsupported license declaration is added.

API references: https://docs.meshy.ai/en/api/image-to-3d and https://docs.meshy.ai/en/api/pricing.

## Completed batch — 2026-10-02

All 18 tasks succeeded and downloaded on the first attempt. Actual credit use: 270 (1,055 → 785). All 18 GLBs passed the structural/index/texture checks and loaded in the Three.js preview. Each contains three embedded texture images. Screenshots for every building are in `previews/`; `collection-preview.jpg` assembles them in manifest order.

The models preserve the overall reference designs, with the usual image-to-3D approximations in foliage and fine geometry. Screenshot review covers the default preview angle, not exhaustive topology or every underside/back face. Meshes range from 165,374 to 600,944 triangles and about 11–25 MB each; these are full-detail source assets and require a separate optimization pass before board-wide gameplay use.
