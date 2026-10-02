# Coffee image-to-3D trial

Reference prepared using built-in image generation from the user's `rico.PNG`. This is a regenerated isolated reference, not an exact crop or a 3D model.

Prompt:

Extract and faithfully recreate ONLY the bottom-center coffee estate diorama from the reference image, as a single isolated asset centered large on a plain white background. Preserve its isometric camera, square ochre base, wooden front fence, lush dark green coffee shrubs with brown orange berries, small white cottage with red tiled roof at the back, wooden awning and coffee crate and sack. Preserve all proportions, rich stylized miniature textures, rounded crafted edges and colors. No other estates, no text, no additions. Entire tile visible with modest padding. This is a clean reference image for image-to-3D reconstruction.

User approved the free CC BY 4.0 trial. Generated one Meshy 6 Lite mesh (10 free credits) and one textured version with PBR maps (10 free credits) on 2026-10-02.

Meshy reports 709,356 triangles and 416,728 vertices for the textured result. Front and reverse-side views inspected in Meshy: recognizable coffee shrubs, cottage, fence, crate and sack; some coarse foliage and surface artifacts remain. Not board-ready at this density.

`meshy-preview.png` records the textured result. Three GLB download attempts (two untextured, one textured) consumed download slots, but the browser download API timed out and no local GLB was found in Downloads or checked temporary locations. Stop retrying to preserve remaining download slots. User manual download is needed before local Three.js integration and optimization can proceed. Existing game assets remain unchanged.

Workspace: https://www.meshy.ai/workspace (signed-in account; textured coffee tile is the newest asset). License selected: CC BY 4.0; retain attribution when distributing any eventual export.

## Local import and comparison

The user manually downloaded `Meshy_AI_Coffee_Farm_Miniature_1001153056_texture.glb`. Original preserved in `apps/web/public/art/meshy-coffee/original.glb` (28,465,960 bytes). `optimize.mjs` uses the installed meshoptimizer with UV and normal attributes and preserves seams and all embedded texture bytes. Final `lite.glb`: 59,990 triangles, 8,965,952 bytes. More aggressive 30k versions showed visible artifacts and were replaced.

`apps/web/meshy-coffee-preview.html` offers original/lite comparisons, orbit, zoom and auto rotation. Both models visually checked in Three.js; no browser error logs. Screenshot: `three-preview.png`. This is a separate preview, not gameplay integration; textures are still full resolution, and board-scale performance remains unmeasured. No Blender used in this conversion.

## Leaf repair (supersedes the 60k result)

The 60k simplification produced conspicuous leaf-surface artifacts at close range. Both GLBs already had double-sided opaque materials; toggling back-face rendering was not a fix. Disabling self-shadow reception did not remove the artifacts either, and that diagnostic change was reverted.

The final converter locks mesh boundaries and reduces the allowed simplification error to 0.001. It stops at 264,984 triangles / 180,307 vertices / 15,567,984 bytes rather than forcing the requested 180k target. The prior lite file is preserved as `lite-before-leaf-fix.glb`. Original GLB and texture payloads are unchanged. Preview asset URL now includes a revision to avoid serving the old cached mesh.

Validation: checked close side and overhead views in Three.js; the conspicuous leaf holes from the 60k trial are absent in those views. Accessor bounds, index bounds, non-degenerate index triples and byte-identical texture payloads checked. This is not a guarantee of watertight source geometry. No gameplay integration or board performance claim.
