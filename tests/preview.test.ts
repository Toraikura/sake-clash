import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createMatch, start, deploy, updateUnits, AREAS, W, H, CARDS, type CardId } from '../src/model';
import { preview, ray } from '../src/preview';
import { mechanicsTrace, type Scenario } from './mechanics-trace';
const baseline = JSON.parse(readFileSync(new URL('./fixtures/mechanics-v1.json', import.meta.url), 'utf8')) as { scenarios: (Scenario & { sha256: string })[] };
describe('unchanged published mechanics', () => {
  for (const s of baseline.scenarios) it(`${s.brew}/${s.deck}/${s.difficulty}/${s.seed}`, () => {
    expect(mechanicsTrace(s)).toBe(s.sha256);
  });
});
describe('initial-action preview uses the live model on a clone', () => {
  for (const kind of Object.keys(CARDS) as CardId[]) it(`${kind}: no side effects and matching first action`, () => {
    const g = createMatch(); start(g); g.hand[0] = kind; g.energy = 10;
    const before = structuredClone(g), p = { x: 12, y: 24 };
    const info = preview(g, 0, p);
    expect(g).toEqual(before); expect(info.error).toBeNull();
    const actual = structuredClone(g); deploy(actual, 0, p.x, p.y);
    const origins = actual.units.map((u) => ({ x: u.x, y: u.y }));
    for (let i = 0; i < 4; i++) { actual.tick++; updateUnits(actual); }
    expect(info.shots).toEqual(actual.shots);
    expect(info.units.map((u) => ({ x: u.x, y: u.y }))).toEqual(origins);
    if (kind === 'awa') { expect(info.shots).toHaveLength(7); expect(info.shots.every((b) => Math.abs(b.vx) < 1e-8 && b.vy < 0)).toBe(true); }
    if (kind === 'yeast') { expect(info.units).toHaveLength(3); expect(info.moves).toHaveLength(3); }
    if (kind === 'koji') expect(info.shots).toHaveLength(4);
  });
  it('rejects invalid preview without consuming energy or changing RNG', () => {
    const g = createMatch(); start(g); const before = structuredClone(g);
    expect(preview(g, 0, { x: 5, y: 5 }).error).toContain('自分の色');
    expect(g).toEqual(before);
  });
  it('does not invent bullets beyond the shared shot cap', () => {
    const g = createMatch(); start(g); g.hand[0] = 'awa';
    g.shots = Array.from({ length: 190 }, (_, i) => ({ id: i + 1, x: 2, y: 2, side: 2, vx: 0, vy: 1, life: 1, damage: 1, radius: .5, bounces: 0 }));
    g.serial = 190;
    expect(preview(g, 0, { x: 12, y: 24 }).shots).toHaveLength(0);
  });
  it('uses separate paint, damage and support radii', () => {
    expect(AREAS.kaiPaint).toBe(3); expect(AREAS.kaiDamage).toBe(3.4); expect(AREAS.support).toBe(3.1);
  });
  it('draws at most the first wall bounce and stays on the board', () => {
    const g = createMatch(); start(g); const b = preview(g, 0, { x: 2, y: 20 }).shots[0];
    const path = ray(b);
    expect(path.length).toBeLessThanOrEqual(3);
    expect(path.every((p) => p.x >= AREAS.wall - 1e-6 && p.x <= W - AREAS.wall + 1e-6 && p.y >= AREAS.wall - 1e-6 && p.y <= H - AREAS.wall + 1e-6)).toBe(true);
  });
});
