import { expect, test } from '@playwright/test';

test('the host fills seats with bots, and bots play their turns', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('vibe-rico.language', 'en'));
  await page.goto('/?lobby=1');
  await page.getByLabel('Display name').fill('Ana');
  await page.getByLabel(/password/i).fill('e2e-room-password');
  await page.getByRole('button', { name: /Create room/ }).click();
  await page.getByRole('button', { name: 'Fill to 3 players with bots' }).click();
  await expect(page.locator('.lobby-seats li')).toHaveCount(3);
  await expect(page.locator('.lobby-seats')).toContainText('Bot Ana (bot)');
  await page.getByRole('button', { name: 'Add bot' }).click();
  await expect(page.locator('.lobby-seats li')).toHaveCount(4);
  await page.getByRole('button', { name: 'Remove Bot Bea' }).click();
  await expect(page.locator('.lobby-seats li')).toHaveCount(3);
  // A bot is Governor, so bots move first and the game comes back to the human.
  await request.post('http://127.0.0.1:3000/e2e/next-game', { data: { seed: 3, governor: 1 } });
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('strong.your-turn')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.shell')).not.toHaveAttribute('data-revision', '0');
  await expect(page.getByText('Bot Ana chose')).toBeAttached();
});
