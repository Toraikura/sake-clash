import { score, type Match, type Brew } from './model';
export const KEY = 'sat-sake-clash:v1';
export type RecordBook = {
  version: 1;
  runs: number;
  wins: number;
  best: Record<Brew, number>;
  badges: string[];
};
export const empty = (): RecordBook => ({
  version: 1,
  runs: 0,
  wins: 0,
  best: { sokujo: 0, kimoto: 0 },
  badges: [],
});
const number = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n)
    ? Math.min(99999999, Math.max(0, Math.floor(n)))
    : 0;
export const BADGES = ['初勝利', '生酛の守り', '75%制圧', '全種展開'] as const;
export function read(storage: Pick<Storage, 'getItem'>) {
  try {
    const x = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (x?.version !== 1) return empty();
    return {
      version: 1,
      runs: number(x.runs),
      wins: number(x.wins),
      best: { sokujo: number(x.best?.sokujo), kimoto: number(x.best?.kimoto) },
      badges: Array.isArray(x.badges)
        ? ([
            ...new Set(
              x.badges.filter(
                (b: unknown) =>
                  typeof b === 'string' &&
                  (BADGES as readonly string[]).includes(b),
              ),
            ),
          ] as string[])
        : [],
    } as RecordBook;
  } catch {
    return empty();
  }
}
export function record(old: RecordBook, g: Match) {
  if (!['won', 'lost', 'draw'].includes(g.status)) return old;
  const badges = [
    ...(g.status === 'won' ? ['初勝利'] : []),
    ...(g.brew === 'kimoto' && g.cultureReady ? ['生酛の守り'] : []),
    ...(g.peak >= 75 ? ['75%制圧'] : []),
    ...(g.used.length === 6 ? ['全種展開'] : []),
  ];
  return {
    version: 1,
    runs: old.runs + 1,
    wins: old.wins + (g.status === 'won' ? 1 : 0),
    best: { ...old.best, [g.brew]: Math.max(old.best[g.brew], score(g)) },
    badges: [...new Set([...old.badges, ...badges])],
  } as RecordBook;
}
export function save(storage: Pick<Storage, 'setItem'>, r: RecordBook) {
  try {
    storage.setItem(KEY, JSON.stringify(r));
    return true;
  } catch {
    return false;
  }
}
