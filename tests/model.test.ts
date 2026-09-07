import { describe, it, expect } from 'vitest';
import {
  W,
  H,
  DT,
  CARDS,
  createMatch,
  start,
  deploy,
  canPlace,
  paint,
  share,
  step,
  pause,
  resume,
  defense,
  score,
  type Match,
  type Brew,
} from '../src/model';
import { empty, read, record, save } from '../src/storage';
import { plan } from './policy';
function advance(g: Match, seconds: number) {
  for (let i = 0; i < seconds / DT; i++) step(g);
}
function play(brew: Brew, seed = 260907) {
  const g = createMatch('practice', 'balanced', seed, brew);
  start(g);
  for (let i = 0; i < 75 / DT; i++) {
    if (i % 30 === 0) {
      const p = plan({
        tiles: g.tiles,
        units: g.units,
        hand: g.hand,
        energy: g.energy,
        brew: g.brew,
        culture: g.culture,
      });
      if (p) deploy(g, p.index, p.p.x, p.p.y);
    }
    step(g);
  }
  return g;
}
describe('territory and deck rules', () => {
  it('starts with equal terrain, 4 cards and 2 queued cards', () => {
    const g = createMatch();
    expect(g.counts).toEqual([(W * H) / 2, (W * H) / 2]);
    expect(share(g)).toBe(50);
    expect(g.hand.length).toBe(4);
    expect(g.queue.length).toBe(2);
  });
  it('rejects enemy terrain, bad coordinates and empty energy without consuming a card', () => {
    const g = createMatch();
    start(g);
    const hand = [...g.hand],
      energy = g.energy;
    expect(deploy(g, 0, 4, 2)).toBe(false);
    expect(deploy(g, 0, NaN, 20)).toBe(false);
    expect(deploy(g, 6, 4, 20)).toBe(false);
    expect(g.hand).toEqual(hand);
    expect(g.energy).toBe(energy);
    g.energy = 0;
    expect(deploy(g, 0, 4, 20)).toBe(false);
  });
  it('spends costs and cycles exactly one card after a placement', () => {
    const g = createMatch();
    start(g);
    expect(deploy(g, 0, 5, 25)).toBe(true);
    expect(g.energy).toBe(4);
    expect(g.units[0].kind).toBe('tokkuri');
    expect(g.hand[0]).toBe('koji');
    expect(g.queue).toEqual(['awa', 'tokkuri']);
    expect(g.played).toBe(1);
    expect(deploy(g, 0, 9, 25)).toBe(false);
  });
  it('allows kai on enemy territory and paints the visible area', () => {
    const g = createMatch();
    start(g);
    expect(deploy(g, 3, 6, 6)).toBe(true);
    expect(share(g)).toBeGreaterThan(50);
    expect(g.counts[0] + g.counts[1]).toBe(W * H);
  });
  it('preserves tile counts through arbitrary edge and mixed-color painting', () => {
    const g = createMatch();
    for (let i = 0; i < 80; i++) {
      paint(g, { x: i % W, y: (i * 3) % H }, 3, i % 2 ? 1 : 2);
      expect(g.tiles.filter((x) => x === 1).length).toBe(g.counts[0]);
      expect(g.tiles.filter((x) => x === 2).length).toBe(g.counts[1]);
    }
    expect(g.tiles.every((x) => x === 1 || x === 2)).toBe(true);
  });
  it('moves units and projectiles, lets turrets paint and damages opponents', () => {
    const g = createMatch('practice');
    start(g);
    deploy(g, 0, 6, 18);
    g.enemyEnergy = 10;
    deploy(g, 1, 6, 15, 2);
    const initial = share(g);
    advance(g, 4);
    expect(g.tick).toBeGreaterThan(100);
    expect(share(g)).not.toBe(initial);
    expect(g.shots.length).toBeGreaterThan(0);
    expect(g.units.some((u) => u.hp < u.maxHp) || g.destroyed > 0).toBe(true);
  });
  it('stops completely on pause and after results', () => {
    const g = createMatch();
    start(g);
    pause(g);
    const copy = structuredClone(g);
    advance(g, 6);
    expect(g).toEqual(copy);
    resume(g);
    expect(g.status).toBe('playing');
    g.status = 'won';
    const done = structuredClone(g);
    advance(g, 6);
    expect(g).toEqual(done);
  });
  it('honors each card cost and rejects overlaps', () => {
    for (const [id, c] of Object.entries(CARDS)) {
      const g = createMatch();
      start(g);
      g.hand[0] = id as keyof typeof CARDS;
      g.energy = c.cost;
      expect(deploy(g, 0, 7, 23)).toBe(true);
      expect(g.energy).toBe(0);
    }
    const g = createMatch();
    start(g);
    deploy(g, 0, 7, 23);
    advance(g, 0.4);
    expect(canPlace(g, 2, 7, 23)).toContain('離して');
  });
  it('has a losing outcome when the player does nothing', () => {
    const g = createMatch('standard');
    start(g);
    advance(g, 75);
    expect(g.status).toBe('lost');
    expect(share(g)).toBeLessThan(50);
  });
  it('returns the same result for the same seeded actions', () => {
    expect(play('sokujo')).toEqual(play('sokujo'));
  });
});
describe('brewing style tradeoff (fiction)', () => {
  it('sokujo starts stable while kimoto must develop', () => {
    const s = createMatch('standard', 'balanced', 4, 'sokujo'),
      k = createMatch('standard', 'balanced', 4, 'kimoto');
    expect(s.energy).toBe(8);
    expect(k.energy).toBe(5);
    expect(defense(s, 1)).toBe(0.1);
    expect(defense(k, 1)).toBe(0);
    expect(k.culture).toBe(0);
  });
  it('guarding lactic bases accelerates maturation, destroying them removes that rate', () => {
    const g = createMatch('practice', 'balanced', 8, 'kimoto');
    start(g);
    deploy(g, 2, 4, H - 3);
    advance(g, 5);
    const supported = g.culture;
    g.units = [];
    advance(g, 5);
    expect(supported).toBeGreaterThan(11);
    expect(g.culture - supported).toBeCloseTo(3, 1);
  });
  it('turns completed kimoto into sustained 35% damage reduction', () => {
    const g = createMatch('practice', 'balanced', 8, 'kimoto');
    start(g);
    g.culture = 99.99;
    step(g);
    expect(g.cultureReady).toBe(true);
    expect(defense(g, 1)).toBe(0.35);
    g.units = [];
    advance(g, 1);
    expect(defense(g, 1)).toBe(0.35);
  });
  it('both styles can win using real rules and legal deployments', () => {
    for (const b of ['sokujo', 'kimoto'] as Brew[]) {
      const g = play(b);
      expect({
        brew: b,
        result: g.status,
        share: share(g),
        culture: g.culture,
      }).toMatchObject({ result: 'won' });
      if (b === 'kimoto') expect(g.cultureReady).toBe(true);
      expect(score(g)).toBeGreaterThan(5000);
    }
  });
  it('keeps stats bounded over diverse seeds and strategies', () => {
    for (const seed of [1, 4, 42, 100]) {
      const g = play(seed % 2 ? 'kimoto' : 'sokujo', seed);
      expect(g.counts.reduce((a, b) => a + b)).toBe(W * H);
      expect(g.energy).toBeGreaterThanOrEqual(0);
      expect(g.energy).toBeLessThanOrEqual(10);
      expect(g.culture).toBeLessThanOrEqual(100);
      expect(g.shots.length).toBeLessThanOrEqual(190);
      expect(
        g.units.every(
          (u) =>
            Number.isFinite(u.x) && u.x >= 0 && u.x < W && u.y >= 0 && u.y < H,
        ),
      ).toBe(true);
    }
  });
});
describe('local records', () => {
  it('survives corrupt storage and unavailable writes', () => {
    expect(read({ getItem: () => '{' })).toEqual(empty());
    expect(
      save(
        {
          setItem: () => {
            throw Error();
          },
        },
        empty(),
      ),
    ).toBe(false);
  });
  it('keeps style records independent and does not count unfinished games', () => {
    const g = createMatch();
    expect(record(empty(), g)).toEqual(empty());
    g.status = 'won';
    const r = record(empty(), g);
    expect(r.wins).toBe(1);
    expect(r.best.sokujo).toBeGreaterThan(0);
    expect(r.best.kimoto).toBe(0);
  });
});
