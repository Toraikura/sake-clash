import { test, expect, type Page, type CDPSession } from '@playwright/test';
type Touch = { x: number; y: number; id?: number };
async function touch(c: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: Touch[]) {
  await c.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ ...p, id: p.id ?? i, radiusX: 7, radiusY: 7 })) });
}
async function field(page: Page, x = .4, y = .75) {
  const r = await page.getByTestId('arena').boundingBox(); if (!r) throw Error('No arena');
  return { x: r.x + r.width * x, y: r.y + r.height * y };
}
async function launch(page: Page) {
  await page.getByRole('button', { name: '対戦開始' }).click(); await page.clock.runFor(150);
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-07T00:00:01Z'));
  await page.goto('/');
});
test('whole board, hand and controls fit; scroll and safe-area stress', async ({ page }) => {
  await launch(page);
  for (const selector of ['.arena', '.hand', '.supply', '.culture', '.pause', '.cancel']) {
    const r = await page.locator(selector).boundingBox();
    const viewport = page.viewportSize()!; expect(r).not.toBeNull();
    expect(r!.x).toBeGreaterThanOrEqual(0); expect(r!.y).toBeGreaterThanOrEqual(0);
    expect(r!.x + r!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(r!.y + r!.height).toBeLessThanOrEqual(viewport.height + 1);
  }
  for (const locator of [page.locator('.pause'), page.locator('.cancel'), ...[0, 1, 2, 3].map((i) => page.getByTestId(`card-${i}`))]) {
    const r = (await locator.boundingBox())!; expect(r.width).toBeGreaterThanOrEqual(44); expect(r.height).toBeGreaterThanOrEqual(44);
  }
  await page.evaluate(() => { window.scrollTo(0, 9999); document.documentElement.style.setProperty('--safe-top', '47px'); document.documentElement.style.setProperty('--safe-bottom', '34px'); });
  await page.clock.runFor(100);
  const hand = (await page.locator('.hand').boundingBox())!;
  expect(hand.y + hand.height).toBeLessThan(page.viewportSize()!.height - 34);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-status', 'playing');
});
test('touch down previews; move adjusts; release deploys exactly once', async ({ page }) => {
  await launch(page); const c = await page.context().newCDPSession(page);
  await page.getByTestId('card-0').click();
  const a = await field(page, .3), b = await field(page, .65);
  await touch(c, 'touchStart', [a]); await page.clock.runFor(100);
  await expect(page.locator('.battle')).toHaveAttribute('data-aiming', 'true');
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '0');
  await expect(page.getByTestId('energy')).toHaveText('8');
  await expect(page.getByTestId('arena')).toHaveAttribute('data-preview-valid', 'true');
  await touch(c, 'touchMove', [b]); await page.clock.runFor(50);
  await page.screenshot({ path: `test-results/touch-preview-${page.viewportSize()!.width}x${page.viewportSize()!.height}.png` });
  await touch(c, 'touchEnd', []); await page.clock.runFor(50);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '1');
  await expect(page.getByTestId('card-0')).toHaveAttribute('data-card', 'koji');
  await expect(page.getByTestId('card-0')).toHaveAttribute('aria-pressed', 'false');
  const units = JSON.parse((await page.getByTestId('arena').getAttribute('data-units'))!);
  expect(units[0].x).toBeCloseTo(24 * .65, 1);
});
test('native touch drag works; dropping outside cancels', async ({ page }) => {
  await launch(page); const c = await page.context().newCDPSession(page);
  const r = (await page.getByTestId('card-0').boundingBox())!, p = await field(page);
  await touch(c, 'touchStart', [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }]);
  await touch(c, 'touchMove', [p]); await touch(c, 'touchMove', [{ x: 1, y: 1 }]);
  await touch(c, 'touchEnd', []); await page.clock.runFor(50);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '0');
  await touch(c, 'touchStart', [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }]);
  await touch(c, 'touchMove', [p]); await touch(c, 'touchEnd', []); await page.clock.runFor(50);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '1');
});
test('touch cancel and two fingers cannot deploy', async ({ page }) => {
  await launch(page); const c = await page.context().newCDPSession(page), p = await field(page);
  await page.getByTestId('card-0').click(); await touch(c, 'touchStart', [p]); await touch(c, 'touchCancel', []);
  await page.clock.runFor(50); await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '0');
  await page.getByTestId('card-0').click(); await touch(c, 'touchStart', [{ ...p, id: 0 }]);
  await touch(c, 'touchStart', [{ ...p, id: 0 }, { x: p.x + 25, y: p.y, id: 1 }]);
  await touch(c, 'touchEnd', []); await page.clock.runFor(50);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '0');
  await expect(page.locator('.battle')).toHaveAttribute('data-aiming', 'false');
});
test('invalid terrain is free; affordability is checked again at release', async ({ page }) => {
  await launch(page); const c = await page.context().newCDPSession(page);
  await page.getByTestId('card-0').click(); await touch(c, 'touchStart', [await field(page, .3, .2)]); await touch(c, 'touchEnd', []); await page.clock.runFor(50);
  await expect(page.getByText('自分の色の床に配置してください', { exact: true })).toBeVisible();
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '0');
  await touch(c, 'touchStart', [await field(page, .3)]); await touch(c, 'touchEnd', []); await page.clock.runFor(350);
  await page.getByTestId('card-0').click(); await touch(c, 'touchStart', [await field(page, .75, .88)]); await page.clock.runFor(50);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '1');
  await expect(page.getByTestId('arena')).toHaveAttribute('data-preview-valid', 'false');
  await page.clock.runFor(1800); await touch(c, 'touchEnd', []); await page.clock.runFor(50);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '2');
});
test('resizing or switching the selected card cancels a held deployment', async ({ page }) => {
  await launch(page); const c = await page.context().newCDPSession(page);
  await page.getByTestId('card-0').click(); await touch(c, 'touchStart', [await field(page)]);
  const size = page.viewportSize()!; await page.setViewportSize({ ...size, height: size.height - 60 });
  await page.clock.runFor(100); await touch(c, 'touchEnd', []);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '0');
  await page.getByTestId('card-0').click(); await touch(c, 'touchStart', [await field(page)]);
  await page.keyboard.press('2'); await touch(c, 'touchEnd', []); await page.clock.runFor(50);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '0');
});
test('blur cancels the finger and pauses all progression until explicit resume', async ({ page }) => {
  await launch(page); const c = await page.context().newCDPSession(page);
  await page.getByTestId('card-0').click(); await touch(c, 'touchStart', [await field(page)]);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.clock.runFor(50);
  const time = await page.getByTestId('time').textContent(), energy = await page.getByTestId('energy').textContent();
  await page.clock.runFor(5000);
  await expect(page.getByTestId('time')).toHaveText(time!); await expect(page.getByTestId('energy')).toHaveText(energy!);
  await expect(page.getByRole('button', { name: '対戦を再開' })).toBeFocused();
  await touch(c, 'touchEnd', []); await page.getByRole('button', { name: '対戦を再開' }).click(); await page.clock.runFor(50);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-status', 'playing');
  await expect(page.getByTestId('arena')).toHaveAttribute('data-played', '0');
});
test('review records are isolated and result offers an immediately reachable rematch', async ({ page }) => {
  const original = JSON.stringify({ version: 1, runs: 20, wins: 10, best: { sokujo: 9999, kimoto: 8888 }, badges: ['初勝利'] });
  await page.evaluate((v) => localStorage.setItem('sat-sake-clash:v1', v), original);
  await page.goto('/?review=1'); await launch(page); await page.clock.runFor(76000);
  await expect(page.getByText('紅の蔵の勝ち。', { exact: true })).toBeVisible();
  const r = (await page.getByRole('button', { name: '同じ条件で再戦' }).boundingBox())!;
  expect(r.y + r.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await page.evaluate(() => localStorage.getItem('sat-sake-clash:v1'))).toBe(original);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('sat-sake-clash:v1:iphone-review')))! ).runs).toBe(1);
  await page.getByRole('button', { name: '同じ条件で再戦' }).click(); await page.clock.runFor(100);
  await expect(page.getByTestId('arena')).toHaveAttribute('data-status', 'playing');
  await expect(page.getByTestId('time')).toHaveText('75');
  await page.reload(); await expect(page.getByTestId('wins')).toContainText('/ 1');
});
