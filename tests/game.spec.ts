import { test, expect, type Page } from '@playwright/test';
import { W, H, type Brew, type CardId } from '../src/model';
import { plan } from './policy';
async function observe(page: Page, brew: Brew) {
  const a = page.getByTestId('arena');
  return {
    tiles: (await a.getAttribute('data-tiles'))!.split('').map(Number),
    units: JSON.parse((await a.getAttribute('data-units'))!),
    hand: await Promise.all(
      [0, 1, 2, 3].map(
        async (i) =>
          (await page
            .getByTestId(`card-${i}`)
            .getAttribute('data-card')) as CardId,
      ),
    ),
    energy: Number(await page.getByTestId('energy').textContent()),
    brew,
    culture: Number(await a.getAttribute('data-culture')),
  };
}
async function place(
  page: Page,
  index: number,
  x: number,
  y: number,
  touch: boolean,
) {
  const card = page.getByTestId(`card-${index}`);
  if (touch) await card.tap();
  else await card.click();
  const r = await page.getByTestId('arena').boundingBox();
  if (!r) throw Error('No board');
  if (touch)
    await page.touchscreen.tap(
      r.x + (x / W) * r.width,
      r.y + (y / H) * r.height,
    );
  else
    await page.mouse.click(r.x + (x / W) * r.width, r.y + (y / H) * r.height);
}
async function play(page: Page, brew: Brew, touch: boolean) {
  for (let i = 0; i < 90; i++) {
    const status = await page.getByTestId('arena').getAttribute('data-status');
    if (status !== 'playing') {
      expect(['won', 'lost', 'draw']).toContain(status);
      return status;
    }
    const s = await observe(page, brew),
      choice = plan(s);
    if (choice) await place(page, choice.index, choice.p.x, choice.p.y, touch);
    await page.clock.runFor(1000);
  }
  throw Error('Match never finished');
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-07T00:00:01Z'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '対戦開始' })).toBeVisible();
});
for (const brew of ['sokujo', 'kimoto'] as Brew[]) {
  test(`${brew}: deploy, territory win, record, seeded rematch`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://127.0.0.1:4188')) external.push(r.url());
    });
    await page
      .getByRole('button', { name: brew === 'sokujo' ? /速醸型/ : /生酛型/ })
      .click();
    await page.getByLabel('CPUの強さ').selectOption('practice');
    if (brew === 'sokujo')
      await page.screenshot({
        path: `docs/screenshots/${info.project.name}-ready.png`,
        fullPage: true,
      });
    await page.getByRole('button', { name: '対戦開始' }).click();
    await page.clock.runFor(100);
    await expect(page.getByTestId('arena')).toHaveAttribute(
      'data-defense',
      brew === 'sokujo' ? '0.1' : '0',
    );
    const touch = info.project.name.startsWith('mobile');
    const first = plan(await observe(page, brew))!;
    await place(page, first.index, first.p.x, first.p.y, touch);
    await page.clock.runFor(3500);
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-${brew}-playing.png`,
      fullPage: false,
    });
    expect(await page.getByTestId('arena').getAttribute('data-units')).not.toBe(
      '[]',
    );
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    const time = await page.getByTestId('time').textContent();
    await page.clock.runFor(5000);
    await expect(page.getByTestId('time')).toHaveText(time!);
    await page.getByRole('button', { name: '対戦を再開' }).click();
    const result = await play(page, brew, touch);
    expect(result).toBe('won');
    if (brew === 'kimoto')
      await expect(page.getByTestId('arena')).toHaveAttribute(
        'data-defense',
        '0.35',
      );
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-${brew}-win.png`,
      fullPage: true,
    });
    const best = await page.getByTestId(`best-${brew}`).textContent();
    expect(best).not.toBe('0');
    await page.getByRole('button', { name: '同じ条件で再戦' }).click();
    await expect(page.getByTestId('arena')).toHaveAttribute(
      'data-status',
      'playing',
    );
    await expect(page.getByTestId('share')).toHaveText('50.0%');
    await page.reload();
    await expect(page.getByTestId(`best-${brew}`)).toHaveText(best!);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
test('keyboard deployment, illegal placement, defeat and change setup', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: '対戦開始' }).click();
  await page.clock.runFor(100);
  await place(page, 0, 3, 3, info.project.name.startsWith('mobile'));
  await expect(page.getByText('自分の色の床に配置してください')).toBeVisible();
  await expect(page.getByTestId('energy')).toHaveText('8');
  await page.keyboard.press('1');
  for (let i = 0; i < 23; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.clock.runFor(100);
  await expect(page.getByTestId('card-0')).toHaveAttribute('data-card', 'koji');
  await page.clock.runFor(76000);
  await expect(page.getByTestId('arena')).toHaveAttribute(
    'data-status',
    'lost',
  );
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-loss.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '同じ条件で再戦' }).click();
  await expect(page.getByTestId('arena')).toHaveAttribute(
    'data-status',
    'playing',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '対戦を再開' })).toBeFocused();
  await page.getByRole('button', { name: 'この対戦をやめる' }).click();
  await page.getByLabel('手札構成').selectOption('rush');
  await expect(page.getByTestId('card-0')).toHaveAttribute(
    'data-card',
    'yeast',
  );
  await expect(page.getByTestId('card-1')).toHaveAttribute(
    'data-card',
    'yeast',
  );
});
test('automatic pause, reduced motion, corrupt storage, rules and new course', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() =>
    localStorage.setItem('sat-sake-clash:v1', '{broken'),
  );
  await page.reload();
  await expect(page.getByTestId('best-sokujo')).toHaveText('0');
  await page.getByRole('button', { name: '対戦開始' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('arena')).toHaveAttribute(
    'data-status',
    'paused',
  );
  await page.getByRole('button', { name: '対戦を再開' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('arena')).toHaveAttribute(
    'data-status',
    'paused',
  );
  await page.evaluate(() =>
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    }),
  );
  await page.getByRole('button', { name: '対戦を再開' }).click();
  await page.getByText('6枚のカードと相性').click();
  await page.getByText('勝敗・補給・配置ルール').click();
  await page.getByText('速醸・生酛の出典とゲームの境界').click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.clock.runFor(100);
  await expect(page.getByTestId('arena')).toHaveAttribute(
    'data-status',
    'paused',
  );
  await expect(page.getByText('出典で確認：', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '対戦を再開' }).click();
  await page.clock.runFor(76000);
  await page.getByRole('button', { name: '仕込み・手札を変える' }).click();
  await expect(page.getByTestId('arena')).toHaveAttribute(
    'data-status',
    'ready',
  );
  await expect(page.getByLabel('コース番号')).toHaveValue('260908');
});
test('drag a card onto the board', async ({ page }) => {
  await page.getByRole('button', { name: '対戦開始' }).click();
  const a = await page.getByTestId('arena').boundingBox(),
    c = await page.getByTestId('card-0').boundingBox();
  if (!a || !c) throw Error('Missing surface');
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width * 0.4, a.y + a.height * 0.7, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(page.getByTestId('card-0')).toHaveAttribute('data-card', 'koji');
});
