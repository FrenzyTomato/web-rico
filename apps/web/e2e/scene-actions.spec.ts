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

  // Another seat's click selects but offers nothing to run, and changes nothing.
  expect((await clickObject(other, `role:${first.roleCardId}`)).actionable).toBe(false);
  await expect(other.getByText('此对象当前没有可执行的行动')).toBeVisible();
  await expect(other.locator('[data-revision="0"]')).toBeVisible();

  // The Governor's click on the role card offers exactly that card's action.
  expect((await clickObject(governor, `role:${first.roleCardId}`)).actionable).toBe(true);
  const panel = governor.getByRole('group', { name: '所选对象的行动' });
  await expect(panel.getByRole('button')).toHaveCount(2);
  await panel.getByRole('button', { name: /^选择角色/ }).click();
  for (const p of pages) await expect(p.locator('[data-revision="1"]')).toBeVisible();
});

test('a server rejection from the scene panel keeps every view consistent', async ({ browser }) => {
  const pages = await seatTable(browser, input.seatOrder, { seed: input.seed, governor: input.seatOrder.indexOf(input.governorPlayerId) });
  const oldTab = pages[input.seatOrder.indexOf(first.actorId)]!;
  await expect(oldTab.locator('[data-revision="0"]')).toBeVisible();
  await clickObject(oldTab, `role:${first.roleCardId}`);
  // The seat is taken over by a second tab while the old tab's panel is open; its submission is rejected.
  const newTab = await oldTab.context().newPage();
  await newTab.goto('/');
  await expect(newTab.locator('[data-revision="0"]')).toBeVisible();
  await oldTab.getByRole('group', { name: '所选对象的行动' }).getByRole('button', { name: /^选择角色/ }).click();
  await expect(oldTab.getByRole('alert')).toHaveText('此座位已在其他窗口中打开');
  for (const p of [...pages, newTab]) await expect(p.locator('[data-revision="0"]')).toBeVisible();
});
