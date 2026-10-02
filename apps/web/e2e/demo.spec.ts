import { expect, test } from '@playwright/test';

test('demo opens without room credentials and stays offline and view-only', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/socket.io')) requests.push(request.url()); });
  await page.goto('/?demo=1');
  await expect(page.getByText('演示 · 仅供浏览', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('探索棋盘、岛屿和提示；演示中无法进行游戏操作。')).toBeVisible();
  await expect(page.locator('.actions button')).toHaveCount(0);
  await page.getByRole('button', { name: '玩家', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看他的岛屿' })).toHaveCount(2);
  await page.getByRole('button', { name: '查看他的岛屿' }).first().click();
  await expect(page.locator('.shell')).toHaveAttribute('data-revision', '185');
  expect(requests).toEqual([]);
  await expect(page.getByRole('link', { name: '返回大厅' })).toHaveAttribute('href', '/?lobby=1');
});
