import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CreateGameInput, GameCommand } from '@vibe-rico/game-engine';
import * as three from '../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import { closeTables, seatTable } from './table.js';

test.afterEach(closeTables);

const input = three.input as unknown as CreateGameInput;
const first = three.commands[0] as Extract<GameCommand, { kind: 'choose-role' }>;
type Target = { key: string; actionable: boolean; x: number; y: number };

/** Clicks a scene object at its projected position (dev-only `__sceneTargets` probe). */
async function clickObject(page: Page, key: string) {
  await expect.poll(() => page.evaluate(k => (window as unknown as { __sceneTargets?: () => Target[] }).__sceneTargets?.().some(t => t.key === k), key)).toBe(true);
  const target = (await page.evaluate(k => (window as unknown as { __sceneTargets: () => Target[] }).__sceneTargets().find(t => t.key === k)!, key));
  const box = (await page.locator('.scene canvas').boundingBox())!;
  await page.mouse.click(box.x + target.x, box.y + target.y);
  return target;
}

test('clicking scene objects offers only their legal actions and submits through the same channel', async ({ browser }) => {
  const pages = await seatTable(browser, input.seatOrder, { seed: input.seed, governor: input.seatOrder.indexOf(input.governorPlayerId) });
  const governor = pages[input.seatOrder.indexOf(first.actorId)]!, other = pages[(input.seatOrder.indexOf(first.actorId) + 1) % 3]!;
  for (const p of pages) await expect(p.locator('[data-revision="0"]')).toBeVisible();

  // Command tiles now live in the hand; estate choices still use the real canvas.
  await governor.getByRole('button', { name: /^选择角色 种植者/ }).click();
  for (const p of pages) await expect(p.locator('[data-revision="1"]')).toBeVisible();
  await governor.getByRole('button', { name: '可选田园', exact: true }).click();
  await other.getByRole('button', { name: '可选田园', exact: true }).click();
  await expect.poll(() => governor.evaluate(() => (window as unknown as { __sceneTargets?: () => Target[] }).__sceneTargets?.().some(t => t.key.startsWith('estate:') && t.actionable))).toBe(true);
  const key = await governor.evaluate(() => (window as unknown as { __sceneTargets: () => Target[] }).__sceneTargets().find(t => t.key.startsWith('estate:') && t.actionable)!.key);
  expect((await clickObject(other, key)).actionable).toBe(false);
  await expect(other.getByRole('group', { name: '所选对象的行动' })).toHaveCount(0);
  expect((await clickObject(governor, key)).actionable).toBe(true);
  const panel = governor.getByRole('group', { name: '所选对象的行动' });
  await panel.getByRole('button').first().click();
  for (const p of pages) await expect(p.locator('[data-revision="2"]')).toBeVisible();
});
