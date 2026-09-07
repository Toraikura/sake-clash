import { createHash } from 'node:crypto';
import { createMatch, start, deploy, step, type Brew, type Deck, type Difficulty } from '../src/model';
import { plan } from './policy';
export type Scenario = { brew: Brew; deck: Deck; difficulty: Difficulty; seed: number };
export function mechanicsTrace(s: Scenario) {
  const g = createMatch(s.difficulty, s.deck, s.seed, s.brew);
  const hash = createHash('sha256');
  start(g);
  for (let tick = 0; tick < 2250; tick++) {
    if (tick % 30 === 0) {
      const choice = plan({ ...g });
      if (choice) deploy(g, choice.index, choice.p.x, choice.p.y);
    }
    step(g);
    if (tick % 30 === 0 || tick === 2249) hash.update(JSON.stringify(g));
  }
  return hash.digest('hex');
}
