import { expect, test } from '@playwright/test';
import { applyCommand, createGame, getLegalCommands } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand } from '@vibe-rico/game-engine';
import * as three from '../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import { closeTables, play, seatTable } from './table.js';

test.afterEach(closeTables);
const input = three.input as unknown as CreateGameInput;
const commands = three.commands as readonly GameCommand[];
const governor = input.seatOrder.indexOf(input.governorPlayerId);

test('roles and worker allocation can be completed by keyboard with a visible focus ring', async ({ browser }) => {
  const pages = await seatTable(browser, input.seatOrder, { seed: input.seed, governor });
  const created = createGame(input);
  if (!created.ok) throw Error('setup');
  let state = created.state;
  for (const command of commands.slice(0, 9)) {
    const page = pages[input.seatOrder.indexOf(command.actorId as never)]!;
    await play(page, state, command, true);
    const result = applyCommand(state, command);
    if (!result.ok) throw Error(result.error.message);
    state = result.state;
  }
  for (const p of pages) await expect(p.locator(`[data-revision="${state.revision}"]`)).toBeVisible();
});

test('decision-maker and waiting reasons are stated in text, not only colour', async ({ browser }) => {
  const pages = await seatTable(browser, input.seatOrder, { seed: input.seed, governor });
  const actor = pages[governor]!, waiting = pages[(governor + 1) % 3]!;
  await actor.getByRole('button', { name: '时间线', exact: true }).click();
  await waiting.getByRole('button', { name: '时间线', exact: true }).click();
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
  await actor.locator('.role-card').nth(0).click();
  for (const p of pages) {
    await expect(p.locator('[data-revision="1"]')).toBeVisible();
    await p.locator('summary[aria-label="设置与帮助"]').click();
    await expect(p.getByLabel('减少动画')).toBeChecked();
    // A pulse would show the skip button for 600 ms; it must never appear.
    for (let i = 0; i < 5; i++) { await expect(p.getByRole('button', { name: '跳过动画' })).toHaveCount(0); await p.waitForTimeout(100); }
  }
});
