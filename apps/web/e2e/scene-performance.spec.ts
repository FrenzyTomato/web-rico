import { expect, test } from '@playwright/test';

// docs/PERFORMANCE.md: full 5-player late-game table (frozen fixture revision 396) at 1080p.
test.use({ viewport: { width: 1920, height: 1080 } });
const FULL_TABLE = '/scene-preview.html?game=5p&at=396';

test('full table: p95 frame time is at most 33 ms with continuous rendering', async ({ page }) => {
  test.skip(Boolean(process.env.CI) && !process.env.RUN_GPU_BENCHMARK, '33 ms GPU budget requires a hardware-accelerated benchmark runner; CI still checks scene lifecycle and context recovery.');
  await page.goto(`${FULL_TABLE}&bench=1`);
  const bench = await page.waitForFunction(() => (window as unknown as { __bench?: unknown }).__bench, null, { timeout: 15_000 }).then(h => h.jsonValue()) as { frames: number; p50: number; p95: number };
  console.log(`bench ${JSON.stringify(bench)}`);
  expect(bench.frames).toBeGreaterThan(30);
  expect(bench.p95).toBeLessThanOrEqual(33);
});

test('ten scene enter/exit cycles leave no growing textures, canvases or shared resources', async ({ page }) => {
  await page.goto(`${FULL_TABLE}&cycles=10`);
  const samples = await page.waitForFunction(() => {
    const c = (window as unknown as { __cycles?: unknown[] }).__cycles;
    return c && c.length === 10 ? c : null;
  }, null, { timeout: 60_000 }).then(h => h.jsonValue()) as { textures: number; canvases: number; heap: number | null; geometries: number; materials: number }[];
  console.log(`cycles ${JSON.stringify(samples.map(s => [s.textures, s.canvases, s.geometries, s.materials, s.heap && Math.round(s.heap / 1e6)]))}`);
  for (const s of samples) expect([s.textures, s.canvases]).toEqual([0, 0]);
  // Shared geometry/material caches are bounded by the palette: no growth after the first visit.
  expect(new Set(samples.map(s => `${s.geometries}/${s.materials}`)).size).toBe(1);
  const heaps = samples.map(s => s.heap).filter((h): h is number => h !== null);
  if (heaps.length) expect(heaps.at(-1)! - heaps[1]!).toBeLessThan(20e6);
});

test('WebGL context loss shows the notice and the scene recovers on restore', async ({ page }) => {
  await page.goto(FULL_TABLE);
  await expect(page.locator('.scene canvas')).toBeVisible();
  // Lose the context only once the renderer is fully created (the scene probe mounts inside the live canvas).
  await page.waitForFunction(() => typeof (window as unknown as { __sceneTargets?: unknown }).__sceneTargets === 'function');
  await page.evaluate(() => {
    const ext = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    (window as unknown as { __ext: WEBGL_lose_context }).__ext = ext;
    ext.loseContext();
  });
  await expect(page.getByRole('note')).toHaveText('立体视图暂时不可用，正在恢复…');
  await page.evaluate(() => (window as unknown as { __ext: WEBGL_lose_context }).__ext.restoreContext());
  await expect(page.getByRole('note')).toHaveCount(0);
  await expect(page.locator('.scene canvas')).toBeVisible();
  // The remounted scene is live: its WebGL context is usable.
  expect(await page.evaluate(() => !document.querySelector('canvas')!.getContext('webgl2')!.isContextLost())).toBe(true);
});
