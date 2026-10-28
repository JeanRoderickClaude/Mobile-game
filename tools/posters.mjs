// Night levels with posters: walk a plan through poster spots (and tag spots),
// standing still at each until the game counts it done, then go to the finish.
// Blind: it does not watch the cones, so results show how risky each spot is.
// Usage:
//   node tools/posters.mjs src/levels/level-03.json [--starts 20] [--every 1500] [--difficulty easy]
//        [--plans "dark4,all,dark4+tags"] [--dark "0,1,3,5"] [--light]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
const plans = String(args.plans ?? 'dark4,all,dark4+tags').split(',');
const starts = args.starts ?? 20;
const every = args.every ?? 1500;

await run(args._[0], async (page) => {
  const out = await page.evaluate(async ([plans, starts, every, darkArg, lightReport]) => {
    const lines = [];
    const STEP = 16;
    const s0 = window.__scene;
    const L = s0.level;
    const Off = s0.officers[0]?.constructor;
    const spots = L.posters?.spots ?? [];
    const tags = L.tags ?? [];
    if (!spots.length) return ['This level has no poster spots.'];

    // How exposed each spot is: lit or dark, and how much of 60 s some officer can see it.
    const exposure = spots.map(() => 0);
    {
      const s = await window.__restart();
      for (let t = 0; t < 60000; t += 100) {
        for (let k = 0; k < 100; k += STEP) s.update(0, STEP);
        s.suspicion = 0;
        spots.forEach((p, i) => { if (s.officers.some((o) => o.canSee(p.x, p.y, s.blockers))) exposure[i] += 100; });
      }
    }
    const lit = (p) => Off.lit(p.x, p.y);
    spots.forEach((p, i) => lines.push(`poster ${i} at ${p.x},${p.y} (${p.wall} wall): ${lit(p) ? 'LIT' : 'dark'}, seen ${(exposure[i] / 600).toFixed(0)}% of 60 s`));
    if (lightReport) return lines;

    // The four darkest: unlit first, then least seen (or --dark "i,j,k,l").
    const order = spots.map((p, i) => i).sort((a, b) => (lit(spots[a]) - lit(spots[b])) || exposure[a] - exposure[b]);
    const dark = darkArg ? String(darkArg).split(',').map(Number) : order.slice(0, L.posters.required);

    function plan(name) {
      const idx = name.startsWith('all') ? spots.map((_, i) => i) : dark;
      const stops = idx.map((i) => ({ ...spots[i], kind: 'poster' }));
      if (name.includes('+tags')) for (const t of tags) stops.push({ x: t.x, y: t.y, kind: 'tag' });
      // Walk bottom to top.
      return stops.sort((a, b) => b.y - a.y);
    }

    async function attempt(stops, delay) {
      const s = await window.__restart();
      for (let t = 0; t < delay; t += STEP) { s.player.x = s.level.start.x; s.player.y = s.level.start.y; s.update(0, STEP); s.suspicion = 0; }
      const goals = [...stops, { x: s.level.finish.x + s.level.finish.width / 2, y: s.level.finish.y + 40, kind: 'finish' }];
      let gi = 0, stuck = 0, side = 0, peak = 0;
      for (let t = 0; t < 150000 && !s.finished; t += STEP) {
        const g = goals[gi];
        const dx = g.x - s.player.x, dy = g.y - s.player.y, d = Math.hypot(dx, dy);
        const task = g.kind !== 'finish' && s.spots.tasks.find((k) => k.x === g.x && k.y === g.y);
        if (task && d < 8) {
          s.joystick.vector.set(0, 0);
          if (task.done) gi++;
        } else if (side > 0) {
          side -= STEP;
          s.joystick.vector.set(-1, 0); // step sideways round a blocker
        } else {
          s.joystick.vector.set(dx / d, dy / d);
        }
        const bx = s.player.x, by = s.player.y;
        s.update(0, STEP);
        peak = Math.max(peak, s.suspicion);
        const moved = Math.hypot(s.player.x - bx, s.player.y - by);
        stuck = !task || d >= 8 ? (moved < 0.5 ? stuck + STEP : 0) : 0;
        if (stuck > 300) { side = 500; stuck = 0; }
      }
      const ok = s.finished && s.suspicion < s.catchTimeMs;
      return { ok, time: s.elapsedMs - delay, coins: s.runCoins, posters: s.spots.postersDone, at: ok ? null : `${Math.round(s.player.x)},${Math.round(s.player.y)}` };
    }

    lines.push(`four darkest: posters ${dark.join(', ')}`);
    for (const name of plans) {
      const stops = plan(name);
      const rows = [];
      for (let i = 0; i < starts; i++) rows.push(await attempt(stops, i * every));
      const ok = rows.filter((r) => r.ok);
      const avg = (k) => (ok.length ? ok.reduce((a, r) => a + r[k], 0) / ok.length : 0);
      lines.push(`${name}: ${ok.length} of ${rows.length} survived` + (ok.length ? `, avg ${(avg('time') / 1000).toFixed(1)} s, avg ${avg('coins').toFixed(0)} coins` : ''));
      const fails = rows.filter((r) => !r.ok).map((r) => r.at);
      if (fails.length) lines.push(`  caught at: ${fails.join(' ')}`);
    }
    return lines;
  }, [plans, starts, every, args.dark ?? null, !!args.light]);
  out.forEach((l) => console.log(l));
});
