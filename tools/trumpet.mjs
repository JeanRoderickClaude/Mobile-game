// Trumpet levels: compare crossing a guarded stretch alone, with gathered
// bystanders, and while playing nonstop, and check what a full noise meter
// brings. Usage:
//   node tools/trumpet.mjs src/levels/level-02.json [--from 270,1330] [--route "200,900;200,700;270,450;270,40"]
//        [--spots "290,2450;270,1650;270,1330"] [--starts 20] [--every 1500] [--difficulty easy]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
const pt = (s) => s.split(',').map(Number);
const from = pt(String(args.from ?? '270,1330'));
const route = String(args.route ?? '200,900;200,700;270,450;270,40').split(';').map(pt);
const spots = String(args.spots ?? '290,2450;270,1650;270,1330').split(';').map(pt);
const starts = args.starts ?? 20;
const every = args.every ?? 1500;

await run(args._[0], async (page) => {
  const out = await page.evaluate(async ([from, route, spots, starts, every]) => {
    const lines = [];
    const STEP = 16;

    /** Fresh level, then wait `delay` ms at the start so officers are elsewhere on their patrols. */
    async function setup(delay, x, y) {
      const s = await window.__restart();
      s.player.x = x; s.player.y = y;
      for (let t = 0; t < delay; t += STEP) {
        s.player.x = x; s.player.y = y;
        s.update(0, STEP);
        s.suspicion = 0;
        s.noise = 0;
      }
      return s;
    }

    /** Steer toward the next route point with joystick strength `push`. Returns false at the end. */
    function steer(s, state, push) {
      const g = route[state.wp];
      if (!g) { s.joystick.vector.set(0, 0); return false; }
      const dx = g[0] - s.player.x, dy = g[1] - s.player.y, d = Math.hypot(dx, dy);
      if (d < 10) { state.wp++; return steer(s, state, push); }
      s.joystick.vector.set((dx / d) * push, (dy / d) * push);
      return true;
    }

    const lingerLeft = (s) => Math.min(...s.bystanders.people.filter((p) => p.state === 'drawn').map((p) => p.linger), Infinity);

    /**
     * policy(s, t) returns { play, push } each frame. Runs until the finish, a catch or 90 s.
     * Reports survival, time, coins and how many times officers were called.
     */
    async function crossing(policy, delay) {
      const s = await setup(delay, from[0], from[1]);
      const state = { wp: 0 };
      let alerts = 0, wasAlerted = 0, peak = 0;
      for (let t = 0; t < 90000 && !s.finished; t += STEP) {
        const { play, push } = policy(s, t);
        s.trumpetOverride = play;
        if (!steer(s, state, push)) s.joystick.vector.set(0, -push); // past the route: walk on to the finish
        s.update(0, STEP);
        const now = s.officers.filter((o) => o.alerted).length;
        if (now > wasAlerted) alerts += now - wasAlerted;
        wasAlerted = now;
        peak = Math.max(peak, s.suspicion);
      }
      const ok = s.finished && s.suspicion < s.catchTimeMs;
      return { ok, time: s.elapsedMs - delay, coins: s.runCoins, alerts, peak, at: ok ? null : `${Math.round(s.player.x)},${Math.round(s.player.y)}` };
    }

    function summary(name, rows) {
      const ok = rows.filter((r) => r.ok);
      const avg = (k, rs) => (rs.length ? rs.reduce((a, r) => a + r[k], 0) / rs.length : 0);
      lines.push(`${name}: ${ok.length} of ${rows.length} survived` +
        (ok.length ? `, avg ${(avg('time', ok) / 1000).toFixed(1)} s, avg ${avg('coins', ok).toFixed(0)} coins` : '') +
        `, officers called in ${rows.filter((r) => r.alerts > 0).length} runs`);
      const fails = rows.filter((r) => !r.ok).map((r) => r.at);
      if (fails.length) lines.push(`  caught at: ${fails.join(' ')}`);
    }

    const delays = Array.from({ length: starts }, (_, i) => i * every);

    // 1. Alone, no trumpet, straight along the route at full speed.
    const blind = [];
    for (const d of delays) blind.push(await crossing(() => ({ play: false, push: 1 }), d));
    summary('alone, full speed, no trumpet', blind);

    // 2. Gather, then walk while they linger: play standing still until 5 have gathered
    //    (at most 3 s), then walk at a three-quarter push. Play again (walking) only when the
    //    group is gone or the linger time is nearly over, and never past 70 percent noise.
    const gather = [];
    for (const d of delays) {
      let gathered = false;
      gather.push(await crossing((s, t) => {
        if (!gathered) {
          gathered = s.bystanders.count >= 5 || t > 3000;
          return { play: true, push: 0 };
        }
        const need = s.bystanders.count < 3 || lingerLeft(s) < 900;
        return { play: need && s.noise < 0.7, push: 0.75 };
      }, d));
    }
    summary('gather, then move in the linger time', gather);

    // 3. Same start, but play the whole way across.
    const nonstop = [];
    for (const d of delays) {
      let gathered = false;
      nonstop.push(await crossing((s, t) => {
        if (!gathered) gathered = s.bystanders.count >= 5 || t > 3000;
        return { play: true, push: gathered ? 0.75 : 0 };
      }, d));
    }
    summary('play nonstop while crossing', nonstop);

    // 4. Hold the trumpet standing still until the meter fills, then wait silently 20 s.
    for (const [x, y] of spots) {
      let called = 0, arrived = 0, back = 0, fillAt = 0;
      for (const d of delays.slice(0, 10)) {
        const s = await setup(d, x, y);
        s.crowds.forEach((c) => (c.contains = () => false));
        s.bystanders.hides = () => false; // only the meter matters here
        s.catchTimeMs = Infinity;
        let filled = -1, near = false, any = false;
        for (let t = 0; t < 30000; t += STEP) {
          s.player.x = x; s.player.y = y;
          s.trumpetOverride = filled < 0;
          s.update(0, STEP);
          if (filled < 0 && s.officers.some((o) => o.alerted)) filled = t;
          if (filled < 0 && t > 0 && s.noise === 0 && s.trumpetOverride && t > 1000) filled = t; // filled with nobody in range
          const alerted = s.officers.filter((o) => o.alerted);
          if (alerted.length) any = true;
          if (alerted.some((o) => Math.hypot(o.x - x, o.y - y) < 40)) near = true;
        }
        fillAt = filled;
        if (any) called++;
        if (near) arrived++;
        if (any && !s.officers.some((o) => o.alerted)) back++;
      }
      lines.push(`hold at ${x},${y}: meter full after ${(fillAt / 1000).toFixed(1)} s; officers called in ${called} of 10, reached the spot in ${arrived}, all back on patrol within 30 s in ${back}`);
    }
    return lines;
  }, [from, route, spots, starts, every]);
  out.forEach((l) => console.log(l));
});
