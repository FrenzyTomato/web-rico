import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type Target = { key: string; x: number; y: number; actionable: boolean };
const sceneTargets = (page: Page) => page.evaluate(() => (window as unknown as { __sceneTargets: () => Target[] }).__sceneTargets());

for (const mobile of [false, true]) test(`simulated tutorial plays every turn with the normal controls (${mobile ? 'mobile' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('vibe-rico.settings', JSON.stringify({ autoProduce: true })));
  const requests: string[] = [];
  page.on('request', r => { if (r.url().includes('/socket.io')) requests.push(r.url()); });
  await page.goto('/?tutorial=1');
  const coach = page.locator('.tutorial-coach'), hand = page.locator('.hand .actions');
  // Opening pages: the table, your island, where to look, the round flow. Nothing is playable yet.
  for (const title of ['Welcome to the table', 'Your island', 'Places to check', 'How a round flows']) {
    await expect(coach).toContainText(title);
    await expect(page.locator('.role-hand .role-card:enabled')).toHaveCount(0);
    await coach.getByRole('button', { name: title === 'How a round flows' ? 'Start' : 'Next', exact: true }).click();
  }
  await expect(page.locator('.role-hand .role-card')).toHaveCount(6);
  await expect(page.locator('.role-hand .role-card:enabled')).toHaveCount(1);
  await expect(page.locator('.role-hand .role-card:enabled')).toContainText('Planter');
  await expect(coach).toContainText('Choose Planter');
  await page.locator('.role-hand .role-card:enabled').click();
  // The guide explains the role just chosen alongside the follow-up it unlocks.
  await expect(coach).toContainText('You chose Planter');
  await expect(coach).toContainText('Take Corn');
  // Click the upper model on the board; the normal action panel confirms it.
  await page.waitForFunction(() => (window as unknown as { __sceneTargets?: () => Target[] }).__sceneTargets?.().some(t => t.key.startsWith('estate:estate-corn-') && t.actionable));
  await page.waitForTimeout(1000); // Let the guided camera settle before projecting the target.
  const targets = await sceneTargets(page);
  expect(targets.filter(t => t.key.startsWith('estate:') && t.actionable)).toHaveLength(1);
  const corn = targets.find(t => t.key.startsWith('estate:estate-corn-') && t.actionable)!;
  const boardCanvas = (await page.locator('canvas').boundingBox())!;
  const cornPoint = { x: boardCanvas.x + corn.x, y: boardCanvas.y + corn.y - 40 };
  if (mobile) await page.touchscreen.tap(cornPoint.x, cornPoint.y);
  else await page.mouse.click(cornPoint.x, cornPoint.y);
  // Object hints stay closed in the tutorial, so the guide is the only tooltip.
  if (!mobile) { await page.mouse.move(cornPoint.x, cornPoint.y); await page.waitForTimeout(300); await expect(page.locator('.scene .model-tooltip')).toHaveCount(0); }
  await page.getByRole('group', { name: 'Actions for selected piece' }).getByRole('button', { name: /^Plant Corn/ }).click();
  await expect(coach).toHaveAttribute('data-tutorial-stage', 'result');
  await expect(coach).toContainText('Check your island');
  await coach.getByRole('button', { name: 'Next', exact: true }).click();
  // A real automatic opponent transition, rather than installing a future snapshot.
  await expect(coach).toHaveAttribute('data-tutorial-actor', 'bruno');
  await expect(coach).toHaveAttribute('data-tutorial-stage', 'opponent-result', { timeout: 5000 });
  await expect(coach).toContainText('Bruno took');

  const roleChoices = ['Planter'];
  const botLoads: string[] = [];
  let previousRevision = Number(await coach.getAttribute('data-revision'));
  let checkedBuild = false;
  for (let count = 0; count < 130; count++) {
    const stage = await coach.getAttribute('data-tutorial-stage');
    const kind = await coach.getAttribute('data-tutorial-step');
    const actor = await coach.getAttribute('data-tutorial-actor');
    const index = await coach.getAttribute('data-tutorial-index');
    const revision = Number(await coach.getAttribute('data-revision'));
    expect(revision - previousRevision).toBeGreaterThanOrEqual(0);
    expect(revision - previousRevision).toBeLessThanOrEqual(1);
    previousRevision = revision;
    if (stage === 'finished') break;
    if (stage === 'result') {
      await expect(coach).toContainText('Check your island');
      await coach.getByRole('button', { name: 'Next', exact: true }).click();
    } else if (stage === 'opponent' || stage === 'opponent-result') {
      if (stage === 'opponent' && kind === 'load') botLoads.push(actor!);
      // Learners cannot act during an opponent's move.
      await expect(page.locator('.role-hand .role-card:enabled')).toHaveCount(0);
      await coach.getByRole('button', { name: 'Next', exact: true }).click();
    } else if (kind === 'choose-role') {
      const card = page.locator('.role-hand .role-card:enabled');
      await expect(card).toHaveCount(1);
      roleChoices.push((await card.locator('span').textContent())!);
      await card.click();
    } else if (kind === 'allocate-workers' && mobile) {
      // Phones: picking up a worker moves the sheet aside for the board target, then brings it back to confirm.
      const sheet = page.locator('.mobile-sheet-toggle');
      await expect(sheet).toHaveAttribute('aria-expanded', 'true');
      await page.locator('.dock-worker:enabled').first().click();
      await expect(sheet).toHaveAttribute('aria-expanded', 'false');
      await page.waitForTimeout(1000); // Let the guided camera settle before projecting the target.
      const spot = (await sceneTargets(page)).find(t => /^(tile|owned-building):/.test(t.key) && t.actionable)!;
      const canvas = (await page.locator('canvas').boundingBox())!;
      await page.touchscreen.tap(canvas.x + spot.x, canvas.y + spot.y);
      await expect(sheet).toHaveAttribute('aria-expanded', 'true');
      await hand.getByRole('button', { name: 'Confirm assignment' }).click();
    } else if (kind === 'allocate-workers') {
      const keyboard = hand.locator('details');
      if (!await keyboard.evaluate(d => (d as HTMLDetailsElement).open)) await keyboard.locator('summary').click();
      const confirm = hand.getByRole('button', { name: 'Confirm assignment' });
      for (let i = 0; i < 6 && await confirm.isDisabled(); i++) await keyboard.locator('button:enabled').first().click();
      await confirm.click();
    } else {
      if (kind === 'build' && !checkedBuild) {
        await page.waitForFunction(() => (window as unknown as { __sceneTargets?: () => Target[] }).__sceneTargets?.().some(t => t.key === 'building:small-market' && t.actionable));
        const buildings = await sceneTargets(page);
        expect(buildings.find(t => t.key === 'building:small-sugar-mill')!.actionable).toBe(false);
        checkedBuild = true;
      }
      // Only the guided option is offered by the normal hand controls.
      const choices = hand.locator('details');
      if (await choices.count()) await choices.locator('summary').click();
      const options = hand.getByRole('group', { name: 'Available actions' }).getByRole('button');
      await expect(options).toHaveCount(1);
      await options.click();
    }
    await expect(coach).not.toHaveAttribute('data-tutorial-index', index!);
  }
  await expect(coach).toContainText('Ready to play!');
  expect(roleChoices).toEqual(['Planter', 'Craftsman', 'Captain']);
  expect(botLoads).toEqual(['bruno', 'chen']);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /tutorial/i.test(k)))).toEqual([]);
  await page.screenshot({ path: `/tmp/rico-simulated-tutorial-${mobile ? 'mobile' : 'desktop'}.png` });
  await coach.getByRole('link', { name: 'Back to lobby' }).click();
  await expect(page).toHaveURL(/lobby=1/);
  await page.goBack();
  await expect(coach).toHaveAttribute('data-revision', '0');
  await expect(coach).toContainText('Welcome to the table');
  await page.reload(); await expect(coach).toHaveAttribute('data-revision', '0');
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await expect(coach).toHaveAttribute('data-revision', '0');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vibe-rico.settings')!).autoProduce)).toBe(true);
  await context.close();
});
