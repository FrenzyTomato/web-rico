# Scene Performance — PR-055

## Device and conditions

**Agreed desktop device:** confirmed by the user on 2026-10-01.

| Item | Value |
| --- | --- |
| Machine | Apple M4, 16 GB RAM, macOS 15.5 |
| GPU path | Chrome (system install, Playwright `channel: 'chrome'`, headless) — WebGL2 via ANGLE Metal on the Apple M4 (verified renderer string) |
| Viewport | 1920 × 1080 |
| Scene | Full 5-player late-game table: frozen PR-036 fixture `5p`, revision 396 (all three ships full, five populated boards, sold-out buildings) via the dev-only `scene-preview.html` |

## Targets and results

| Check | Target | Method | Result (2026-10-01) |
| --- | --- | --- | --- |
| Frame time | p95 ≤ 33 ms | `?bench=1` forces continuous rendering for 3 s after a 1 s warm-up and records `requestAnimationFrame` intervals | p95 16.8 ms, p50 16.7 ms over 181 frames, so it is vsync-limited at 60 fps |
| Resource growth | none sustained across 10 enter/exit cycles | `?cycles=10` mounts and unmounts the scene ten times, sampling after each exit | label textures 0 and canvases 0 after every exit; shared caches fixed at 9 geometries / 12 materials; JS heap 54–72 MB with no trend |
| WebGL recovery | the scene recovers after context loss | `WEBGL_lose_context.loseContext()` then `restoreContext()` once the renderer is live | the notice 「3D 视图暂时不可用，正在恢复…」 shows while lost; on restore it clears and the context is usable |

The checks live in `apps/web/e2e/scene-performance.spec.ts`. Hosted CI runs the resource-lifecycle and WebGL-recovery checks using Playwright's pinned Chromium. The strict p95 ≤ 33 ms benchmark runs locally on the agreed hardware; it is skipped on general-purpose CI runners, whose software rendering is not a comparable GPU measurement. Set `RUN_GPU_BENCHMARK=1` to include it on a hardware-accelerated CI runner.

Multiplayer functional tests use selectable fallback meshes to avoid loading duplicate high-resolution models for every browser seat. The separate scene tests load the real artwork.

## What keeps it cheap

- **On-demand rendering:** `frameloop="demand"`. The board only changes on a new snapshot, so the canvas redraws on each view change, on visibility, during pulses, and at a 1 fps safety net, instead of at 60 fps.
- **Shared resources** (`scene/resources.ts`): one geometry per piece shape and one material per colour for the most repeated pieces (crates, worker discs, coins, tiles, buildings, market blocks). They live for the page (`dispose={null}`), bounded by the palette.
- **Label textures:** created per label text and disposed on unmount (counted by `liveTextures`).
- **Code-splitting:** the Three.js scene is lazy-loaded. The main bundle dropped from 1,284 kB to 378 kB (117 kB gzip); the scene chunk (928 kB, 247 kB gzip, mostly three.js) loads only when the 3D stage is shown. Vite's >500 kB warning remains for that chunk by design. Pure selection logic (`Selection.tsx`) is kept apart from scene components (`Selectable.tsx`) so the shell does not pull three.js in statically.

## Not covered

- Other GPUs or browsers (integrated Intel, Windows, Firefox/Safari) are not measured.
- Mobile layouts are out of V1 scope (desktop first).
