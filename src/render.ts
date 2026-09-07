import { W, H, canPlace, type Match, type Point, CARDS } from './model';
const COLORS = {
  1: { tile: '#69c5ab', edge: '#137765', dark: '#075d51', light: '#bbf6d4' },
  2: { tile: '#eb9475', edge: '#a3422b', dark: '#843b2c', light: '#ffd4a6' },
} as const;
export function draw(
  canvas: HTMLCanvasElement,
  g: Match,
  cursor: Point | null,
  selected: number | null,
  reduced: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.clientWidth,
    ratio = Math.min(devicePixelRatio || 1, 2),
    height = (width * H) / W;
  if (
    canvas.width !== Math.round(width * ratio) ||
    canvas.height !== Math.round(height * ratio)
  ) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const unit = width / W;
  ctx.setTransform(unit * ratio, 0, 0, unit * ratio, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const side = g.tiles[y * W + x] as 1 | 2;
      ctx.fillStyle = COLORS[side].tile;
      ctx.fillRect(x, y, 1, 1);
      ctx.strokeStyle = side === 1 ? '#246f5933' : '#963d2730';
      ctx.lineWidth = 0.035;
      ctx.strokeRect(x, y, 1, 1);
    }
  // A crisp changing frontier makes terrain ownership visible without reading the meter.
  ctx.lineWidth = 0.09;
  ctx.strokeStyle = '#fff5ddbb';
  ctx.beginPath();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x < W - 1 && g.tiles[i] !== g.tiles[i + 1]) {
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + 1, y + 1);
      }
      if (y < H - 1 && g.tiles[i] !== g.tiles[i + W]) {
        ctx.moveTo(x, y + 1);
        ctx.lineTo(x + 1, y + 1);
      }
    }
  ctx.stroke();
  for (const f of g.fx) {
    if (reduced) continue;
    ctx.globalAlpha = (f.life / f.max) * 0.5;
    ctx.strokeStyle = COLORS[f.side].light;
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.arc(
      f.x,
      f.y,
      f.radius * (1.3 - (f.life / f.max) * 0.3),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const u of g.units) {
    const c = COLORS[u.side];
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.fillStyle = '#173b3040';
    ctx.beginPath();
    ctx.ellipse(0.17, 0.4, 0.85, 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.12;
    if (u.kind === 'tokkuri') {
      ctx.fillStyle = c.dark;
      ctx.strokeStyle = '#26352d';
      ctx.beginPath();
      ctx.roundRect(-0.75, -0.6, 1.5, 1.35, 0.3);
      ctx.fill();
      ctx.stroke();
      ctx.rotate(u.angle);
      ctx.fillStyle = c.edge;
      ctx.beginPath();
      ctx.arc(0, 0, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.light;
      ctx.beginPath();
      ctx.roundRect(-0.1, -0.28, 1.5, 0.56, 0.13);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.dark;
      ctx.fillRect(1.15, -0.26, 0.22, 0.52);
    } else if (u.kind === 'sugidama') {
      ctx.fillStyle = c.dark;
      ctx.strokeStyle = '#26352d';
      ctx.beginPath();
      ctx.roundRect(-1, -0.65, 2, 1.3, 0.25);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.light;
      ctx.beginPath();
      ctx.arc(0, -0.14, 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.14);
      ctx.lineTo(0.3, -0.14);
      ctx.moveTo(0, -0.44);
      ctx.lineTo(0, 0.16);
      ctx.stroke();
    } else if (u.kind === 'koji') {
      ctx.rotate(reduced ? 0 : u.angle);
      ctx.fillStyle = c.dark;
      ctx.strokeStyle = '#26352d';
      ctx.beginPath();
      ctx.roundRect(-0.8, -0.8, 1.6, 1.6, 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.light;
      ctx.beginPath();
      ctx.arc(0, 0, 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = c.edge;
        ctx.fillRect(0.6, -0.19, 0.6, 0.38);
      }
    } else {
      ctx.fillStyle = c.edge;
      ctx.strokeStyle = '#26352d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.48, 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.light;
      ctx.beginPath();
      ctx.arc(0.3, -0.42, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff9e8';
      ctx.beginPath();
      ctx.arc(-0.16, -0.08, 0.085, 0, Math.PI * 2);
      ctx.arc(0.13, -0.08, 0.085, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#173f3580';
    ctx.fillRect(u.x - 0.6, u.y - 1.1, 1.2, 0.14);
    ctx.fillStyle = '#fff8dc';
    ctx.fillRect(u.x - 0.6, u.y - 1.1, 1.2 * Math.max(0, u.hp / u.maxHp), 0.14);
  }
  for (const b of g.shots) {
    const c = COLORS[b.side];
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 0.17;
    ctx.fillStyle = c.light;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!reduced) {
      ctx.strokeStyle = c.light + '99';
      ctx.lineWidth = 0.13;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.045, b.y - b.vy * 0.045);
      ctx.stroke();
    }
  }
  if (cursor && selected !== null && g.status === 'playing') {
    const valid = !canPlace(g, selected, cursor.x, cursor.y);
    ctx.strokeStyle = valid ? '#fff9dc' : '#732d23';
    ctx.lineWidth = 0.14;
    ctx.setLineDash([0.3, 0.18]);
    ctx.beginPath();
    ctx.arc(
      cursor.x,
      cursor.y,
      g.hand[selected] === 'kai' ? 3 : 1.1,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold .8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = valid ? '#fff9dc' : '#732d23';
    ctx.fillText(CARDS[g.hand[selected]].icon, cursor.x, cursor.y + 0.28);
  }
}
