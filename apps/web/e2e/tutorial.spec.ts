import { expect, test } from '@playwright/test';

for (const mobile of [false, true]) test(`tutorial completes with only intended controls (${mobile ? 'mobile' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('vibe-rico.settings', JSON.stringify({ autoProduce: true })));
  // Geometry hit boxes remain testable without loading every high-resolution model.
  await page.route('**/*.glb', route => route.abort());
  const sockets: string[] = [];
  page.on('websocket', socket => socket.url().includes('/socket.io') && sockets.push(socket.url()));
  page.on('request', request => { if (request.url().includes('/socket.io')) sockets.push(request.url()); });
  await page.goto('/?tutorial=1');
  const actions = page.getByRole('group', { name: 'Tutorial actions' });
  const click = (name: string) => actions.getByRole('button', { name, exact: true }).click();
  const advance = async () => { await expect(page.locator('.tutorial-shell')).toHaveAttribute('data-tutorial-stage', 'result'); await click('Continue'); };
  await click('Planter'); await click('Confirm'); await advance();
  await expect(page.locator('.tutorial-shell')).toHaveAttribute('data-tutorial-step', 'estate');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __sceneTargets?: () => { key: string }[] }).__sceneTargets?.().some(t => t.key === 'building:small-market'));
  // A building is normally visible here but must not select or open an action panel.
  const blocked = await page.evaluate(() => (window as unknown as { __sceneTargets: () => { key: string; x: number; y: number; actionable: boolean }[] }).__sceneTargets().find(t => t.key === 'building:small-market'));
  expect(blocked?.actionable).toBe(false);
  const unwantedEstate = await page.evaluate(() => (window as unknown as { __sceneTargets: () => { key: string; x: number; y: number; actionable: boolean }[] }).__sceneTargets().find(t => t.key.startsWith('estate:') && !t.actionable)!);
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(canvas.x + unwantedEstate.x, canvas.y + unwantedEstate.y);
  await expect(actions.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await click('Corn'); await click('Confirm'); await advance();
  if (mobile) {
    await page.waitForFunction(() => (window as unknown as { __sceneTargets: () => { key: string; actionable: boolean }[] }).__sceneTargets().some(t => t.key === 'building:small-market' && t.actionable));
    const point = await page.evaluate(() => (window as unknown as { __sceneTargets: () => { key: string; x: number; y: number }[] }).__sceneTargets().find(t => t.key === 'building:small-market')!);
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: canvas.x + point.x, y: canvas.y + point.y, id: 1 }] });
    await expect(page.getByRole('tooltip')).toBeVisible();
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(actions.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
    const hint = (await page.getByRole('tooltip').boundingBox())!, zoom = (await page.locator('.board-zoom').boundingBox())!;
    expect(hint.height).toBe(zoom.height);
    await page.getByRole('button', { name: 'Close tooltip' }).click();
    await page.screenshot({ path: '/tmp/rico-tutorial-building-mobile.png' });
  }
  await click('Small Market'); await click('Confirm'); await advance();
  await click('Pick up fruit-estate worker'); await click('Place on Corn');
  await click('Select pool worker'); await click('Place in Small Market');
  await click('Confirm'); await advance();
  await actions.getByRole('button', { name: /^Produce / }).click(); await advance();
  await click('Corn'); await click('Confirm'); await advance();
  await click('Select Corn'); await click('Trading depot'); await advance();
  await click('Select Corn'); await click('Ship corn'); await advance();
  await expect(page.getByRole('heading', { name: 'Ready to play!' })).toBeVisible();
  await page.screenshot({ path: `/tmp/rico-tutorial-${mobile ? 'mobile' : 'desktop'}.png` });
  expect(sockets).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /tutorial/i.test(k)))).toEqual([]);
  await click('Back to lobby');
  await expect(page).toHaveURL(/lobby=1/);
  await page.getByRole('link', { name: 'Learn to play' }).click();
  await expect(page.locator('.tutorial-shell')).toHaveAttribute('data-tutorial-step', 'role');
  await click('Planter'); await click('Confirm'); await advance();
  await page.reload();
  await expect(page.locator('.tutorial-shell')).toHaveAttribute('data-tutorial-step', 'role');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vibe-rico.settings')!).autoProduce)).toBe(true);
  await click('Planter'); await click('Confirm'); await advance();
  await page.getByRole('button', { name: 'Exit tutorial', exact: true }).click();
  await expect(page).toHaveURL(/lobby=1/);
  await page.goBack();
  await expect(page.locator('.tutorial-shell')).toHaveAttribute('data-tutorial-step', 'role');
  // Exercise restored-page handling explicitly as well as normal navigation.
  await click('Planter'); await click('Confirm'); await advance();
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await expect(page.locator('.tutorial-shell')).toHaveAttribute('data-tutorial-step', 'role');
  await context.close();
});
