// Ride every marching group from spawn to finish, over several cycles.
// Usage: node tools/ride.mjs src/levels/level-01.json [--cycles 12]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
await run(args._[0], async (page) => {
  const rows = await page.evaluate(async (cycles) => {
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
        // Steer toward the group centre, never faster than its pace (+5%).
        const dx = g.x - s.player.x, dy = g.y - s.player.y, d = Math.hypot(dx, dy) || 1;
        const cap = (g.speed * 1.05) / 170, mag = Math.min(cap, (d / 10) * cap);
        s.joystick.vector.set((dx / d) * mag, (dy / d) * mag);
        step(); t += 16;
        s.officers.forEach((o, i) => {
          run[i] = o.canSee(s.player.x, s.player.y, s.blockers) ? (run[i] || 0) + 16 : 0;
          if (run[i]) longest[i] = Math.max(longest[i] || 0, run[i]);
        });
        if (s.suspicion > peak) { peak = s.suspicion; peakAt = [Math.round(s.player.x), Math.round(s.player.y)]; }
        if (s.finished) { outcome = s.suspicion >= 500 ? 'CAUGHT' : 'finished'; break; }
        if (!g.active) { outcome = 'group vanished'; break; }
      }
      out.push({ group: gi, cycle, startSec, outcome, peak: Math.round(peak), peakAt, longest });
    }
    return out;
  }, args.cycles ?? 12);
  for (const r of rows) {
    const seen = Object.entries(r.longest).map(([i, ms]) => `#${i} ${ms}ms`).join(', ') || 'none';
    console.log(`crowd ${r.group} cycle ${String(r.cycle).padStart(2)} (spawn ${r.startSec.toFixed(1)}s): ${r.outcome.padEnd(8)} peak ${String(r.peak).padStart(3)}ms at ${r.peakAt ?? '-'} | longest sighting by officer: ${seen}`);
  }
  const ok = rows.filter((r) => r.outcome === 'finished').length;
  console.log(`\n${ok} of ${rows.length} rides survived. Worst peak ${Math.max(...rows.map((r) => r.peak))}ms (caught at 500).`);
});
