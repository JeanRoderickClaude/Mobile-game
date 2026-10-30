// Chapter 5 (Teun): can Pip get himself and Teun to the exit, and do the two gates need Teun parked?
// Two scripted players run the level from the start, each at several officer phases (the player waits unseen at the start first):
//   lead: Pip walks the route at crowd pace with Teun following the whole way, never parking him.
//   park: the same route, but at each gate Pip parks Teun in a dark pocket, plays the trumpet on his way to a lure pocket on the other
//         side (the noise meter draws the lane guard away), comes back, takes Teun off "wait" before his drum fills, waits until the
//         officers who came are standing at the lure looking around, and walks both through the lane.
// A run ends when an officer reaches either of them (caught), when Pip reaches the exit with Teun (done), or after 150 s.
// Usage: node tools/teun.mjs src/levels/level-05.json [--starts 12] [--every 2000] [--difficulty easy] [--only lead,park] [--trace]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
await run(args._[0], async (page) => {
  const out = await page.evaluate(async ([starts, every, only, trace]) => {
    const { NavGrid } = await import('/Mobile-game/src/systems/nav.ts');
    const STEP = 16;
    const lines = [];
    const results = {};
    for (const plan of only) {
      const rows = [];
      for (let k = 0; k < starts; k++) rows.push(await attempt(plan, k * every));
      const done = rows.filter((r) => r.outcome === 'done');
      results[plan] = rows;
      lines.push(`${plan}: reached the exit with Teun in ${done.length} of ${starts}` + (done.length ? `, median ${Math.round(done.map((r) => r.t).sort((a, b) => a - b)[Math.floor(done.length / 2)] / 1000)} s` : '')
        + `; caught ${rows.filter((r) => r.outcome === 'caught').length}, stuck ${rows.filter((r) => r.outcome === 'timeout' || r.outcome === 'script').length}`);
      const where = rows.filter((r) => r.outcome !== 'done').map((r) => `${r.outcome}@${r.stage}`);
      if (where.length) lines.push('  ' + where.join(' '));
    }
    return lines;

    async function attempt(plan, delay) {
      const s = await window.__restart();
      const L = s.level;
      const nav = new NavGrid(L.width, L.height, L.obstacles, 20);
      let t = 0;
      let stage = 'start';
      const frame = () => { s.update(0, STEP); t += STEP; return s.finished; };
      // The player waits unseen at the start while the officers move on.
      for (let w = 0; w < delay; w += STEP) { s.player.x = L.start.x; s.player.y = L.start.y; s.teun.body.setPosition(L.teun.x, L.teun.y); frame(); s.suspicion = 0; }
      t = 0;
      const pip = () => s.player;
      const teun = () => s.teun;
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      let path = [], pathAt = -1e9, goal = null;
      const push = (gx, gy, mag, play) => {
        if (!goal || goal.x !== gx || goal.y !== gy || t - pathAt > 250) { path = nav.findPath(pip().x, pip().y, gx, gy); pathAt = t; goal = { x: gx, y: gy }; }
        while (path.length > 1 && Math.hypot(path[0].x - pip().x, path[0].y - pip().y) < 12) path.shift();
        // On the last leg Pip heads for the exact spot (a pocket's back is off the grid's free cells).
        const w = path.length > 1 ? path[0] : { x: gx, y: gy };
        const d = Math.hypot(w.x - pip().x, w.y - pip().y) || 1;
        s.joystick.vector.set(((w.x - pip().x) / d) * mag, ((w.y - pip().y) / d) * mag);
        s.trumpetOverride = !!play;
      };
      const stopMoving = () => { s.joystick.vector.set(0, 0); s.trumpetOverride = false; };
      // Each primitive returns false when the run is over (caught or timed out).
      const over = () => s.finished || t > 150000;
      const walk = (x, y, { mag = 0.6, play = false, r = 14, until = null, maxMs = 40000 } = {}) => {
        const t0 = t; goal = null;
        while (!over() && Math.hypot(x - pip().x, y - pip().y) > r && t - t0 < maxMs) {
          if (until && until()) break;
          push(x, y, mag, play); frame();
        }
        stopMoving();
        return !over();
      };
      const wait = (ms, { play = false } = {}) => { const t0 = t; stopMoving(); s.trumpetOverride = play; while (!over() && t - t0 < ms) frame(); s.trumpetOverride = false; return !over(); };
      const waitUntil = (cond, maxMs = 20000) => { const t0 = t; stopMoving(); while (!over() && !cond() && t - t0 < maxMs) frame(); return !over() && cond(); };
      const teunNear = (d = 70) => dist(pip(), teun()) <= d;
      const officers = s.officers;
      const looking = (o) => o.state === 'looking';
      // Where is an officer facing east/west at x, to time a crossing of the middle line.
      const facingAway = (o, px) => (o.x > px + 20 && Math.cos(o.facing) > 0.5) || (o.x < px - 20 && Math.cos(o.facing) < -0.5);

      const fail = (why) => ({ outcome: 'script', stage: why, t });
      const result = () => {
        if (s.finished) {
          const atFinish = pip().x >= L.finish.x && pip().x <= L.finish.x + L.finish.width && pip().y >= L.finish.y && pip().y <= L.finish.y + L.finish.height;
          const info = officers.map((o, i) => `${i}:${o.state}@${Math.round(o.x)},${Math.round(o.y)}`).join(' ') + ` pip ${Math.round(pip().x)},${Math.round(pip().y)} teun ${Math.round(teun().x)},${Math.round(teun().y)} ${teun().mode}`;
          return { outcome: atFinish ? 'done' : 'caught', stage: stage + (trace ? ' [' + info + ']' : ''), t };
        }
        return { outcome: 'timeout', stage, t };
      };

      // The crossing in plaza B and the mid plaza: wait south of it until the officer has just passed the middle and faces away.
      const cross = (oi, yBefore, yAfter, label) => {
        stage = label + ' approach';
        if (!walk(270, yBefore)) return false;
        if (!waitUntil(() => teunNear(80) && facingAway(officers[oi], 270) && Math.abs(officers[oi].x - 270) < 90, 30000)) return false;
        stage = label + ' cross';
        return walk(270, yAfter, { r: 20 }) && waitUntil(() => teunNear(60), 8000);
      };

      if (plan === 'lead') {
        if (!cross(0, 2100, 1900, 'O1')) return result();
        stage = 'gate 1';
        if (!walk(270, 1760)) return result();
        if (!waitUntil(() => teunNear(60), 8000)) return result();
        if (!walk(270, 1420)) return result();
        stage = 'mid plaza';
        if (!walk(270, 1150)) return result();
        stage = 'gate 2';
        if (!walk(270, 630)) return result();
        stage = 'final';
        if (!walk(270, 250)) return result();
        walk(270, 40, { r: 10 });
        return result();
      }

      // park: gate 1 parks Teun in the west pocket and lures from the east one; gate 2 the other way round.
      const gate = (name, lane, pocketTeun, pocketLure, officersCalled) => {
        stage = name + ' park';
        // Pip walks into the pocket's back, so Teun stops inside it.
        const side = pocketTeun.x < 270 ? 1 : -1;
        if (!walk(pocketTeun.x, pocketTeun.y, { r: 8 })) return false;
        if (!waitUntil(() => dist(teun(), pip()) < 60 && Math.hypot(teun().x - pocketTeun.x, teun().y - pocketTeun.y) < 70, 8000)) return false;
        teun().setMode('wait');
        const tWait = t;
        stage = name + ' lure';
        // Out of the pocket and across, playing the whole way (half speed): the meter fills as he arrives.
        if (!walk(pocketLure.x, pocketLure.y, { mag: 1, play: true, r: 10, maxMs: 9000 })) return false;
        stage = name + ' lure wait';
        // Keep playing until the alert goes out (the officers' "?" appears), then come back at once.
        { const t0 = t; while (!over() && !officersCalled.some((i) => officers[i].state === 'going') && t - t0 < 7000) { s.joystick.vector.set(0, 0); s.trumpetOverride = true; frame(); } s.trumpetOverride = false; }
        if (over() || !officersCalled.some((i) => officers[i].state === 'going')) return false;
        stage = name + ' back';
        if (!walk(pocketTeun.x + side * 40, pocketTeun.y, { mag: 1, r: 25 })) return false;
        if (t - tWait > s.teun.restlessMs * 0.92) return false; // Teun would drum
        teun().setMode('follow');
        stage = name + ' wait for the officers';
        if (!waitUntil(() => officers.some(looking) && !officers.some((o) => o.state === 'going'), 16000)) return false;
        stage = name + ' lane';
        if (!walk(270, lane.south, { r: 20 })) return false;
        if (!waitUntil(() => teunNear(70), 6000)) return false;
        return walk(270, lane.north, { r: 20 }) && waitUntil(() => teunNear(70), 6000);
      };
      if (!cross(0, 2100, 1900, 'O1')) return result();
      if (!gate('gate 1', { south: 1715, north: 1430 }, { x: 80, y: 1825 }, { x: 460, y: 1825 }, [0, 1])) return result();
      stage = 'mid plaza';
      if (!walk(270, 1150)) return result();
      if (!gate('gate 2', { south: 915, north: 630 }, { x: 460, y: 1055 }, { x: 80, y: 1055 }, [2, 1])) return result();
      stage = 'final';
      if (!walk(270, 250)) return result();
      walk(270, 40, { r: 10 });
      return result();
    }
  }, [args.starts ?? 12, args.every ?? 2000, args.only ? String(args.only).split(',') : ['lead', 'park'], !!args.trace]);
  console.log(out.join('\n'));
});
