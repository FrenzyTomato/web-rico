import { isDeepStrictEqual } from 'node:util';
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, BrowserContextOptions, Locator, Page } from '@playwright/test';
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
  for (const _ of names) {
    const context = await browser.newContext(options);
    // Functional multiplayer tests exercise the real controls and fallback meshes.
    // Art loading and WebGL lifecycle are covered separately in scene-performance.
    await context.route(/\.glb(?:\.gz)?(?:\?.*)?$/, route => route.abort());
    open.push(context); pages.push(await context.newPage());
  }
  const [host, ...guests] = pages;
  await host!.goto('/');
  await host!.getByLabel('昵称').fill(names[0]!);
  await host!.getByLabel('创建房间密码').fill('e2e-room-password');
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
export async function play(page: Page, state: GameState, command: GameCommand, keyboard = false) {
  await expect(page.locator(`[data-revision="${state.revision}"]`)).toBeVisible();
  const activate = async (control: Locator) => {
    if (!keyboard) { await control.click(); return; }
    await expect(control).toBeVisible();
    for (let i = 0; i < 200 && !(await control.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
    expect(await control.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Enter');
  };
  const legal = getLegalCommands(state, command.actorId)[0]!;
  const options = describeOptions(legal, state);
  if (options) {
    const option = options.find(o => isDeepStrictEqual(o.action, withoutActor(command)));
    if (!option) throw Error(`command ${command.kind} is not among the offered options`);
    if (command.kind === 'choose-role' && legal.phase === 'role-selection') {
      await activate(page.locator('.role-card').nth(legal.roleCardIds.indexOf(command.roleCardId)));
    } else {
      const keyboardChoices = page.getByText('键盘选择', { exact: true });
      if (await keyboardChoices.count()) await activate(keyboardChoices);
      await activate(page.getByRole('button', { name: option.label, exact: true }));
    }
  } else if (legal.phase === 'recruiter-placement' && command.kind === 'allocate-workers') {
    await activate(page.getByText('键盘分配工人', { exact: true }));
    const controls = page.locator('.hand [aria-label="分配工人"] details');
    const player = state.players.find(p => p.playerId === command.actorId)!;
    const counts = legal.slots.map(slot => slot.kind === 'countryside'
      ? Number(player.countryside.find(t => t.instanceId === slot.instanceId)!.occupied)
      : player.buildings.find(b => b.instanceId === slot.instanceId)!.occupiedSlots);
    const desired = legal.slots.map(slot => slot.kind === 'countryside'
      ? Number(command.allocation.countryside.find(t => t.tileId === slot.instanceId)!.occupied)
      : command.allocation.buildings.find(b => b.buildingId === slot.instanceId)!.occupiedSlots);
    // Return excess workers first, then place from the pool using the same controls as players.
    for (const [i, count] of counts.entries()) for (let n = count; n > desired[i]!; n--) {
      await activate(controls.locator(':scope > span').nth(i).getByRole('button').nth(1));
      await activate(controls.getByRole('button', { name: '选择／放回池中工人', exact: true }));
    }
    for (const [i, count] of counts.entries()) for (let n = count; n < desired[i]!; n++) {
      await activate(controls.getByRole('button', { name: '选择／放回池中工人', exact: true }));
      await activate(controls.locator(':scope > span').nth(i).getByRole('button').nth(0));
    }
    await activate(page.getByRole('button', { name: '确认分配' }));
  } else if (legal.phase === 'captain-retention' && command.kind === 'retain') {
    for (const g of GOODS.filter(g => legal.available[g] > 0)) {
      await page.getByLabel(new RegExp(`^${GOOD[g]} 保留`)).fill(String(command.retained[g]));
      if (command.warehouseTypes.includes(g)) await page.getByLabel(`仓库保护 ${GOOD[g]}`).check();
    }
    await activate(page.getByRole('button', { name: '确认保留' }));
  } else {
    throw Error(`no control for ${legal.phase}`);
  }
}
