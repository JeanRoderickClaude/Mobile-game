// Stand still at each standing group's centre, in the group and alone.
// Usage: node tools/stand.mjs src/levels/level-01.json [--seconds 90]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
await run(args._[0], async (page) => {
  const rows = await page.evaluate(async (seconds) => {
    const out = [];
    const crowds = window.__scene.level.crowds;
    for (const [i, c] of crowds.entries()) if (c.type === 'standing') for (const alone of [false, true]) {
      const s = await window.__restart();
      if (alone) s.crowds.forEach((g) => (g.contains = () => false));
      s.player.x = c.x; s.player.y = c.y;
      let peak = 0, t = 0;
      for (; t < seconds * 1000 && !s.finished; t += 16) { s.update(0, 16); peak = Math.max(peak, s.suspicion); }
      const result = s.finished ? `CAUGHT after ${(t / 1000).toFixed(1)}s` : `survived ${seconds}s`;
      out.push(`crowd ${i} at ${c.x},${c.y} ${alone ? 'alone   ' : 'in group'}: ${result}, peak ${Math.round(peak)}ms`);
    }
    return out;
  }, args.seconds ?? 90);
  rows.forEach((r) => console.log(r));
});
