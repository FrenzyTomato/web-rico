import { expect, test } from '@playwright/test';

test('demo opens without room credentials and stays offline and view-only', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/socket.io')) requests.push(request.url()); });
  await page.goto('/?demo=1');
  await expect(page.locator('.topbar-meta').getByText('Demo · View only', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Explore the board, islands and tooltips. Gameplay actions are disabled in this demo.')).toBeVisible();
  await expect(page.locator('.actions button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check his island' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Check his island' }).first().click();
  await expect(page.locator('.shell')).toHaveAttribute('data-revision', '185');
  expect(requests).toEqual([]);
  await expect(page.getByRole('link', { name: 'Back to lobby' })).toHaveAttribute('href', '/?lobby=1');
});
