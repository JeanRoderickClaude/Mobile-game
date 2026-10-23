// Scan the level for spots where standing still alone gets you caught but
// standing in a crowd would not: good places for standing groups.
// Usage: node tools/spots.mjs src/levels/level-01.json [--grid 30] [--seconds 90] [--max-peak 300]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
await run(args._[0], async (page) => {
  const rows = await page.evaluate(([grid, seconds, maxPeak]) => {
    const s = window.__scene, B = s.level.obstacles, pts = [];
    for (let y = grid; y < s.level.height - grid; y += grid) for (let x = grid; x < s.level.width - grid; x += grid) {
      if (B.some((b) => x + 20 > b.x && x - 20 < b.x + b.width && y + 20 > b.y && y - 20 < b.y + b.height)) continue;
      pts.push({ x, y, alone: 0, group: 0, pa: 0, pg: 0 });
    }
    for (let t = 0; t < seconds * 1000; t += 50) {
      s.officers.forEach((o) => o.update(50));
      for (const q of pts) {
        const seen = s.officers.some((o) => o.canSee(q.x, q.y, B));
        q.alone = seen ? q.alone + 50 : Math.max(0, q.alone - 100);
        q.group = seen ? q.group + 12.5 : Math.max(0, q.group - 100);
        q.pa = Math.max(q.pa, q.alone); q.pg = Math.max(q.pg, q.group);
      }
    }
    return pts.filter((q) => q.pa >= 500 && q.pg < maxPeak).map((q) => `${q.x},${q.y}: caught alone, peak ${Math.round(q.pg)}ms in a group`);
  }, [args.grid ?? 30, args.seconds ?? 90, args['max-peak'] ?? 300]);
  console.log(rows.length ? rows.join('\n') : 'No spot is deadly alone and safe in a group.');
});
