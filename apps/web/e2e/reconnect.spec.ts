import { expect, test } from '@playwright/test';
import { applyCommand, createGame } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand } from '@vibe-rico/game-engine';
import * as three from '../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import { closeTables, play, seatTable } from './table.js';

test.afterEach(closeTables);

const input = three.input as unknown as CreateGameInput;
const commands = three.commands as readonly GameCommand[];
async function table(browser: import('@playwright/test').Browser) {
  const created = createGame(input);
  if (!created.ok) throw Error(created.error.message);
  const pages = await seatTable(browser, input.seatOrder, { seed: input.seed, governor: input.seatOrder.indexOf(input.governorPlayerId) });
  return { pages, state: created.state, page: (id: string) => pages[input.seatOrder.indexOf(id as never)]! };
}

test('network loss right after an action: the player sees the loss, and after reconnecting the action counts once', async ({ browser }) => {
  const { pages, state, page } = await table(browser);
  const first = commands[0]!, actor = page(first.actorId);
  await play(actor, state, first);
  await actor.context().setOffline(true);
  await expect(actor.getByText('连接已断开，正在重新连接…')).toBeVisible();
  await actor.context().setOffline(false);
  await expect(actor.getByText('连接已断开，正在重新连接…')).toBeHidden({ timeout: 15_000 });
  // Every seat is at revision 1: the command applied once, whether or not its acknowledgement was lost.
  for (const p of pages) await expect(p.locator('[data-revision="1"]')).toBeVisible();
  const after = applyCommand(state, first);
  if (!after.ok) throw Error(after.error.message);
  await play(page(commands[1]!.actorId), after.state, commands[1]!);
  for (const p of pages) await expect(p.locator('[data-revision="2"]')).toBeVisible();
});

test('a second tab takes over the seat; the first tab is told and can no longer act', async ({ browser }) => {
  const { state, page } = await table(browser);
  const first = commands[0]!, oldTab = page(first.actorId);
  const newTab = await oldTab.context().newPage();
  await newTab.goto('/');
  await expect(newTab.locator('[data-revision="0"]')).toBeVisible();
  await expect(oldTab.getByText('此座位已在其他窗口中打开')).toBeVisible();
  await play(newTab, state, first);
  await expect(oldTab.locator('[data-revision="0"]')).toBeVisible();
  await expect(newTab.locator('[data-revision="1"]')).toBeVisible();
});
