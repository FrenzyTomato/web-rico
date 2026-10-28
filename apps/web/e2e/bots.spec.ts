import { expect, test } from '@playwright/test';

test('the host fills seats with bots, and bots play their turns', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('vibe-rico.language', 'en'));
  await page.goto('/?lobby=1');
  await page.getByLabel('Display name').fill('Ana');
  await page.getByLabel(/password/i).fill('e2e-room-password');
  await page.getByRole('button', { name: /Create room/ }).click();
  await page.getByLabel('Bots').selectOption('4');
  await expect(page.locator('.lobby-seats li')).toHaveCount(4);
  await expect(page.locator('.lobby-seats')).toContainText('Bot Ana (bot)');
  await page.getByRole('button', { name: 'Remove Bot Caio' }).click();
  await expect(page.locator('.lobby-seats li')).toHaveCount(3);
  // A bot is Governor, so bots move first and the game comes back to the human.
  await request.post('http://127.0.0.1:3000/e2e/next-game', { data: { seed: 3, governor: 1 } });
  // Record each move notice as it appears.
  const notices: string[] = [];
  await page.exposeFunction('recordNotice', (text: string) => { notices.push(text); });
  await page.evaluate(() => new MutationObserver(() => {
    const text = document.querySelector('.move-notice')?.textContent;
    const w = window as unknown as { recordNotice: (t: string) => void; lastNotice?: string };
    if (text && text !== w.lastNotice) { w.lastNotice = text; w.recordNotice(text); }
  }).observe(document.body, { childList: true, subtree: true, characterData: true }));
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('.turn-banner strong')).toHaveText("It's your turn!", { timeout: 30_000 });
  await expect(page.locator('.shell')).not.toHaveAttribute('data-revision', '0');
  await expect(page.getByText('Bot Ana chose')).toBeAttached();
  // Each bot move is announced on the board, one at a time.
  expect(notices.some(n => n.startsWith('Bot Ana chose'))).toBe(true);
  expect(notices.every(n => !n.startsWith('Ana '))).toBe(true);
});
