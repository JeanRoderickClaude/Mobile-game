// Walk each marching group's path alone (no hiding) from many start times.
// Usage: node tools/blind.mjs src/levels/level-01.json [--every 1500] [--until 33000]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
await run(args._[0], async (page) => {
  const rows = await page.evaluate(async ([every, until]) => {
    const out = [];
    const paths = window.__scene.level.crowds.filter((c) => c.type === 'marching').map((c) => c.path);
    for (const [ri, path] of paths.entries()) for (const speed of [1, 0.6]) {
      let ok = 0, n = 0;
      for (let delay = 0; delay <= until; delay += every) {
        const s = await window.__restart();
        s.crowds.forEach((c) => (c.contains = () => false)); // alone: crowds never hide the player
        s.player.x = s.level.start.x; s.player.y = s.level.start.y;
        for (let t = 0; t < delay; t += 16) { s.update(0, 16); s.suspicion = 0; }
        s.player.x = path[0].x; s.player.y = path[0].y; s.suspicion = 0;
        let wp = 1;
        for (let t = 0; t < 120000 && !s.finished; t += 16) {
          const g = path[wp], dx = g.x - s.player.x, dy = g.y - s.player.y, d = Math.hypot(dx, dy) || 1;
          if (d < 8 && wp < path.length - 1) wp++;
          s.joystick.vector.set((dx / d) * speed, (dy / d) * speed);
          s.update(0, 16);
        }
        n++; if (s.finished && s.suspicion < s.catchTimeMs) ok++;
      }
      out.push(`route of crowd ${ri}, alone at ${speed * 100}% speed: ${ok} of ${n} start times survived`);
    }
    return out;
  }, [args.every ?? 1500, args.until ?? 33000]);
  rows.forEach((r) => console.log(r));
});
