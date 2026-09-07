import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BREWS, CARDS, DECKS, LEVELS, W, H, DT, DURATION, createMatch, start, pause, resume, share, score, medal, defense, step, canPlace, type Match, type Brew, type Deck, type Difficulty } from './model';
import { draw } from './render';
import { CardGlyph, ROLE } from './art';
import { usePlacement } from './usePlacement';
import { Reference } from './Reference';
import { read, save, record, empty, type RecordBook } from './storage';
import './style.css';
const reviewMode = import.meta.env.VITE_REVIEW === 'true' || new URLSearchParams(location.search).get('review') === '1';
const reviewKey = (key: string) => reviewMode ? `${key}:iphone-review` : key;
const recordStorage = {
  getItem: (key: string) => localStorage.getItem(reviewKey(key)),
  setItem: (key: string, value: string) => localStorage.setItem(reviewKey(key), value),
};
function App() {
  const match = useRef<Match>(createMatch()), canvas = useRef<HTMLCanvasElement>(null);
  const slot = useRef<HTMLDivElement>(null), arena = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const action = useRef<HTMLButtonElement>(null), stored = useRef(false), returnScroll = useRef(0);
  const [g, setG] = useState({ ...match.current });
  const [brew, setBrew] = useState<Brew>('sokujo'), [deck, setDeck] = useState<Deck>('balanced');
  const [difficulty, setDifficulty] = useState<Difficulty>('standard'), [seed, setSeed] = useState('260907');
  const [book, setBook] = useState<RecordBook>(empty), [pauseNote, setPauseNote] = useState('');
  const [notice, setNotice] = useState(reviewMode ? '改良版プレビュー：記録は現行版と分離' : '記録はこのブラウザだけに保存');
  const [announce, setAnnounce] = useState('');
  const update = () => setG({ ...match.current });
  const session = g.status !== 'ready', active = session, terminal = ['won', 'lost', 'draw'].includes(g.status);
  function pauseToggle() {
    input.cancel();
    if (match.current.status === 'playing') { pause(match.current); setPauseNote(''); }
    else if (match.current.status === 'paused') resume(match.current);
    update();
  }
  const input = usePlacement(match, canvas, update, pauseToggle);
  const inputRef = useRef(input); inputRef.current = input;
  useEffect(() => { try { setBook(read(recordStorage)); } catch { setNotice('保存は利用できません。プレイは続けられます。'); } }, []);
  useLayoutEffect(() => {
    if (!session) return;
    const body = document.body, previous = body.style.cssText;
    body.style.overflow = 'hidden'; body.style.position = 'fixed'; body.style.width = '100%'; body.style.top = `-${returnScroll.current}px`;
    return () => { body.style.cssText = previous; window.scrollTo(0, returnScroll.current); };
  }, [session]);
  useLayoutEffect(() => {
    const fit = () => {
      if (!slot.current || !arena.current) return;
      const { width, height } = slot.current.getBoundingClientRect();
      if (!width || !height) return;
      const w = Math.min(width, height * W / H);
      arena.current.style.width = `${w}px`; arena.current.style.height = `${w * H / W}px`;
    };
    fit(); const observer = new ResizeObserver(fit);
    if (slot.current) observer.observe(slot.current);
    return () => observer.disconnect();
  }, [session]);
  useEffect(() => {
    let raf = 0, last = 0, acc = 0, paint = 0, previousStatus = match.current.status;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const loop = (now: number) => {
      const m = match.current, before = m.status;
      if (last && before === 'playing' && previousStatus === 'playing') acc += Math.min(.1, (now - last) / 1000);
      else acc = 0;
      last = now;
      while (acc >= DT) { step(m); acc -= DT; }
      previousStatus = m.status;
      const i = inputRef.current;
      if (canvas.current && m.status !== 'ready') draw(canvas.current, m, i.cursor.current, i.selected.current?.index ?? null, media.matches, i.aiming && i.touch);
      if ((m.status === 'playing' && now - paint > 100) || before !== m.status) { setG({ ...m }); paint = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  useLayoutEffect(() => {
    if (modal.current && !modal.current.open) modal.current.showModal();
  }, [g.status]);
  useEffect(() => {
    if (terminal && !stored.current) {
      stored.current = true;
      setBook((old) => {
        const next = record(old, match.current);
        if (!save(recordStorage, next)) setNotice('保存できませんでした。結果は画面で確認できます。');
        return next;
      });
    }
    if (g.status !== 'playing') { inputRef.current.cancel(); action.current?.focus({ preventScroll: true }); }
    setAnnounce(g.status === 'won' ? '勝利！' : g.status === 'lost' ? '紅の蔵の勝ち。もう一度挑戦できます。' : g.status === 'paused' ? '一時停止しました。' : '');
  }, [g.status, terminal]);
  useEffect(() => {
    if (!session) return;
    const stop = (reason: string) => {
      inputRef.current.cancel();
      if (match.current.status === 'playing') { pause(match.current); setPauseNote(reason); update(); }
    };
    const visibility = () => { if (document.hidden) stop('画面が非表示になったため停止しました。'); };
    const blur = () => stop('画面から離れたため停止しました。');
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) stop('盤面が画面外になったため停止しました。'); });
    if (canvas.current) observer.observe(canvas.current);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', blur); window.addEventListener('pagehide', blur);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', blur); };
  }, [session]);
  function launch(same = false) {
    if (!session) returnScroll.current = window.scrollY;
    match.current = createMatch(same ? g.difficulty : difficulty, same ? g.deck : deck, same ? g.seed : Number(seed), same ? g.brew : brew);
    stored.current = false; input.resetCursor(); setPauseNote(''); start(match.current); update();
  }
  function reset(nextCourse = false) {
    const n = nextCourse ? g.seed + 1 : Number(seed);
    if (nextCourse) setSeed(String(n));
    input.resetCursor(); match.current = createMatch(difficulty, deck, n, brew); update();
  }
  const percentage = share(g), selectedKind = input.index === null ? null : g.hand[input.index];
  const placementError = input.cursor.current && input.index !== null ? canPlace(g, input.index, input.cursor.current.x, input.cursor.current.y) : null;
  return <>
    <div className="site" hidden={session}>
      <header className="brand"><b className="logo">SAT</b><span>SAKE ART TOKYO<small>PLAY EXPERIMENT / 02</small></span><span className="local-label">LOCAL / CPU BATTLE</span></header>
      <main id="main">
        <div className="headline"><p className="eyebrow">手札を切れ。酒蔵の色を広げろ。</p><h1>SAKE <span>CLASH</span></h1><p>75秒の、塗り合戦。</p></div>
        {reviewMode && <p className="review-label">改良版プレビュー · 現行版の記録は変更しません</p>}
        <button ref={!session ? action : undefined} className="primary start-button" onClick={() => launch()}>対戦開始 <span>→</span></button>
        <p className="intro">① 手札を選ぶ　② 緑の床に触れて、離す</p>
          <section className="setup" aria-label="対戦設定">
            <p className="section-label">01 / YOUR BREWERY</p>
            <h2>どう仕込んで、どう攻める？</h2>
            <fieldset className="brew-choice">
              <legend>
                仕込み型を選ぶ <small>ゲーム専用の特性</small>
              </legend>
              {(['sokujo', 'kimoto'] as Brew[]).map((b) => (
                <button
                  key={b}
                  disabled={active}
                  aria-pressed={brew === b}
                  onClick={() => {
                    setBrew(b);
                    match.current = createMatch(
                      difficulty,
                      deck,
                      Number(seed),
                      b,
                    );
                    update();
                  }}
                >
                  <span className="brew-glyph">
                    {b === 'sokujo' ? '速' : '生'}
                  </span>
                  <span>
                    <b>{BREWS[b].name}</b>
                    <small>{BREWS[b].tag}</small>
                  </span>
                  <i>{brew === b ? '●' : '○'}</i>
                </button>
              ))}
            </fieldset>
            <p className="brew-description">{BREWS[brew].description}</p>
            <div className="select-row">
              <label>
                手札構成
                <select
                  aria-label="手札構成"
                  value={deck}
                  disabled={active}
                  onChange={(e) => {
                    const d = e.target.value as Deck;
                    setDeck(d);
                    match.current = createMatch(
                      difficulty,
                      d,
                      Number(seed),
                      brew,
                    );
                    update();
                  }}
                >
                  {Object.entries(DECKS).map(([d, v]) => (
                    <option key={d} value={d}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                CPUの強さ
                <select
                  aria-label="CPUの強さ"
                  value={difficulty}
                  disabled={active}
                  onChange={(e) => {
                    const d = e.target.value as Difficulty;
                    setDifficulty(d);
                    match.current = createMatch(d, deck, Number(seed), brew);
                    update();
                  }}
                >
                  {Object.entries(LEVELS).map(([d, v]) => (
                    <option key={d} value={d}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details className="setup-details">
              <summary>手札・相手・コース番号</summary>
              <p>{DECKS[deck].description}</p>
              <p>{LEVELS[difficulty].description}</p>
              <label>
                コース番号
                <input
                  aria-label="コース番号"
                  type="number"
                  min="1"
                  value={seed}
                  disabled={active}
                  onChange={(e) => setSeed(e.target.value)}
                />
              </label>
              <p>同じ番号・設定で再挑戦できます。対戦相手はCPUです。</p>
            </details>
          </section>
        <Reference book={book} notice={notice} />
      </main>
      <footer><b>SAT / SAKE CLASH</b><span>ローカルCPU戦 · 広告なし · 課金なし</span></footer>
    </div>
    <section className="battle" hidden={!session} aria-label="酒蔵陣取りゲーム" data-aiming={input.aiming}>
      <div className="battle-top" aria-hidden={g.status !== 'playing'}>
        <div className="side-name"><b>● あなた</b><small>{BREWS[g.brew].name}</small></div>
        <div className={`clock ${g.time < 15 ? 'urgent' : ''}`}><small>TIME</small><b data-testid="time">{Math.ceil(g.time).toString().padStart(2, '0')}</b></div>
        <div className="side-name opponent"><b>◆ 紅の蔵</b><small>CPU / {LEVELS[g.difficulty].name}</small></div>
      </div>
      <meter className="territory-bar" aria-label="自分の陣地の割合" min={0} max={100} value={percentage} />
      <div className="percentages"><b data-testid="share">{percentage.toFixed(1)}<small>%</small></b><span>{g.hold > 0 ? `あと${(3 - g.hold).toFixed(1)}秒で制圧` : g.enemyHold > 0 ? '相手が制圧中！' : '多く塗った蔵が勝つ'}</span><b>{(100 - percentage).toFixed(1)}%</b></div>
      <div ref={slot} className="arena-slot">
        <div ref={arena} className="arena-wrap">
          {/* This keyboard-operable canvas intentionally has an application role and tabIndex. */}
          {/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-interactive-element-to-noninteractive-role */}
          <canvas ref={canvas} className="arena" role="application" tabIndex={g.status === 'playing' ? 0 : -1}
            aria-label={`陣取り盤面。自陣${percentage.toFixed(1)}%。カードを選び、床に触れて離すと配置。`} aria-describedby="keyboard-help"
            data-testid="arena" data-status={g.status} data-tiles={g.tiles.join('')}
            data-units={JSON.stringify(g.units.map((u) => ({ x: u.x, y: u.y, side: u.side, kind: u.kind })))}
            data-culture={g.culture.toFixed(1)} data-defense={defense(g, 1)} data-played={g.played}
            onPointerDown={input.boardDown}>
            Canvasに対応するブラウザで開いてください。
          </canvas>
          {/* oxlint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-interactive-element-to-noninteractive-role */}
          {g.status === 'playing' && g.time <= 20 && <span className="last-call">FINAL PUSH</span>}
        </div>
      </div>
      <div className="dock" inert={g.status !== 'playing'}>
        <div className="utility">
          <div className="supply"><label htmlFor="supply">補給 <b data-testid="energy">{Math.floor(g.energy)}</b><small>/10</small></label><meter id="supply" min={0} max={10} value={g.energy} /></div>
          <div className="next">NEXT<CardGlyph kind={g.queue[0]} small /></div>
          <button className="cancel" aria-label="選択を解除" disabled={input.index === null} onClick={input.cancel}>×</button>
          <button className="pause" aria-label="一時停止" onClick={pauseToggle} disabled={g.status !== 'playing'}>Ⅱ</button>
        </div>
        <div className={`culture ${g.cultureReady ? 'mature' : ''}`}>
          <span>{g.brew === 'sokujo' ? '乳酸サポート' : '生酛の育成'} <small>架空の特性</small></span>
          <progress aria-label="育成ゲージ" max={100} value={g.culture} />
          <b>{g.cultureReady ? `防御 ${Math.round(defense(g, 1) * 100)}%` : `${Math.floor(g.culture)}/100`}</b>
        </div>
        <div className="hand" aria-label="4枚の手札">
          {g.hand.map((id, i) => <button key={i} data-testid={`card-${i}`} data-card={id} data-cost={CARDS[id].cost}
            className={`game-card ${CARDS[id].hp ? 'unit' : 'spell'} ${input.index === i ? 'selected' : ''} ${g.energy < CARDS[id].cost ? 'unaffordable' : ''}`}
            aria-pressed={input.index === i} disabled={g.status !== 'playing'} aria-label={`${i + 1} ${CARDS[id].name} 補給${CARDS[id].cost} ${ROLE[id]}`}
            onPointerDown={(e) => input.cardDown(e, i)} onClick={(e) => input.cardClick(e, i)}>
            <span className="cost">{CARDS[id].cost}</span><span className="card-type">{CARDS[id].hp ? '部隊' : '技'}</span>
            <CardGlyph kind={id} /><b>{CARDS[id].name}</b><small>{ROLE[id]}</small>
          </button>)}
        </div>
        <output className="card-hint">{placementError || (selectedKind ? selectedKind === 'kai' ? '実線＝塗り / 破線＝ダメージ · 敵陣にも配置可' : selectedKind === 'sugidama' ? '輪の中を支援 · 触れて確認、離して配置' : `${ROLE[selectedKind]} · 実線＝攻撃 / 点線＝移動` : g.messageLife > 0 ? g.message : 'カード → 緑の床。触れて確認、離して配置。')}</output>
      </div>
      {session && g.status !== 'playing' && <dialog ref={modal} className="overlay" aria-labelledby="result-title" onCancel={(e) => e.preventDefault()}>
        <div className="paper-card">
          <div className="result-detail">
            <p className="eyebrow">{g.status === 'paused' ? 'TIME OUT' : g.status === 'won' ? 'VICTORY' : 'NEXT ROUND'}</p>
            <h2 id="result-title">{g.status === 'paused' ? 'ひと休み。' : g.status === 'won' ? 'あなたの蔵の勝利！' : g.status === 'lost' ? '紅の蔵の勝ち。' : '互角の一戦。'}</h2>
            {g.status === 'paused' ? <p>{pauseNote || '時間・補給・盤面は停止中です。'}</p> : <>
              <div className="result-score"><b>{medal(g)}</b><div><strong>{percentage.toFixed(1)}<small>%</small></strong><span>あなたの最終陣地</span></div></div>
              <p>{g.resultReason}</p><div className="result-mini"><span>配置 {g.played}回</span><span>撃破 {g.destroyed}体</span><span>{score(g).toLocaleString()}点</span></div>
              <svg viewBox="0 0 220 45" className="history"><title>対戦中の陣地推移</title><path d="M0 22.5H220" stroke="#95a493" strokeDasharray="3 3" /><polyline points={g.history.map((p) => `${p.time / DURATION * 220},${45 - p.share / 100 * 45}`).join(' ')} fill="none" stroke="#0d7763" strokeWidth="2.5" /></svg>
              <p className="tiny">{notice}</p>
            </>}
          </div>
          <div className="result-actions">
            {g.status === 'paused' ? <><button ref={action} className="primary" onClick={pauseToggle}>対戦を再開 →</button><button className="text-button" onClick={() => reset()}>この対戦をやめる</button></> : <><button ref={action} className="primary" onClick={() => launch(true)}>同じ条件で再戦 ↻</button><button className="text-button" onClick={() => reset(true)}>仕込み・手札を変える →</button></>}
          </div>
        </div>
      </dialog>}
    </section>
    <p id="keyboard-help" className="sr-only">1–4：手札 / 矢印：位置 / Enter：配置 / P：ポーズ / Esc：選択解除・ポーズ</p>
    <output className="sr-only" aria-live="polite">{announce}</output>
  </>;
}
createRoot(document.getElementById('root')!).render(<App />);
