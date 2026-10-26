// How risky is each coin for a solo player? For every coin in the level (and
// any extra --try points), reports whether riding a marching group picks it
// up, how much of the time some officer can see the spot, and how often a
// solo dash to it gets caught.
// Usage: node tools/coins.mjs src/levels/level-01.json [--seconds 60] [--every 1500] [--try "60,650;480,1350"]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
const extra = String(args.try ?? '').split(';').filter(Boolean).map((p) => p.split(',').map(Number));
await run(args._[0], async (page) => {
  const rows = await page.evaluate(([seconds, every, extra]) => {
    const s = window.__scene, L = s.level, B = L.obstacles, STEP = 50, SPEED = 170;
    const PICKUP = 13 * s.player.scaleX + 10;
    const paths = L.crowds.map((c, i) => ({ i, c })).filter((p) => p.c.type === 'marching');
    // Nearest point on any marching path, and its distance.
    const nearest = (x, y) => {
      let best = { d: Infinity };
      for (const { i, c } of paths) for (let k = 0; k + 1 < c.path.length; k++) {
        const a = c.path[k], b = c.path[k + 1], vx = b.x - a.x, vy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)));
        const px = a.x + vx * t, py = a.y + vy * t, d = Math.hypot(x - px, y - py);
        if (d < best.d) best = { d, x: px, y: py, crowd: i };
      }
      return best;
    };
    // Record officer states over the window plus room for the longest dash.
    const N = Math.round(((seconds + 30) * 1000) / STEP), states = [];
    for (let k = 0; k <= N; k++) { states.push(s.officers.map((o) => [o.x, o.y, o.facing])); s.officers.forEach((o) => o.update(STEP)); }
    const seen = (k, x, y) => s.officers.some((o, n) => { [o.x, o.y, o.facing] = states[k][n]; return o.canSee(x, y, B); });
    const inside = (x, y) => B.some((b) => x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height);

    const coins = (L.coins ?? []).map((c) => ({ x: c.x, y: c.y, value: c.value ?? 5, label: 'coin' }));
    for (const [x, y] of extra) coins.push({ x, y, value: 0, label: 'try ' });
    return coins.map((c) => {
      const near = nearest(c.x, c.y);
      let exposed = 0, samples = 0;
      for (let k = 0; k < (seconds * 1000) / STEP; k += 2, samples++) if (seen(k, c.x, c.y)) exposed++;
      // Dash: path point -> coin -> path point at full speed, meter from zero, no crowd cover.
      const legSteps = Math.ceil((near.d / SPEED) * 1000 / STEP);
      let blocked = false;
      for (let j = 0; j <= legSteps; j++) if (inside(near.x + ((c.x - near.x) * j) / Math.max(1, legSteps), near.y + ((c.y - near.y) * j) / Math.max(1, legSteps))) blocked = true;
      let caught = 0, tries = 0, peakSum = 0;
      for (let start = 0; start < seconds * 1000; start += every, tries++) {
        let meter = 0, peak = 0;
        const k0 = Math.round(start / STEP);
        for (let j = 0; j <= 2 * legSteps; j++) {
          const f = j <= legSteps ? j / Math.max(1, legSteps) : (2 * legSteps - j) / Math.max(1, legSteps);
          const x = near.x + (c.x - near.x) * f, y = near.y + (c.y - near.y) * f;
          meter = seen(k0 + j, x, y) ? meter + STEP : Math.max(0, meter - 2 * STEP);
          peak = Math.max(peak, meter);
        }
        if (peak >= 500) caught++;
        peakSum += Math.min(peak, 500);
      }
      return {
        ...c, onRoute: near.d <= PICKUP ? near.crowd : null, off: Math.round(near.d), blocked,
        exposed: Math.round((100 * exposed) / samples), caught, tries, meanPeak: Math.round(peakSum / tries),
      };
    });
  }, [args.seconds ?? 60, args.every ?? 1500, extra]);
  for (const r of rows) {
    const route = r.onRoute !== null ? `on crowd ${r.onRoute}'s route` : `${String(r.off).padStart(3)} units off route`;
    const warn = r.blocked ? ' (straight dash crosses an obstacle; real route is longer)' : '';
    console.log(`${r.label} ${r.x},${r.y} value ${String(r.value).padStart(2)}: ${route.padEnd(22)} | seen ${String(r.exposed).padStart(2)}% of the time | solo dash caught ${r.caught} of ${r.tries}, mean peak ${r.meanPeak}ms${warn}`);
  }
  const total = rows.filter((r) => r.label === 'coin').reduce((n, r) => n + r.value, 0);
  console.log(`\nTotal coin value in the level: ${total}.`);
});
