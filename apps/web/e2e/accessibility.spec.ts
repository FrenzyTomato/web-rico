import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { applyCommand, createGame, getLegalCommands } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand } from '@vibe-rico/game-engine';
import { isDeepStrictEqual } from 'node:util';
import * as three from '../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import { describeOptions } from '../src/actions/options.js';
import { closeTables, seatTable } from './table.js';

test.afterEach(closeTables);
const input = three.input as unknown as CreateGameInput;
const commands = three.commands as readonly GameCommand[];
const governor = input.seatOrder.indexOf(input.governorPlayerId);

/** Presses Tab until the focused element satisfies `match` (a keyboard user reaching a control). */
async function tabTo(page: Page, match: (el: { tag: string; text: string }) => boolean, limit = 200) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const el = await page.evaluate(() => ({ tag: document.activeElement?.tagName ?? '', text: document.activeElement?.textContent ?? '' }));
    if (match(el)) return;
  }
  throw Error('control not reachable by Tab');
}

test('representative roles can be completed with the keyboard alone, with a visible focus ring', async ({ browser }) => {
  const pages = await seatTable(browser, input.seatOrder, { seed: input.seed, governor });
  const created = createGame(input);
  if (!created.ok) throw Error('setup');
  let state = created.state;
  // Recruiter choice, worker distribution and allocation forms, then the next role choice and Planter turns.
  for (const command of commands.slice(0, 9)) {
    const page = pages[input.seatOrder.indexOf(command.actorId as never)]!;
    await expect(page.locator(`[data-revision="${state.revision}"]`)).toBeVisible();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const legal = getLegalCommands(state, command.actorId)[0]!;
    const options = describeOptions(legal, state);
    if (options) {
      const { actorId: _, ...played } = command;
      const label = options.find(o => isDeepStrictEqual(o.action, played))!.label;
      await tabTo(page, el => el.tag === 'BUTTON' && el.text === label);
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
      expect(outline).not.toBe('none');
      await page.keyboard.press('Enter');
    } else if (legal.phase === 'recruiter-placement' && command.kind === 'allocate-workers') {
      for (const slot of legal.slots) {
        await tabTo(page, el => el.tag === 'INPUT');
        const value = slot.kind === 'countryside'
          ? Number(command.allocation.countryside.find(t => t.tileId === slot.instanceId)!.occupied)
          : command.allocation.buildings.find(b => b.buildingId === slot.instanceId)!.occupiedSlots;
        await page.keyboard.press('Backspace');
        await page.keyboard.type(String(value));
      }
      await tabTo(page, el => el.tag === 'BUTTON' && el.text === '确认分配');
      await page.keyboard.press('Enter');
    }
    const r = applyCommand(state, command);
    if (!r.ok) throw Error(r.error.message);
    state = r.state;
  }
  for (const p of pages) await expect(p.locator(`[data-revision="${state.revision}"]`)).toBeVisible();
});

test('decision-maker and waiting reasons are stated in text, not only colour', async ({ browser }) => {
  const pages = await seatTable(browser, input.seatOrder, { seed: input.seed, governor });
  const actor = pages[governor]!, waiting = pages[(governor + 1) % 3]!;
  await expect(actor.getByLabel('回合信息')).toContainText('轮到你：选择角色');
  await expect(waiting.getByLabel('回合信息')).toContainText(`等待 ${input.governorPlayerId}：选择角色`);
  await expect(waiting.getByLabel('玩家列表')).toContainText(`${input.governorPlayerId}（行动中）`);
});

test('reduced motion: no pulse animation plays after an event', async ({ browser }) => {
  const pages = await seatTable(browser, input.seatOrder, { seed: input.seed, governor }, { reducedMotion: 'reduce' });
  const actor = pages[governor]!;
  await expect(actor.locator('[data-revision="0"]')).toBeVisible();
  const created = createGame(input);
  if (!created.ok) throw Error('setup');
  const label = describeOptions(getLegalCommands(created.state, input.governorPlayerId)[0]!, created.state)!
    .find(o => isDeepStrictEqual(o.action, (({ actorId: _, ...rest }) => rest)(commands[0]!)))!.label;
  await actor.getByRole('button', { name: label, exact: true }).click();
  for (const p of pages) {
    await expect(p.locator('[data-revision="1"]')).toBeVisible();
    await expect(p.getByLabel('减少动画')).toBeChecked();
    // A pulse would show the skip button for 600 ms; it must never appear.
    for (let i = 0; i < 5; i++) { await expect(p.getByRole('button', { name: '跳过动画' })).toHaveCount(0); await p.waitForTimeout(100); }
  }
});
