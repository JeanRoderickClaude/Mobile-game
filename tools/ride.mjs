// Ride every marching group from spawn to finish, over several cycles.
// Usage: node tools/ride.mjs src/levels/level-01.json [--cycles 12] [--assist] [--difficulty easy]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
await run(args._[0], async (page) => {
  const rows = await page.evaluate(async ([cycles, assist]) => {
    const out = [];
    let s = window.__scene;
    const groups = s.crowds.map((c, i) => i).filter((i) => s.crowds[i].data.type === 'marching');
    for (const gi of groups) for (let cycle = 0; cycle < cycles; cycle++) {
      s = await window.__restart();
      const g = s.crowds[gi];
      const step = () => s.update(0, 16);
      // Fast-forward to this cycle's spawn with the player parked at the start, meter held at zero.
      let t = 0, spawns = g.active ? 1 : 0;
      s.player.x = s.level.start.x; s.player.y = s.level.start.y;
      while (!(spawns === cycle + 1 && g.active) && t < 1e6) {
        const before = g.active; step(); t += 16; s.suspicion = 0;
        if (!before && g.active) spawns++;
      }
      const startSec = t / 1000;
      s.player.x = g.x; s.player.y = g.y; s.suspicion = 0;
      let peak = 0, peakAt = null, outcome = 'timeout';
      const run = {}, longest = {};
      while (t < 2e6) {
        if (assist) {
          // A casual thumb: three quarters push along the group's heading, nudged toward its centre. The pace assist does the rest.
          const hx = g.headingX + (g.x - s.player.x) / 100, hy = g.headingY + (g.y - s.player.y) / 100, h = Math.hypot(hx, hy) || 1;
          s.joystick.vector.set((hx / h) * 0.75, (hy / h) * 0.75);
        } else {
          // Steer toward the group centre, never faster than its pace (+5%).
          const dx = g.x - s.player.x, dy = g.y - s.player.y, d = Math.hypot(dx, dy) || 1;
          const cap = (g.speed * 1.05) / 170, mag = Math.min(cap, (d / 10) * cap);
          s.joystick.vector.set((dx / d) * mag, (dy / d) * mag);
        }
        step(); t += 16;
        s.officers.forEach((o, i) => {
          run[i] = o.canSee(s.player.x, s.player.y, s.blockers) ? (run[i] || 0) + 16 : 0;
          if (run[i]) longest[i] = Math.max(longest[i] || 0, run[i]);
        });
        if (s.suspicion > peak) { peak = s.suspicion; peakAt = [Math.round(s.player.x), Math.round(s.player.y)]; }
        if (s.finished) { outcome = s.suspicion >= s.catchTimeMs ? 'CAUGHT' : 'finished'; break; }
        if (!g.active) { outcome = 'group vanished'; break; }
      }
      out.push({
        cap: s.catchTimeMs,
        group: gi, cycle, startSec, outcome, peak: Math.round(peak), peakAt, longest,
        coins: s.runCoins, bonus: s.bonus, timeSec: s.elapsedMs / 1000,
      });
    }
    return out;
  }, [args.cycles ?? 12, !!args.assist]);
  for (const r of rows) {
    const seen = Object.entries(r.longest).map(([i, ms]) => `#${i} ${ms}ms`).join(', ') || 'none';
    const pay = r.outcome === 'finished' ? `${r.timeSec.toFixed(1)}s, ${r.coins} coins + ${r.bonus} bonus` : `${r.coins} coins lost`;
    console.log(`crowd ${r.group} cycle ${String(r.cycle).padStart(2)} (spawn ${r.startSec.toFixed(1)}s): ${r.outcome.padEnd(8)} peak ${String(r.peak).padStart(3)}ms at ${r.peakAt ?? '-'} | ${pay} | longest sighting by officer: ${seen}`);
  }
  const ok = rows.filter((r) => r.outcome === 'finished').length;
  console.log(`\n${ok} of ${rows.length} rides survived. Worst peak ${Math.max(...rows.map((r) => r.peak))}ms (caught at ${rows[0].cap}).`);
  for (const g of [...new Set(rows.map((r) => r.group))]) {
    const won = rows.filter((r) => r.group === g && r.outcome === 'finished').map((r) => r.coins + r.bonus);
    if (won.length) console.log(`crowd ${g}: earned ${Math.min(...won)}-${Math.max(...won)} coins per finished ride, ${won[0]} when joining its first group.`);
  }
});
