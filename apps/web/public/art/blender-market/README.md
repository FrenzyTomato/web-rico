# Lightweight Blender market prototype

Original model created in Blender 5.2.2 with `assets/blender/create_market.py`.
Editable source: `assets/blender/market.blend`. Browser asset: `market.glb`.
Preview: `/blender-market-preview.html`.

7,440 triangles; 12 material-group meshes. GLB embeds the shared original generated wood/stone atlas. All other materials use simple colors. Curved striped cloth, beams, braces, counters, crates, low-poly produce, sacks, baskets and rear shelving are real geometry. It is intentionally simpler than the illustrated HD-2D reference.

Blender uses Z up; glTF export converts to Y up. Fit the complete model's measured bounds to its game footprint before integration; side awning extends beyond the foundation. Clone loaded scene instances and share geometry/materials. No gameplay state, workers, animations or interactive hit regions are included.

Regenerate from the repository root:

    /Applications/Blender.app/Contents/MacOS/Blender --background --python assets/blender/create_market.py

The generator reads the original atlas from `apps/web/public/art/blender-market/market-original-atlas.png`; the exported blend and GLB pack their texture internally. Re-running overwrites these prototype outputs.

Verified: Blender saved the .blend and exported GLB successfully. Chrome loaded the GLB in Three.js with no page errors. Front and rear views were inspected after dragging OrbitControls. Live game integration and performance with multiple instances are not yet tested.
