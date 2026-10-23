// Search for any route to the finish with perfect knowledge of every
// officer's (and crowd's) future movement. Answers "can a perfect player
// finish?" and, with bigger cones, "how much slack does that route have?".
// Usage: node tools/solve.mjs src/levels/level-01.json [--crowds] [--range-mul 1.2] [--angle-add 10]
//                             [--cap 500] [--max-sec 120] [--draw route.png]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();

// Runs in the page. Time-expanded search: 10-unit grid, 100 ms steps, the
// player moves to any of the 8 neighbours or waits (100-141 units/s, slower
// than the real 170, so a found route is conservative).
function solve(opts) {
  const s = window.__scene;
  const L = s.level, B = L.obstacles, R = 13 * s.player.scaleX, CELL = 10, T = 100;
  const Off = s.officers[0].constructor;
  const CrowdC = s.crowds[0]?.constructor;
  const N = Math.round((opts.maxSec * 1000) / T);
  const offs = L.officers.map((d) => new Off(s, d));
  const probes = L.officers.map((d) => new Off(s, { ...d, visionRange: d.visionRange * opts.rangeMul, visionAngle: d.visionAngle + opts.angleAdd }));
  const crowds = opts.crowds && CrowdC ? L.crowds.map((d) => new CrowdC(s, d)) : [];
  // Replay officers and crowds once, recording their state at every step.
  const oState = [], cState = [];
  for (let k = 0; k <= N; k++) {
    oState.push(offs.map((o) => [o.x, o.y, o.facing]));
    cState.push(crowds.map((c) => [c.x, c.y, c.active, c.speed, c.radius]));
    for (let j = 0; j < 2; j++) { offs.forEach((o) => o.update(T / 2)); crowds.forEach((c) => c.update(T / 2)); }
  }
  // The copies were only needed for their recorded states; take their sprites off screen.
  for (const o of [...offs, ...probes]) { o.sprite.destroy(); o.cone.destroy(); }
  for (const c of crowds) { c.members.forEach((m) => m.character.destroy()); c.ground.destroy(); }
  const W = Math.floor(L.width / CELL), H = Math.floor(L.height / CELL);
  const free = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = i * CELL + 5, y = j * CELL + 5;
    if (x < R || x > L.width - R || y < R || y > L.height - R) continue;
    free[j * W + i] = B.some((b) => x + R > b.x && x - R < b.x + b.width && y + R > b.y && y - R < b.y + b.height) ? 0 : 1;
  }
  const seen = (k, x, y) => probes.some((p, n) => { [p.x, p.y, p.facing] = oState[k][n]; return p.canSee(x, y, B); });
  // Mirrors GameScene: HIDE_SPEED_MARGIN 1.1, HIDE_SPEED_FLOOR 25, HIDDEN_DETECTION_RATE 0.25, decay x2.
  const hidden = (k, x, y, v) => cState[k].some(([cx, cy, act, sp, r]) => act && Math.hypot(x - cx, y - cy) <= r && v <= Math.max(sp * 1.1, 25));
  const F = L.finish;
  let front = new Map([[Math.floor(L.start.y / CELL) * W + Math.floor(L.start.x / CELL), 0]]);
  const parents = [];
  for (let k = 0; k < N; k++) {
    const next = new Map(), par = new Map();
    parents.push(par);
    for (const [c, sus] of front) {
      const i = c % W, j = (c - i) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj, key = nj * W + ni;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H || !free[key]) continue;
        const x = ni * CELL + 5, y = nj * CELL + 5;
        const v = (Math.hypot(di, dj) * CELL * 1000) / T;
        const ns = seen(k + 1, x, y) ? sus + T * (hidden(k + 1, x, y, v) ? 0.25 : 1) : Math.max(0, sus - 2 * T);
        if (ns >= opts.cap) continue;
        if (x >= F.x && x <= F.x + F.width && y >= F.y && y <= F.y + F.height) {
          const path = [[x, y]];
          for (let q = k, cur = c; q >= 0; q--) { path.push([(cur % W) * CELL + 5, Math.floor(cur / W) * CELL + 5]); if (q > 0) cur = parents[q - 1].get(cur); }
          window.__route = path.reverse();
          return { solved: true, sec: ((k + 1) * T) / 1000 };
        }
        const old = next.get(key);
        if (old === undefined || ns < old) { next.set(key, ns); par.set(key, c); }
      }
    }
    front = next;
    if (!front.size) return { solved: false, deadAtSec: (k * T) / 1000 };
  }
  return { solved: false, timeout: true };
}

await run(args._[0], async (page) => {
  const opts = { crowds: !!args.crowds, rangeMul: args['range-mul'] ?? 1, angleAdd: args['angle-add'] ?? 0, cap: args.cap ?? 500, maxSec: args['max-sec'] ?? 120 };
  const r = await page.evaluate(solve, opts);
  const desc = `${opts.crowds ? 'with crowds' : 'solo'}, cone range x${opts.rangeMul}, angle +${opts.angleAdd} deg, caught at ${opts.cap}ms`;
  if (r.solved) console.log(`${desc}: route found, reaches the finish at ${r.sec}s`);
  else if (r.timeout) console.log(`${desc}: no route within ${opts.maxSec}s`);
  else console.log(`${desc}: no route; every option is caught by ${r.deadAtSec}s`);
  if (args.draw && r.solved) {
    await page.evaluate(() => {
      const s = window.__scene, P = window.__route, g = s.add.graphics().setDepth(99);
      g.lineStyle(10, 0xff00ff, 1).beginPath(); g.moveTo(P[0][0], P[0][1]); P.forEach(([x, y]) => g.lineTo(x, y)); g.strokePath();
      P.forEach(([x, y], i) => { if (i % 50 === 0) s.add.text(x + 8, y, `${i / 10}s`, { fontSize: '40px', color: '#ff0', stroke: '#000', strokeThickness: 6 }).setDepth(99); });
      const cam = s.cameras.main; cam.stopFollow(); cam.removeBounds(); cam.setZoom(960 / s.level.height); cam.centerOn(s.level.width / 2, s.level.height / 2);
      s.finished = true; s.scene.resume();
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: args.draw });
    console.log(`Route drawn to ${args.draw} (labels are seconds along the route).`);
  }
});
