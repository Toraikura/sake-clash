import { useEffect, useRef, useState, useCallback, type RefObject, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { W, H, clamp, deploy, type Match, type CardId, type Point } from './model';
type Selection = { index: number; card: CardId };
type Gesture = Selection & {
  id: number; source: 'card' | 'board'; capture: HTMLElement;
  rect: DOMRect; entered: boolean; touch: boolean;
};
/** One pointer owns one card for the entire gesture. Only pointerup can deploy. */
export function usePlacement(
  match: RefObject<Match>, canvas: RefObject<HTMLCanvasElement | null>,
  update: () => void, togglePause: () => void,
) {
  const selected = useRef<Selection | null>(null);
  const cursor = useRef<Point | null>(null);
  const keyboardPoint = useRef<Point>({ x: W / 2, y: H * .7 });
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Set<number>());
  const callbacks = useRef({ update, togglePause }); callbacks.current = { update, togglePause };
  const [index, setIndex] = useState<number | null>(null);
  const [aiming, setAiming] = useState(false);
  const [touch, setTouch] = useState(false);
  function tell(text: string) {
    match.current.message = text; match.current.messageLife = 2.4; callbacks.current.update();
  }
  const finish = useCallback((clearSelection: boolean) => {
    const old = gesture.current; gesture.current = null;
    cursor.current = null; setAiming(false); setTouch(false);
    if (clearSelection) { selected.current = null; setIndex(null); }
    if (old?.capture.hasPointerCapture(old.id)) old.capture.releasePointerCapture(old.id);
  }, []);
  const choose = useCallback((i: number) => {
    if (match.current.status !== 'playing') return;
    finish(false);
    selected.current = { index: i, card: match.current.hand[i] }; setIndex(i);
  }, [finish, match]);
  const point = useCallback((x: number, y: number): Point | null => {
    const r = canvas.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height || x < r.left || y < r.top || x >= r.right || y >= r.bottom) return null;
    return { x: (x - r.left) / r.width * W, y: (y - r.top) / r.height * H };
  }, [canvas]);
  function begin(e: ReactPointerEvent<HTMLElement>, source: 'card' | 'board', i?: number) {
    if (match.current.status !== 'playing' || !e.isPrimary || e.button !== 0 || pointers.current.size > 1) return;
    if (source === 'card' && i !== undefined) choose(i);
    const s = selected.current, r = canvas.current?.getBoundingClientRect();
    if (!s || !r) { tell('下の手札を選んでから配置'); return; }
    gesture.current = { ...s, id: e.pointerId, source, capture: e.currentTarget, rect: r, entered: source === 'board', touch: e.pointerType !== 'mouse' };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { finish(true); return; }
    cursor.current = source === 'board' ? point(e.clientX, e.clientY) : null;
    if (cursor.current) keyboardPoint.current = cursor.current;
    setAiming(!!cursor.current); setTouch(e.pointerType !== 'mouse');
  }
  const commit = useCallback((s: Selection, p: Point) => {
    if (match.current.status !== 'playing' || match.current.hand[s.index] !== s.card) { finish(true); return; }
    keyboardPoint.current = p;
    const success = deploy(match.current, s.index, p.x, p.y);
    finish(success); callbacks.current.update(); canvas.current?.focus({ preventScroll: true });
  }, [match, finish, canvas]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      pointers.current.add(e.pointerId);
      if (pointers.current.size > 1) finish(true);
    };
    const move = (e: PointerEvent) => {
      const a = gesture.current;
      if (!a || a.id !== e.pointerId) return;
      cursor.current = point(e.clientX, e.clientY);
      if (cursor.current) { a.entered = true; keyboardPoint.current = cursor.current; }
      setAiming(!!cursor.current);
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const a = gesture.current;
      if (!a || a.id !== e.pointerId) return;
      const r = canvas.current?.getBoundingClientRect();
      if (!r || (['x', 'y', 'width', 'height'] as const).some((k) => Math.abs(r[k] - a.rect[k]) > .5)) {
        finish(true); return;
      }
      const p = point(e.clientX, e.clientY);
      if (p) commit(a, p);
      else finish(a.source === 'board' || a.entered);
    };
    const cancelPointer = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (gesture.current?.id === e.pointerId) finish(true);
    };
    const lost = (e: PointerEvent) => { if (gesture.current?.id === e.pointerId) finish(true); };
    const cancel = () => { pointers.current.clear(); finish(true); };
    const resize = () => { if (gesture.current) finish(true); };
    const observer = new ResizeObserver(resize);
    if (canvas.current) observer.observe(canvas.current);
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape' && selected.current) { e.preventDefault(); finish(true); return; }
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { e.preventDefault(); cancel(); callbacks.current.togglePause(); return; }
      if (match.current.status !== 'playing') return;
      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault(); choose(Number(e.key) - 1); cursor.current = keyboardPoint.current; canvas.current?.focus({ preventScroll: true });
      }
      const dirs: Record<string, Point> = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
      if (dirs[e.key] && e.target === canvas.current) {
        e.preventDefault(); const p = keyboardPoint.current, d = dirs[e.key];
        keyboardPoint.current = { x: clamp(p.x + d.x, .5, W - .5), y: clamp(p.y + d.y, .5, H - .5) }; cursor.current = keyboardPoint.current;
      }
      if ((e.key === 'Enter' || e.code === 'Space') && e.target === canvas.current) {
        e.preventDefault(); if (!e.repeat && selected.current && !gesture.current) commit(selected.current, keyboardPoint.current);
      }
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelPointer);
    window.addEventListener('lostpointercapture', lost, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('pagehide', cancel);
    document.addEventListener('visibilitychange', cancel);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('keydown', key);
    return () => {
      observer.disconnect();
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancelPointer);
      window.removeEventListener('lostpointercapture', lost, true); window.removeEventListener('blur', cancel);
      window.removeEventListener('pagehide', cancel); document.removeEventListener('visibilitychange', cancel);
      window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('keydown', key);
    };
  }, [canvas, match, finish, point, choose, commit]);
  return {
    index, selected, cursor, aiming, touch,
    cancel: () => finish(true),
    resetCursor: () => { finish(true); keyboardPoint.current = { x: W / 2, y: H * .7 }; },
    boardDown: (e: ReactPointerEvent<HTMLCanvasElement>) => begin(e, 'board'),
    cardDown: (e: ReactPointerEvent<HTMLButtonElement>, i: number) => begin(e, 'card', i),
    cardClick: (e: ReactMouseEvent<HTMLButtonElement>, i: number) => {
      // Pointer-generated clicks follow pointerup; never reselect the newly cycled card.
      if (e.detail === 0 && pointers.current.size === 0) choose(i);
    },
  };
}
