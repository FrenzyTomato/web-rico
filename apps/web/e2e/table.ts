import { isDeepStrictEqual } from 'node:util';
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, BrowserContextOptions, Page } from '@playwright/test';
import { getLegalCommands } from '@vibe-rico/game-engine';
import type { GameCommand, GameState, Good } from '@vibe-rico/game-engine';
import { describeOptions } from '../src/actions/options.js';
import { GOOD } from '../src/i18n/terms.js';

const GOODS: Good[] = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'];
const withoutActor = (c: GameCommand) => { const { actorId: _, ...rest } = c; return rest; };

const open: BrowserContext[] = [];
/** Closes every seat context: contexts from `browser.newContext()` otherwise keep rendering WebGL across tests. */
export async function closeTables() { await Promise.all(open.splice(0).map(c => c.close())); }

/** One independent browser context per seat; names become display names. Seats join in `names` order. */
export async function seatTable(browser: Browser, names: readonly string[], game: { seed: number; governor: number }, options: BrowserContextOptions = {}) {
  await fetch('http://127.0.0.1:3000/e2e/next-game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(game) });
  const pages: Page[] = [];
  for (const _ of names) { const context = await browser.newContext(options); open.push(context); pages.push(await context.newPage()); }
  const [host, ...guests] = pages;
  await host!.goto('/');
  await host!.getByLabel('昵称').fill(names[0]!);
  await host!.getByRole('button', { name: '创建房间' }).click();
  const code = (await host!.locator('strong').textContent())!;
  for (const [i, page] of guests.entries()) {
    await page.goto(`/?room=${code}`);
    await page.getByLabel('昵称').fill(names[i + 1]!);
    await page.getByRole('button', { name: '加入房间' }).click();
    await expect(page.locator('strong')).toHaveText(code);
  }
  await expect(host!.getByRole('listitem')).toHaveCount(names.length);
  await host!.getByRole('button', { name: '开始游戏' }).click();
  return pages;
}

/** Waits for the page to show `state`'s revision, then performs `command` through the visible controls. */
export async function play(page: Page, state: GameState, command: GameCommand) {
  await expect(page.locator(`[data-revision="${state.revision}"]`)).toBeVisible();
  const legal = getLegalCommands(state, command.actorId)[0]!;
  const options = describeOptions(legal, state);
  if (options) {
    const option = options.find(o => isDeepStrictEqual(o.action, withoutActor(command)));
    if (!option) throw Error(`command ${command.kind} is not among the offered options`);
    await page.getByRole('button', { name: option.label, exact: true }).click();
  } else if (legal.phase === 'recruiter-placement' && command.kind === 'allocate-workers') {
    const inputs = page.getByRole('spinbutton');
    for (const [i, slot] of legal.slots.entries()) {
      const value = slot.kind === 'countryside'
        ? Number(command.allocation.countryside.find(t => t.tileId === slot.instanceId)!.occupied)
        : command.allocation.buildings.find(b => b.buildingId === slot.instanceId)!.occupiedSlots;
      await inputs.nth(i).fill(String(value));
    }
    await page.getByRole('button', { name: '确认分配' }).click();
  } else if (legal.phase === 'captain-retention' && command.kind === 'retain') {
    for (const g of GOODS.filter(g => legal.available[g] > 0)) {
      await page.getByLabel(new RegExp(`^${GOOD[g]} 保留`)).fill(String(command.retained[g]));
      if (command.warehouseTypes.includes(g)) await page.getByLabel(`仓库保护 ${GOOD[g]}`).check();
    }
    await page.getByRole('button', { name: '确认保留' }).click();
  } else {
    throw Error(`no control for ${legal.phase}`);
  }
}
