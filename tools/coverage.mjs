// Picture of how often each spot is inside some vision cone. Green: never
// seen; red: seen, darker means more of the time.
// Usage: node tools/coverage.mjs src/levels/level-01.json coverage.png [--seconds 60]
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
const out = args._[1] ?? 'coverage.png';
await run(args._[0], async (page) => {
  await page.evaluate((seconds) => {
    const s = window.__scene, B = s.level.obstacles, C = 20;
    const W = Math.ceil(s.level.width / C), H = Math.ceil(s.level.height / C), cnt = new Float32Array(W * H);
    let steps = 0;
    for (let t = 0; t < seconds * 1000; t += 100, steps++) {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (s.officers.some((o) => o.canSee(i * C + 10, j * C + 10, B))) cnt[j * W + i]++;
      for (let k = 0; k < 2; k++) s.officers.forEach((o) => o.update(50));
    }
    const g = s.add.graphics().setDepth(98);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = i * C + 10, y = j * C + 10;
      if (B.some((b) => x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height)) continue;
      const f = cnt[j * W + i] / steps;
      g.fillStyle(f === 0 ? 0x00ff00 : 0xff0000, f === 0 ? 0.5 : Math.min(0.9, 0.15 + f * 2)).fillRect(i * C, j * C, C, C);
    }
    const cam = s.cameras.main; cam.stopFollow(); cam.removeBounds(); cam.setZoom(960 / s.level.height); cam.centerOn(s.level.width / 2, s.level.height / 2);
    s.finished = true; s.scene.resume();
  }, args.seconds ?? 60);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  console.log(`Coverage map written to ${out}.`);
});
