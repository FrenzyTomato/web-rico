# Imported resource collection

29 individually named GLBs from the five new `import/` sheets, recorded in `manifest.json` with crop coordinates and generation method.

- Five expanded buildings: City Hall, Customs House, Fire Station, Fortress, Residence.
- Five interchangeable visual worker variants, Worker 01–05 (left to right in the reference). These are static models with no rig, animation, or distinct gameplay roles.
- Corn, Sugar, Banana, Coffee, and Tobacco Crates. Banana is the visual for the game's fruit goods.
- 4-, 5-, 6-, 7-, and 8-Slot Boats, Private Boat, and Trader Depot.
- Craftsman, Trader, Captain, Adventurer, Planter, Recruiter, and Builder Command Tiles.

The 22 sculpted resources use the same Meshy 6 Lite / 2K PBR / full geometry settings as the previous building batch. Estimated cost: 330 credits; initial account balance 785. No new purchases, keys or automatic regeneration. `.env` supplies the existing credential; logs and metadata exclude keys and signed URLs. Original references and earlier assets remain unchanged.

The seven command tiles are built locally by `tiles.py`: a thin rounded solid, original cropped artwork on the top, and warm cardboard edges/back. Each is 80 triangles and about 250 KB, with its image embedded. This preserves lettering and avoids 105 credits of image-to-3D generation. Printed text is retained as supplied artwork, not treated as a rules source or engine behavior.

`prepare.py` crops individual subjects and excludes external captions. A small section of the Customs House caption margin is cleared outside the building. `references-preview.jpg` is the input contact sheet. Only sculpted resources are submitted to Meshy; tiles are local.

Run from repository root (Node 24; Python with Pillow for preparation and tiles):

```sh
python3 assets/image-to-3d/resources-api/prepare.py
python3 assets/image-to-3d/resources-api/tiles.py
node --env-file=.env assets/image-to-3d/resources-api/run.mjs
python3 assets/image-to-3d/resources-api/inspect.py
```

Do not launch overlapping runners. `run.mjs` submits at most six pending items at a time, resumes recorded IDs, downloads completed results, and stops on uncertain submissions or model failures. Do not delete `tasks.json` to retry. `inspect.py` validates GLB structure, embedded textures and index bounds and records hashes and counts.

Outputs: `apps/web/public/art/meshy-resources/<Asset Name>.glb`.
Preview: `apps/web/meshy-resources-preview.html` with a resource selector. Preview scale is normalized per asset for inspection, not the eventual relative board scale. Source models require optimization before broad gameplay integration; references from one angle do not guarantee exact reconstructed backs, hidden geometry or slot topology. Boat labels identify intended capacity, not verified engine interaction slots.

## Completion — 2026-10-02

All 22 API jobs succeeded on their first attempt. Actual balance: 785 → 455, using 330 credits. All 29 individually named GLBs passed structural/texture/index checks and loaded in the Three.js preview. Default-angle screenshots are in `previews/`; the full contact sheet is `collection-preview.jpg`. Review is visual and structural, not exhaustive topology or gameplay validation.

The boats have deeper inferred hulls than suggested by the top-down artwork. Meshy foliage and fine details remain approximations. Sculpted models range from 111,776 to 739,724 triangles, about 8–27 MB each, and need a separate optimization pass before mass board use. Command tiles are already small: 80 triangles each. No engine rules, collision slots or gameplay integration were changed.
