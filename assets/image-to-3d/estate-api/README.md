# Meshy estate API batch

Five user-authorized assets: corn, banana (fruit), sugarcane, tobacco, quarry.

References are direct crops of the user's `/Users/async/Downloads/rico.PNG`, not newly generated illustrations. Crops (left, top, right, bottom): corn (0,35,533,508), banana (537,45,1030,521), sugar (1035,40,1536,522), tobacco (0,503,534,965), quarry (1037,522,1536,974). Individual PNG inputs are in `references/`.

`generate.mjs` reads `MESHY_API_KEY` from the process environment. Run from the repository root with Node 24:

```sh
node --env-file=.env assets/image-to-3d/estate-api/generate.mjs submit
node --env-file=.env assets/image-to-3d/estate-api/generate.mjs poll
```

The root `.env` is ignored by Git. Credentials and signed download URLs are never written to batch metadata. `tasks.json` records confirmed task IDs and status, enabling polling/downloading without duplicate paid submissions. A `SUBMITTING` record without an ID is ambiguous and must be reconciled with Meshy before any retry. The script deliberately does not retry POST requests. Only the five named assets are submitted; no automatic regeneration or paid repair.

Configuration: Meshy 6 Lite, 2K textures, PBR maps, no remesh, GLB output. Published estimate at submission: 15 credits each, 75 total. Initial account balance: 1,130. The coffee model is reused from the earlier manual download, not regenerated.

Full geometry is retained to avoid repeating thin-leaf damage seen in aggressive coffee simplification. These are art review assets, not performance-qualified board models. Generated outputs go to `apps/web/public/art/meshy-estates/`; compare them using `apps/web/meshy-estates-preview.html`. Existing Blender and coffee models are preserved.

Sources: [Image-to-3D API](https://docs.meshy.ai/en/api/image-to-3d), [API pricing](https://docs.meshy.ai/en/api/pricing). These five were generated through the authenticated API; no separate CC BY declaration is applied here. Consult the account's applicable Meshy license terms before redistribution.

## Completed batch

All five tasks succeeded and downloaded automatically. Balance changed from 1,130 to 1,055: 75 credits used; no paid retries. Run `python3 assets/image-to-3d/estate-api/inspect.py` to recheck GLB headers, buffer bounds, triangle/index counts, index bounds and embedded texture references and reproduce `stats.json`.

| Asset | Triangles | File size (decimal MB) |
|---|---:|---:|
| Corn | 494,898 | 21.3 |
| Banana | 624,876 | 25.7 |
| Sugarcane | 773,298 | 30.6 |
| Tobacco | 510,166 | 21.1 |
| Quarry | 231,644 | 12.5 |

All five loaded in the Three.js collection preview with three embedded textures each and no browser error logs. Screenshots per asset and `collection-preview.jpg` record the visual review. The generated corn model includes detached foliage fragments; some banana leaves are ragged. These are source-generation artifacts, not introduced by local simplification. No watertightness or board-performance guarantee is made. Further cleanup/optimization is separate from this five-generation batch.

## Corn floating-leaf cleanup

`clean-corn.py` identifies connected components after welding coincident positions for analysis. Of five components, only the two inspected floating leaves (6,824 + 5,632 triangles) are excluded from the new index buffer. The main estate and both small interior components are preserved. Vertex positions, normals, UVs and embedded textures remain unchanged. Original `corn.glb` is preserved; preview loads `corn-cleaned.glb` (482,442 triangles). Component-count assertions stop the script if the source changes. Verified from two angles in Three.js and rechecked GLB structure/index bounds with `inspect.py`. No API credits used.
