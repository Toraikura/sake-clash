import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BREWS,
  CARDS,
  DECKS,
  LEVELS,
  W,
  H,
  DT,
  DURATION,
  createMatch,
  start,
  pause,
  resume,
  deploy,
  share,
  score,
  medal,
  defense,
  step,
  clamp,
  type Match,
  type Brew,
  type Deck,
  type Difficulty,
  type Point,
} from './model';
import { draw } from './render';
import { read, save, record, empty, BADGES, type RecordBook } from './storage';
import './style.css';
function App() {
  const match = useRef<Match>(createMatch()),
    canvas = useRef<HTMLCanvasElement>(null),
    field = useRef<HTMLElement>(null),
    action = useRef<HTMLButtonElement>(null),
    selectedRef = useRef<number | null>(null),
    cursorRef = useRef<Point>({ x: W / 2, y: H * 0.7 }),
    drag = useRef(false),
    stored = useRef(false);
  const [g, setG] = useState({ ...match.current }),
    [brew, setBrew] = useState<Brew>('sokujo'),
    [deck, setDeck] = useState<Deck>('balanced'),
    [difficulty, setDifficulty] = useState<Difficulty>('standard'),
    [selected, setSelected] = useState<number | null>(null),
    [book, setBook] = useState<RecordBook>(empty),
    [notice, setNotice] = useState('記録はこのブラウザだけに保存'),
    [pauseNote, setPauseNote] = useState(''),
    [seed, setSeed] = useState('260907'),
    [announce, setAnnounce] = useState('');
  const update = () => setG({ ...match.current });
  const active = g.status === 'playing' || g.status === 'paused',
    terminal = ['won', 'lost', 'draw'].includes(g.status);
  useEffect(() => {
    try {
      setBook(read(localStorage));
    } catch {
      setNotice('記録の保存は利用できません。プレイは続けられます。');
    }
  }, []);
  useEffect(() => {
    let raf = 0,
      last = 0,
      acc = 0,
      paint = 0;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    function loop(now: number) {
      if (last) acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      const before = match.current.status;
      while (acc >= DT) {
        step(match.current);
        acc -= DT;
      }
      if (canvas.current)
        draw(
          canvas.current,
          match.current,
          selectedRef.current === null ? null : cursorRef.current,
          selectedRef.current,
          media.matches,
        );
      if (
        (match.current.status === 'playing' && now - paint > 100) ||
        before !== match.current.status
      ) {
        setG({ ...match.current });
        paint = now;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (['won', 'lost', 'draw'].includes(g.status) && !stored.current) {
      stored.current = true;
      setBook((old) => {
        const next = record(old, match.current);
        try {
          if (!save(localStorage, next))
            setNotice('保存できませんでした。結果は画面で確認できます。');
        } catch {
          setNotice('保存できませんでした。');
        }
        return next;
      });
    }
    if (g.status !== 'playing') action.current?.focus({ preventScroll: true });
    setAnnounce(
      g.status === 'won'
        ? '勝利！'
        : g.status === 'lost'
          ? '惜敗。もう一度挑戦できます。'
          : g.status === 'paused'
            ? '一時停止しました。'
            : '',
    );
  }, [g.status]);
  useEffect(() => {
    const stop = (reason: string) => {
      if (match.current.status === 'playing') {
        pause(match.current);
        setPauseNote(reason);
        setG({ ...match.current });
      }
    };
    const visibility = () => {
      if (document.hidden) stop('タブが非表示になったため停止しました。');
    };
    const blur = () => stop('画面からフォーカスが外れたため停止しました。');
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) stop('盤面が画面外になったため停止しました。');
    });
    if (canvas.current) observer.observe(canvas.current);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const choose = (i: number) => {
    selectedRef.current = i;
    setSelected(i);
  };
  const focus = () => canvas.current?.focus({ preventScroll: true });
  const place = (p: Point) => {
    const i = selectedRef.current;
    if (i === null) {
      match.current.message = '下の手札を選んでから配置';
      match.current.messageLife = 3;
      update();
      return;
    }
    if (deploy(match.current, i, p.x, p.y)) {
      selectedRef.current = null;
      setSelected(null);
    }
    cursorRef.current = p;
    update();
    focus();
  };
  const coordinates = (clientX: number, clientY: number): Point | null => {
    const r = canvas.current?.getBoundingClientRect();
    if (
      !r ||
      clientX < r.left ||
      clientY < r.top ||
      clientX > r.right ||
      clientY > r.bottom
    )
      return null;
    return {
      x: ((clientX - r.left) / r.width) * W,
      y: ((clientY - r.top) / r.height) * H,
    };
  };
  useEffect(() => {
    const up = (e: PointerEvent) => {
      if (!drag.current) return;
      drag.current = false;
      const r = canvas.current?.getBoundingClientRect();
      if (
        !r ||
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        return;
      const p = {
        x: ((e.clientX - r.left) / r.width) * W,
        y: ((e.clientY - r.top) / r.height) * H,
      };
      const i = selectedRef.current;
      if (i !== null && deploy(match.current, i, p.x, p.y)) {
        selectedRef.current = null;
        setSelected(null);
      }
      cursorRef.current = p;
      setG({ ...match.current });
      canvas.current?.focus({ preventScroll: true });
    };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const r = canvas.current?.getBoundingClientRect();
      if (r)
        cursorRef.current = {
          x: clamp(((e.clientX - r.left) / r.width) * W, 0.2, W - 0.2),
          y: clamp(((e.clientY - r.top) / r.height) * H, 0.2, H - 0.2),
        };
    };
    const cancel = () => {
      drag.current = false;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      const m = match.current;
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (m.status === 'playing') {
          pause(m);
          setPauseNote('');
        } else if (m.status === 'paused') resume(m);
        setG({ ...m });
        return;
      }
      if (m.status !== 'playing') return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        choose(Number(e.key) - 1);
        canvas.current?.focus({ preventScroll: true });
        e.preventDefault();
      }
      const dirs: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      if (dirs[e.key]) {
        e.preventDefault();
        const p = cursorRef.current;
        cursorRef.current = {
          x: clamp(p.x + dirs[e.key].x, 0.5, W - 0.5),
          y: clamp(p.y + dirs[e.key].y, 0.5, H - 0.5),
        };
        setG({ ...m });
      }
      if (
        (e.key === 'Enter' || e.code === 'Space') &&
        e.target === canvas.current
      ) {
        e.preventDefault();
        if (e.repeat) return;
        const i = selectedRef.current,
          p = cursorRef.current;
        if (i !== null && deploy(m, i, p.x, p.y)) {
          selectedRef.current = null;
          setSelected(null);
        }
        setG({ ...m });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const launch = (same = false) => {
    match.current = createMatch(
      same ? g.difficulty : difficulty,
      same ? g.deck : deck,
      same ? g.seed : Number(seed),
      same ? g.brew : brew,
    );
    stored.current = false;
    selectedRef.current = null;
    setSelected(null);
    cursorRef.current = { x: W / 2, y: H * 0.7 };
    start(match.current);
    update();
    field.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    focus();
  };
  const reset = () => {
    match.current = createMatch(difficulty, deck, Number(seed), brew);
    selectedRef.current = null;
    setSelected(null);
    update();
  };
  const pauseToggle = () => {
    if (match.current.status === 'playing') {
      pause(match.current);
      setPauseNote('');
    } else resume(match.current);
    update();
    focus();
  };
  const percentage = share(g),
    card = selected === null ? null : CARDS[g.hand[selected]];
  return (
    <>
      <header className="brand">
        <a href="#main">
          <b className="logo">SAT</b>
          <span>
            SAKE ART TOKYO<small>PLAY EXPERIMENT / 02</small>
          </span>
        </a>
        <span className="local-label">LOCAL / CPU BATTLE</span>
      </header>
      <main id="main">
        <div className="headline">
          <div>
            <p className="eyebrow">手札を切れ。酒蔵の色を広げろ。</p>
            <h1>
              SAKE <span>CLASH</span>
            </h1>
          </div>
          <p className="title-note">
            酒蔵陣取り
            <br />
            <b>75秒の、塗り合戦。</b>
          </p>
        </div>
        <div className="layout">
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
          <section ref={field} className="battle" aria-label="酒蔵陣取りゲーム">
            <div className="battle-top">
              <div className="side-name">
                <span className="side-icon green">酒</span>
                <span>
                  あなた<small>{BREWS[g.brew].name}</small>
                </span>
              </div>
              <div className={`clock ${g.time < 15 ? 'urgent' : ''}`}>
                <span>TIME</span>
                <b data-testid="time">
                  {Math.ceil(g.time).toString().padStart(2, '0')}
                </b>
              </div>
              <div className="side-name opponent">
                <span>
                  紅の蔵<small>CPU / {LEVELS[g.difficulty].name}</small>
                </span>
                <span className="side-icon red">蔵</span>
              </div>
              <button
                className="pause"
                aria-label={g.status === 'paused' ? '再開' : '一時停止'}
                onClick={pauseToggle}
                disabled={!active}
              >
                {g.status === 'paused' ? '▶' : 'Ⅱ'}
              </button>
            </div>
            <meter
              className="territory-bar"
              aria-label="自分の陣地の割合"
              min={0}
              max={100}
              value={percentage}
            />
            <div className="percentages">
              <b data-testid="share">
                {percentage.toFixed(1)}
                <small>%</small>
              </b>
              <span>
                {g.hold > 0
                  ? `あと${(3 - g.hold).toFixed(1)}秒で制圧勝利`
                  : g.enemyHold > 0
                    ? '相手が制圧中！ 塗り返せ'
                    : '多く塗った蔵が勝つ'}
              </span>
              <b>
                {(100 - percentage).toFixed(1)}
                <small>%</small>
              </b>
            </div>
            <div className="arena-wrap">
              {/* The canvas is a keyboard-operated game surface, so focus and application role are intentional. */}
              {/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-interactive-element-to-noninteractive-role */}
              <canvas
                ref={canvas}
                role="application"
                tabIndex={0}
                aria-label={`陣取り盤面。自陣${percentage.toFixed(1)}%。1から4でカード選択、矢印で配置位置、Enterで配置。`}
                aria-describedby="keyboard-help"
                data-testid="arena"
                data-status={g.status}
                data-tiles={g.tiles.join('')}
                data-units={JSON.stringify(
                  g.units.map((u) => ({
                    x: u.x,
                    y: u.y,
                    side: u.side,
                    kind: u.kind,
                  })),
                )}
                data-culture={g.culture.toFixed(1)}
                data-defense={defense(g, 1)}
                onPointerMove={(e) => {
                  const p = coordinates(e.clientX, e.clientY);
                  if (p) cursorRef.current = p;
                }}
                onPointerDown={(e) => {
                  if (drag.current) return;
                  const p = coordinates(e.clientX, e.clientY);
                  if (p) place(p);
                }}
              >
                酒蔵陣取りの盤面。Canvasに対応するブラウザで開いてください。
              </canvas>
              {/* oxlint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-interactive-element-to-noninteractive-role */}
              {g.status === 'playing' && g.messageLife > 0 && (
                <output className="toast">{g.message}</output>
              )}
              {g.status === 'playing' && g.time <= 20 && (
                <span className="last-call">FINAL PUSH</span>
              )}
              {g.status !== 'playing' && (
                <div className="overlay">
                  <div className={`paper-card ${terminal ? 'result' : ''}`}>
                    <p className="eyebrow">
                      {g.status === 'ready'
                        ? 'BREW. DEPLOY. CONQUER.'
                        : g.status === 'paused'
                          ? 'TIME OUT'
                          : g.status === 'won'
                            ? 'VICTORY'
                            : g.status === 'lost'
                              ? 'NEXT ROUND, NEXT STRATEGY'
                              : 'EVEN MATCH'}
                    </p>
                    <h2>
                      {g.status === 'ready' ? (
                        <>
                          その一手で、
                          <br />
                          前線が変わる。
                        </>
                      ) : g.status === 'paused' ? (
                        'ひと休み。'
                      ) : g.status === 'won' ? (
                        'あなたの蔵の勝利！'
                      ) : g.status === 'lost' ? (
                        'あと一手、届かず。'
                      ) : (
                        '互角の一戦。'
                      )}
                    </h2>
                    {g.status === 'ready' ? (
                      <>
                        <p>
                          カードを選んで、自分の色の床へ。
                          <br />
                          ユニットが動き、弾が陣地を塗り替える。
                        </p>
                        <div className="steps">
                          <span>① 手札を選ぶ</span>
                          <span>② 緑の床をタップ</span>
                        </div>
                        <button
                          ref={action}
                          className="primary"
                          onClick={() => launch()}
                        >
                          対戦開始 <span>→</span>
                        </button>
                        <p className="tiny">
                          75秒 / CPU戦 / {BREWS[brew].name}
                        </p>
                      </>
                    ) : g.status === 'paused' ? (
                      <>
                        <p>
                          {pauseNote ||
                            '補給も盤面も停止中。次の一手を考えよう。'}
                        </p>
                        <button
                          ref={action}
                          className="primary"
                          onClick={pauseToggle}
                        >
                          対戦を再開 →
                        </button>
                        <button className="text-button" onClick={reset}>
                          この対戦をやめる
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="result-score">
                          <b>{medal(g)}</b>
                          <div>
                            <strong>
                              {percentage.toFixed(1)}
                              <small>%</small>
                            </strong>
                            <span>あなたの最終陣地</span>
                          </div>
                        </div>
                        <p>{g.resultReason}</p>
                        <div className="result-mini">
                          <span>配置 {g.played}回</span>
                          <span>撃破 {g.destroyed}体</span>
                          <span>{score(g).toLocaleString()}点</span>
                        </div>
                        <svg viewBox="0 0 220 45" className="history">
                          <title>対戦中の陣地推移</title>
                          <path
                            d="M0 22.5H220"
                            stroke="#95a493"
                            strokeDasharray="3 3"
                          />
                          <polyline
                            points={g.history
                              .map(
                                (p) =>
                                  `${(p.time / DURATION) * 220},${45 - (p.share / 100) * 45}`,
                              )
                              .join(' ')}
                            fill="none"
                            stroke="#0d7763"
                            strokeWidth="2.5"
                          />
                        </svg>
                        <button
                          ref={action}
                          className="primary"
                          onClick={() => launch(true)}
                        >
                          同じ条件で再戦 ↻
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            const n = g.seed + 1;
                            setSeed(String(n));
                            match.current = createMatch(
                              difficulty,
                              deck,
                              n,
                              brew,
                            );
                            update();
                          }}
                        >
                          仕込み・手札を変える →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="supply">
              <label htmlFor="supply">
                補給 <b data-testid="energy">{Math.floor(g.energy)}</b>
                <small>/10</small>
              </label>
              <div className="supply-slots" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={g.energy >= i + 1 ? 'full' : ''} />
                ))}
              </div>
              <meter
                id="supply"
                className="sr-only"
                min="0"
                max="10"
                value={g.energy}
              />
              <span className="next">
                NEXT <b>{CARDS[g.queue[0]].icon}</b>
              </span>
            </div>
            <div className="hand" aria-label="4枚の手札">
              {g.hand.map((id, i) => {
                const c = CARDS[id];
                return (
                  <button
                    key={i}
                    data-testid={`card-${i}`}
                    data-card={id}
                    data-cost={c.cost}
                    className={`game-card ${selected === i ? 'selected' : ''} ${g.energy < c.cost ? 'unaffordable' : ''}`}
                    aria-pressed={selected === i}
                    disabled={g.status !== 'playing'}
                    aria-label={`${i + 1} ${c.name} 補給${c.cost}`}
                    onPointerDown={() => {
                      if (g.status === 'playing') {
                        choose(i);
                        drag.current = true;
                      }
                    }}
                    onClick={() => choose(i)}
                  >
                    <span className="cost">{c.cost}</span>
                    <span className={`card-symbol ${id}`}>{c.icon}</span>
                    <b>{c.name}</b>
                    <small>
                      {c.short} <i>{i + 1}</i>
                    </small>
                  </button>
                );
              })}
            </div>
            <div className="card-hint" aria-live="polite">
              {card ? (
                <>
                  <b>{card.name}</b> {card.description}
                </>
              ) : (
                'カード → 緑の床をタップ。ドラッグでも配置できます。'
              )}
            </div>
            <div className={`culture ${g.cultureReady ? 'mature' : ''}`}>
              <div>
                <span>
                  {g.brew === 'sokujo' ? '乳酸サポート' : '生酛の育成'}{' '}
                  <small>架空の特性</small>
                </span>
                <b>
                  {g.cultureReady
                    ? `防御 ${Math.round(defense(g, 1) * 100)}%`
                    : `${Math.floor(g.culture)} / 100`}
                </b>
              </div>
              <progress aria-label="育成ゲージ" max="100" value={g.culture} />
              <p>
                {g.brew === 'sokujo'
                  ? '最初から被ダメージ10%軽減'
                  : g.cultureReady
                    ? '育成完了：被ダメージ35%軽減'
                    : '乳酸菌の拠点を守るほど育成が加速'}
              </p>
            </div>
            <p id="keyboard-help" className="keyboard-help">
              1–4：手札 / 矢印：位置 / Enter：配置 / P・Esc：ポーズ
            </p>
          </section>
          <aside className="notes">
            <p className="section-label">02 / TACTICAL NOTES</p>
            <h2>仕込みが、戦術になる。</h2>
            <div className="tactic">
              <b>速醸型 → 序盤から安定</b>
              <p>
                初期補給8と防御10%。早めの砲台配置で前線を作り、支援を重ねる。
              </p>
            </div>
            <div className="tactic">
              <b>生酛型 → 育てた守り</b>
              <p>
                初期補給5、防御なし。拠点を守って育成100にすると、以後は被ダメージ35%軽減。完成してから押し返す。
              </p>
            </div>
            <p className="fiction-note">
              これは遊びのための能力差です。現実の生酛の安全性や防御力を表しません。
            </p>
            <details>
              <summary>6枚のカードと相性</summary>
              {Object.entries(CARDS).map(([id, c]) => (
                <div className="card-guide" key={id}>
                  <span>{c.icon}</span>
                  <div>
                    <b>
                      {c.name} <small>補給{c.cost}</small>
                    </b>
                    <p>{c.description}</p>
                  </div>
                </div>
              ))}
            </details>
            <details>
              <summary>勝敗・補給・配置ルール</summary>
              <p>
                75秒終了時に陣地が多い側が勝利。同数は引き分け。85%以上を3秒連続で保つと早期勝利です。
              </p>
              <p>
                補給は毎秒0.95、上限10。ユニットは自分の色へ配置。「櫂入れ」だけは敵陣にも使えます。使用したカードは山札の最後に戻り、次のカードが手札に入ります。
              </p>
              <p>
                弾は敵に当たるか寿命まで進み、種類に応じて壁で反射。ユニットにはHPと活動時間があり、消える前に次の部隊を用意する必要があります。
              </p>
              <p>
                生酛の育成は毎秒0.6、乳酸菌の拠点1つにつき+1.4（3つまで）。配置成功でも+2。拠点を失うと育成速度が下がります。完成後の防御は対戦終了まで維持。
              </p>
            </details>
          </aside>
        </div>
        <section className="record-book">
          <div>
            <p className="section-label">YOUR BREWERY RECORD</p>
            <h2>次の一手を、強くする。</h2>
            <p>{notice}</p>
          </div>
          <div className="record-values">
            <div>
              <span>勝利 / 対戦</span>
              <b data-testid="wins">
                {book.wins}
                <small> / {book.runs}</small>
              </b>
            </div>
            <div>
              <span>速醸型 BEST</span>
              <b data-testid="best-sokujo">
                {book.best.sokujo.toLocaleString()}
              </b>
            </div>
            <div>
              <span>生酛型 BEST</span>
              <b data-testid="best-kimoto">
                {book.best.kimoto.toLocaleString()}
              </b>
            </div>
          </div>
          <div className="badges">
            {BADGES.map((b) => (
              <span
                key={b}
                className={book.badges.includes(b) ? 'unlocked' : ''}
              >
                {book.badges.includes(b) ? '✓' : '○'} {b}
              </span>
            ))}
          </div>
        </section>
        <section className="science">
          <p className="section-label">03 / GAME & REAL BREWING</p>
          <h2>酒をテーマに。ルールは架空に。</h2>
          <p>このゲームは仕込み・飲用可否・菌数・酒質を判定しません。</p>
          <details>
            <summary>速醸・生酛の出典とゲームの境界</summary>
            <p>
              <b>出典で確認：</b>
              生酛系では乳酸菌がつくる乳酸を利用し、速醸系では醸造用乳酸を使います。
              <a
                href="https://www.nrib.go.jp/sake/sakefaq02.html"
                target="_blank"
                rel="noreferrer"
              >
                酒類総合研究所「清酒」↗
              </a>
              （2026-09-07確認）
            </p>
            <p>
              <b>教育用の簡略化：</b>
              乳酸を得る過程の違いを「最初から支援がある／育てて支援を得る」という対比にしています。
            </p>
            <p>
              <b>架空のゲーム係数：</b>
              育成時間、補給、塗り、攻撃、防御10%・35%、修復、ユニットの動き、勝敗はすべて架空です。実際の生酛が一律に安全・頑丈・高品質になるという説明ではありません。
            </p>
          </details>
        </section>
      </main>
      <footer>
        <b>SAT / SAKE CLASH</b>
        <span>ローカルCPU戦 · 広告なし · 課金なし</span>
      </footer>
      <output className="sr-only" aria-live="polite">
        {announce}
      </output>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
