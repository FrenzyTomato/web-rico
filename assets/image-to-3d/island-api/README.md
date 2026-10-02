# Main island image-to-3D trial

Source: user-provided `import/main-island.png`, copied without edits to `references/Main Island.png`.

One Meshy image-to-3D task, using `meshy-6-lite`, 2K PBR textures and triangle remeshing with a target of 30,000 faces. Credentials are loaded from the ignored root `.env`; never included in client code or task metadata. The request used 15 API credits (455 before, 440 after submission).

API reference: https://docs.meshy.ai/en/api/image-to-3d

Resume the existing task from the repository root (do not resubmit):

```
node --env-file=.env assets/image-to-3d/island-api/generate.mjs poll
```

The downloaded original goes to `apps/web/public/art/meshy-island/Main Island.glb`.
The separate development preview is `/meshy-island-preview.html` and offers original-image comparison, orbit rotation, top view, orientation and relief controls. Original model bytes and island artwork are preserved.

This is an experiment, not a default board replacement. A generated island must be checked for shoreline/harbour alignment, surface height under every gameplay anchor, holes, and visual quality before adoption. Fitting its bounding box alone does not prove gameplay alignment.

## Result

- Completed task: `01a0fc02-feab-70ca-baef-1e7b261ac4a7` (tracked in `tasks.json`).
- Original GLB: 12,600,520 bytes; browser inspected 31,238 triangles and one mesh.
- Uniform width-64 normalization gives approximately 64 × 4.3 × 41.4 world units. Current board artwork is 64 × 32, so the generated silhouette is not an exact match.
- Model needs a 180-degree Y rotation to put the harbour at the top.
- Standalone preview preserves proportions and full relief by default. Its relief slider adjusts vertical scale only.
- Development-only board trial: `/scene-preview.html?game=3p&at=241&shell=1&island=3d`. The trial fits horizontal dimensions to 64 × 32, uses 35% vertical relief, and aligns the median of sampled clearing heights to table height. This is a visual approximation, not terrain-aware piece placement.
- Visual review: recognisable raised shoreline, trees, rocks and piers. Softer textures and changed shoreline/clearing proportions compared with the input; terrain can obscure labels. Further surface/anchor alignment is required before default adoption.
- Existing image remains the default; no original images or models were overwritten. The experimental GLB is not copied into production builds.
- Validation: browser review of standalone and populated 3-player fixture; TypeScript passed; 9 camera/layout tests passed; production build passed. No live multiplayer test was run.

## Adopted as default main board

The user approved applying this island to the main board. The 3D island now loads in development and production; `?island=2d` selects the original artwork. A local error boundary falls back to the artwork on model-load failure, and it also appears during loading. Player islands remain unchanged.

The fitted clone lowers raised geometry inside playable market, supply, depot and cargo footprints to the table plane, with one-unit feathered edges. Geometry is cloned before editing; the downloaded GLB and cached source remain unchanged. The decorative terrain does not intercept piece raycasts. Production builds include `art/meshy-island/Main Island.glb`.

Verified the populated default preview in-browser. TypeScript, 10 terrain/camera/layout tests, and production build passed. The terrain test verifies clearing heights and preservation of source geometry.

## Default reverted to original artwork

The user preferred the previous image after viewing the 3D board. The original island artwork is again the default. The preserved 3D terrain is opt-in with `?island=3d`; no artwork or model files were deleted.
