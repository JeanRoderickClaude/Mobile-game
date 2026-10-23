// Shared setup for the balance tools: start Vite, open the game in headless
// Chromium, and load one level. Each tool calls run(levelFile, fn).
import { readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Index of a level file in play order (file-name order, as src/levels/index.ts sorts them). */
function levelIndex(file) {
  const files = readdirSync(resolve(root, 'src/levels')).filter((f) => f.endsWith('.json')).sort();
  const i = files.indexOf(basename(file));
  if (i < 0) throw new Error(`${file} is not in src/levels/. Levels: ${files.join(', ')}`);
  return i;
}

/** Positional arguments and --flags (--name value, or --name alone for true). */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { args._.push(argv[i]); continue; }
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = Number.isNaN(Number(next)) ? next : Number(next); i++; }
  }
  return args;
}

/**
 * Start a Vite dev server, open the game and load the level, then call
 * fn(page). The page has window.__scene (the GameScene) and
 * window.__restart() to reload the level fresh, paused for manual stepping.
 */
export async function run(levelFile, fn) {
  if (!levelFile) throw new Error('Pass a level file, for example src/levels/level-01.json');
  const index = levelIndex(levelFile);
  const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false, host: '127.0.0.1' } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
    await page.evaluate((levelIndex) => {
      window.__restart = async () => {
        const s = window.game.scene.getScene('game');
        const old = s.player;
        s.scene.restart({ levelIndex });
        // create() has run once a new player object exists.
        while (s.player === old || !s.sys.isActive()) await new Promise((r) => setTimeout(r, 10));
        s.scene.pause();
        window.__scene = s;
        return s;
      };
    }, index);
    await page.evaluate(() => window.__restart());
    await fn(page);
    if (errors.length) console.log('Page errors:', errors);
  } finally {
    await browser.close();
    await server.close();
  }
}
