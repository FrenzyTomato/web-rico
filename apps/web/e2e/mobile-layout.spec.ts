import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('mobile demo leaves room for the board and exposes controls on demand', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Viewing', exact: true })).toHaveAttribute('data-value', 'boats');
  await expect(page.locator('.hand-content')).toBeHidden();
  await expect(page.locator('.desktop-camera')).toBeHidden();
  const header = await page.locator('.topbar').boundingBox();
  const footer = await page.locator('.hand').boundingBox();
  expect(header!.height + footer!.height).toBeLessThan(180);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: '/tmp/rico-mobile-collapsed.png' });
  await page.locator('.mobile-sheet-toggle').click();
  await expect(page.locator('.hand-content')).toBeVisible();
  await page.locator('.mobile-sheet-toggle').click();
  await page.getByRole('button', { name: 'Viewing', exact: true }).click();
  await page.locator('.area-picker-options').getByRole('button', { name: "Bruno's island" }).click();
  await expect(page.getByRole('button', { name: 'Viewing', exact: true })).toHaveAttribute('data-value', 'island:bruno');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Back to lobby' }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(page.locator('#player-sidebar')).toBeVisible();
});

test('mobile action sheet opens for an active turn and can be collapsed', async ({ page }) => {
  await page.goto('/scene-preview.html?game=3p&at=185&shell=1');
  await expect(page.locator('.mobile-sheet-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.hand-content')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Viewing', exact: true })).toHaveAttribute('data-value', 'island:chen');
  await page.locator('.mobile-sheet-toggle').click();
  await expect(page.locator('.hand-content')).toBeHidden();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.desktop-camera')).toBeVisible();
  await expect(page.locator('.mobile-camera')).toBeHidden();
});

test('mobile building tiers zoom individually and long presses reveal hints', async ({ page, context }) => {
  await page.route(/\.glb(?:\.gz)?(?:\?.*)?$/, route => route.abort());
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Viewing', exact: true }).click();
  await page.locator('.area-picker-options').getByRole('button', { name: 'Buildings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Max discount: 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Max discount: 3', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Max discount: 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/rico-mobile-tier3.png' });
  const point = await page.evaluate(() => (window as unknown as { __sceneTargets: () => { key: string; x: number; y: number }[] }).__sceneTargets().find(t => t.key === 'building:factory')!);
  const canvas = (await page.locator('canvas').boundingBox())!;
  const client = await context.newCDPSession(page);
  const touch = { x: canvas.x + point.x, y: canvas.y + point.y, id: 1 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await expect(page.getByRole('tooltip')).toBeVisible();
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('tooltip')).toContainText('Factory');
  const hint = (await page.getByRole('tooltip').boundingBox())!;
  const controls = (await page.locator('.board-zoom').boundingBox())!;
  const panel = (await page.locator('.hand').boundingBox())!;
  expect(hint.height).toBe(controls.height);
  expect(hint.y).toBe(controls.y);
  expect(hint.x).toBe(panel.x);
  expect(controls.x + controls.width).toBe(panel.x + panel.width);
  expect(controls.x - hint.x - hint.width).toBe(10);

  await page.getByRole('button', { name: 'Close tooltip' }).click();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...touch, x: touch.x + 50 }] });
  await page.waitForTimeout(600);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('.shell')).toHaveAttribute('data-revision', '185');
});
