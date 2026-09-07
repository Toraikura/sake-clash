import { CARDS, W, H, type CardId, type Brew, type Point } from '../src/model';
export type Observation = {
  tiles: number[];
  units: { x: number; y: number; side: number; kind: string }[];
  hand: CardId[];
  energy: number;
  brew: Brew;
  culture: number;
};
/** Test player uses only the visible board, hand and meters. No hidden game state. */
export function plan(s: Observation): { index: number; p: Point } | null {
  const ours = s.units.filter((u) => u.side === 1),
    foes = s.units.filter((u) => u.side === 2);
  const available = s.hand
    .map((kind, index) => ({ kind, index }))
    .filter((c) => CARDS[c.kind].cost <= s.energy);
  if (!available.length) return null;
  let selected =
    available.find((c) => c.kind === 'tokkuri') ??
    available.find((c) => c.kind === 'koji') ??
    available.find((c) => c.kind === 'yeast') ??
    available[0];
  if (
    s.brew === 'kimoto' &&
    s.culture < 100 &&
    ours.filter((u) => u.kind === 'sugidama').length < 2
  )
    selected = available.find((c) => c.kind === 'sugidama') ?? selected;
  if (foes.length > 3)
    selected = available.find((c) => c.kind === 'kai') ?? selected;
  let best: Point | null = null,
    bestScore = -Infinity;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = { x: x + 0.5, y: y + 0.5 };
      if (selected.kind !== 'kai' && s.tiles[y * W + x] !== 1) continue;
      if (
        CARDS[selected.kind].hp &&
        ours.concat(foes).some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 1.5)
      )
        continue;
      let value = 0;
      if (selected.kind === 'kai') {
        value +=
          foes.filter((u) => Math.hypot(u.x - p.x, u.y - p.y) < 3).length * 15;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            if (
              x + dx >= 0 &&
              x + dx < W &&
              y + dy >= 0 &&
              y + dy < H &&
              s.tiles[(y + dy) * W + x + dx] === 2
            )
              value++;
      } else if (
        selected.kind === 'sugidama' &&
        s.brew === 'kimoto' &&
        s.culture < 100
      ) {
        value =
          -Math.abs(y - (H - 4)) -
          Math.abs(
            x - (ours.some((u) => u.kind === 'sugidama') ? W * 0.72 : W * 0.28),
          ) *
            0.2;
      } else {
        value = (H - y) * 0.6 - Math.abs(x - W / 2) * 0.025;
        if (selected.kind === 'tokkuri' || selected.kind === 'koji')
          value -=
            foes.filter((u) => Math.hypot(u.x - p.x, u.y - p.y) < 5).length * 3;
        const close = ours.filter(
          (u) => Math.hypot(u.x - p.x, u.y - p.y) < 4,
        ).length;
        value -= close * 1.5;
      }
      if (value > bestScore) {
        best = p;
        bestScore = value;
      }
    }
  return best ? { index: selected.index, p: best } : null;
}
