import { test, expect } from '@playwright/test';
test('real-time card deployment, moving battle and manual pause', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: '対戦開始' }).click();
  const card = page.getByTestId('card-0');
  if (info.project.name.startsWith('mobile')) await card.tap();
  else await card.click();
  const a = await page.getByTestId('arena').boundingBox();
  if (!a) throw Error('No arena');
  if (info.project.name.startsWith('mobile'))
    await page.touchscreen.tap(a.x + a.width * 0.3, a.y + a.height * 0.65);
  else await page.mouse.click(a.x + a.width * 0.3, a.y + a.height * 0.65);
  await expect(page.getByTestId('card-0')).toHaveAttribute('data-card', 'koji');
  await expect(page.getByTestId('time')).not.toHaveText('75', {
    timeout: 5000,
  });
  await expect(page.getByTestId('share')).not.toHaveText('50.0%', {
    timeout: 6000,
  });
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(page.getByTestId('arena')).toHaveAttribute(
    'data-status',
    'paused',
  );
});
