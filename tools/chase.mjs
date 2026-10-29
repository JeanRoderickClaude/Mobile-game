// Chase levels: how often does a player who has just been spotted get away?
// For each start time the level runs with officers at a different point of their routes. Pip
// waits unseen at the start, is then placed at the spot and spotted (the nearest officer starts
// chasing and the others join as the level's rules say), and one of two players takes over:
//   run:  runs in the open at full speed, to the far end of the level and back, whatever happens.
//   hide: runs to the nearest spot behind a building, out of every officer's view (and on for the finish if
//         that does not lose them) until the chasers have lost him (a search begins), then runs to where the
//         marching crowd will be (a point on its route he reaches first, 150 or more from where he was
//         seen), falls in with it and walks to the finish inside it at its pace.
// Both follow a navigation grid like the officers'. The level does not end at the finish. A run ends
// when Pip is caught (a chasing officer touches him) or after 60 s. "Got away" means the chase and
// search ended, every officer back on patrol, with Pip not caught.
// Usage:
//   node tools/chase.mjs src/levels/dev/practice-chase.json [--starts 23] [--every 1500]
//        [--spot 245,1140] [--case] [--flags vanTagged] [--difficulty easy] [--hold] [--speed 1.1] [--react 400] [--join 1500] [--ahead 3] [--spread 70] [--search 8000] [--drain 4] [--recover 8] [--rest 2] [--tired 0.6] [--alert 300] [--pursuit 3000] [--only flee,hide] [--why]
// --dark 0 stops the hide player from using dark pockets (he then only rides the crowd).
// --case makes Pip carry Ruby's case (chapter 4: slower, drains stamina faster). --flags a,b starts the level with those story flags true.
// --speed, --react and --join override the difficulty's chaseSpeedFactor, chaseReactMs and chaseJoinMs
//         for this run, to try values before putting them in config.ts.
// Several players run one after another, each in a fresh browser. --hold adds a player who just stands still where he was spotted.
// --trace hide,5 prints a line every 500 ms for one run (policy, start number).
// --shots dir --trace hide,5 also saves screenshots of that run at the spot, when a search begins, when the
//         officers are back on patrol, and every 4 s in between (needs a trace).
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
const spot = String(args.spot ?? '245,1140').split(',').map(Number);
const starts = args.starts ?? 23;
const every = args.every ?? 1500;

// Several players: each runs in its own browser and server, so nothing carries over from one to the next.
const wanted = args.only ? String(args.only).split(',') : args.hold ? ['run', 'flee', 'hide', 'hold'] : ['run', 'flee', 'hide'];
if (wanted.length > 1 && !args.trace) {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const raw = process.argv.slice(2);
  const rest = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--only') { i++; continue; }
    rest.push(raw[i]);
  }
  wanted.forEach((p, i) => {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...rest, '--only', p], { encoding: 'utf8', maxBuffer: 1 << 26 });
    // The first child's header (difficulty and values) is kept; later ones repeat it.
    process.stdout.write(r.stdout.split('\n').filter((l, n) => i === 0 || (!l.startsWith('Difficulty') && !l.startsWith('chase speed'))).join('\n'));
    if (r.stderr) process.stderr.write(r.stderr);
  });
  process.exit(0);
}

await run(args._[0], async (page) => {
  if (args.shots) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(String(args.shots), { recursive: true });
    await page.setViewportSize({ width: 540, height: 960 });
    await page.exposeFunction('__snap', async (name) => { await page.waitForTimeout(120); await page.screenshot({ path: `${args.shots}/${name}.png` }); });
  }
  const out = await page.evaluate(async ([spot, starts, every, hold, traceArg, over, difficulty]) => {
    const { DIFFICULTIES } = await import('/Mobile-game/src/config.ts');
    const cfg = DIFFICULTIES[difficulty];
    if (over.speed !== undefined) cfg.chaseSpeedFactor = over.speed;
    if (over.react !== undefined) cfg.chaseReactMs = over.react;
    if (over.join !== undefined) cfg.chaseJoinMs = over.join;
    if (over.ahead !== undefined) cfg.searchAheadSec = over.ahead;
    if (over.spread !== undefined) cfg.searchSpread = over.spread;
    if (over.max !== undefined) cfg.searchAheadMax = over.max;
    if (over.alert !== undefined) cfg.chaseAlertRadius = over.alert;
    if (over.pursuit !== undefined) cfg.chasePursuitMs = over.pursuit;
    if (over.search !== undefined) cfg.searchMs = over.search;
    if (over.drain !== undefined) cfg.staminaDrainSec = over.drain;
    if (over.recover !== undefined) cfg.staminaRecoverSec = over.recover;
    if (over.rest !== undefined) cfg.staminaRestFactor = over.rest;
    if (over.tired !== undefined) cfg.staminaTiredFactor = over.tired;
    const used = `chase speed ${cfg.chaseSpeedFactor} x Pip, react ${cfg.chaseReactMs} ms, join ${cfg.chaseJoinMs} ms, pursuit ${cfg.chasePursuitMs} ms, search ${cfg.searchMs} ms, stamina ${cfg.staminaDrainSec} s drain / ${cfg.staminaRecoverSec} s recover / x${cfg.staminaRestFactor} resting / tired speed ${cfg.staminaTiredFactor}, ahead ${cfg.searchAheadSec} s (max ${cfg.searchAheadMax}), spread ${cfg.searchSpread}`;
    let trace = false;
    const lines = [];
    const STEP = 16;
    const snap = async (name) => { if (window.__snap) await window.__snap(name); };
    const s0 = window.__scene;
    // Pip walks the same kind of grid as the officers, with a wider margin: his body is wider than theirs.
    const { NavGrid } = await import('/Mobile-game/src/systems/nav.ts');
    const nav = new NavGrid(s0.level.width, s0.level.height, s0.level.obstacles, 20);
    const L = s0.level;
    if (!L.chaseMode) return ['This level has no "chaseMode": true.'];

    const finish0 = { x: L.finish.x + L.finish.width / 2, y: L.finish.y + 40 };
    async function attempt(policy, delay) {
      const s = await window.__restart();
      // The level must not end at the finish: what is measured is whether the chase ends with Pip free.
      s.level.finish = { x: -5000, y: -5000, width: 1, height: 1 };
      // --case: Pip carries Ruby's case from the start (at the back exit, within reach of it).
      if (over.case) s.setCarrying(true);
      // Wait unseen at the start while the officers and the crowd move on.
      for (let t = 0; t < delay; t += STEP) {
        s.player.x = L.start.x; s.player.y = L.start.y;
        s.update(0, STEP);
        s.suspicion = 0;
      }
      s.player.x = spot[0]; s.player.y = spot[1];
      // The spot: the nearest officer begins the chase; the scene's rules do the rest.
      const o = [...s.officers].sort((a, b) => Math.hypot(a.x - spot[0], a.y - spot[1]) - Math.hypot(b.x - spot[0], b.y - spot[1]))[0];
      o.beginChase(spot[0], spot[1], o.constructor.rules.reactMs);
      s.chaseLastX = spot[0]; s.chaseLastY = spot[1]; s.chaseLostMs = 0;
      let shotSpot = false, shotSearch = false;
      const wasSearching = [];
      let closeCall = false, noticed = false, minHidden = Infinity;
      let dark = null, darkAt = -1e9, runTo = finish0, path = [], pathAt = -1e9, sawSearch = false, chaseEndedAt = null, peakChasers = 0, meet = null, meetAt = -1e9, pocketAt = -1e9, fleeAt = -1e9, fleeTarget = null, lostThem = false, pocket = null, atPocket = false;
      const finish = finish0;
      const goTo = (t, gx, gy, push) => {
        if (t - pathAt > 200) { path = nav.findPath(s.player.x, s.player.y, gx, gy); pathAt = t; }
        while (path.length && Math.hypot(path[0].x - s.player.x, path[0].y - s.player.y) < 12) path.shift();
        const w = path[0] ?? { x: gx, y: gy };
        const dx = w.x - s.player.x, dy = w.y - s.player.y, d = Math.hypot(dx, dy) || 1;
        s.joystick.vector.set((dx / d) * push, (dy / d) * push);
      };
      const pathLen = (ax, ay, bx, by, avoid = 130, withSearchers = false) => {
        const p = nav.findPath(ax, ay, bx, by);
        if (!p.length) return Infinity;
        let len = 0, px = ax, py = ay;
        for (const q of p) {
          // A sensible player does not run past an officer who is not already after him to get to cover.
          for (let f = 0; f <= 1; f += 0.1) {
            const x = px + (q.x - px) * f, y = py + (q.y - py) * f;
            if (s.officers.some((k) => (withSearchers || (!k.chasing && !k.searching)) && !k.chasing && Math.hypot(k.x - x, k.y - y) < avoid)) return Infinity;
            // Walking to the crowd, he also keeps out of the view of officers who are not after him: a straight line to
            // one within the range he is seen at (shorter in the dark) is a risk he does not take.
            if (withSearchers && s.officers.some((k) => !k.chasing && Math.hypot(k.x - x, k.y - y) < k.data.visionRange * k.constructor.rangeFactorAt(x, y) * 1.05 && nav.clear(k.x, k.y, x, y))) return Infinity;
          }
          len += Math.hypot(q.x - px, q.y - py); px = q.x; py = q.y;
        }
        return len;
      };
      // The nearest point behind a building, out of every officer's view, that can be reached without
      // running past an officer who is not already after him; at least minAway from where he stands.
      const findPocket = (minAway) => {
        let best = Infinity, found = null;
        for (let y = s.player.y - 450; y <= s.player.y + 450; y += 30) {
          for (let x = 30; x <= L.width - 30; x += 30) {
            if (!nav.isFree(x, y) || Math.hypot(x - s.player.x, y - s.player.y) < minAway || s.officers.some((k) => nav.clear(k.x, k.y, x, y))) continue;
            const len = pathLen(s.player.x, s.player.y, x, y);
            if (len < best) { best = len; found = { x, y }; }
          }
        }
        return found;
      };
      // Dark pocket: the nearest unlit spot (searchers only notice a player in the dark within the close range) that no
      // officer has a line of sight to, reached without crossing the view of an officer who is not after him.
      const findDark = () => {
        let best = Infinity, found = null;
        for (let y = s.player.y - 420; y <= s.player.y + 420; y += 30) {
          for (let x = 30; x <= L.width - 30; x += 30) {
            if (!nav.isFree(x, y) || s.officers[0].constructor.rangeFactorAt(x, y) >= 1) continue;
            if (s.officers.some((k) => Math.hypot(k.x - x, k.y - y) < 160 || (Math.hypot(k.x - x, k.y - y) < 260 && nav.clear(k.x, k.y, x, y)))) continue;
            // Not near where he was seen (the chasers run there first, and the search starts there).
            if (Math.hypot(x - s.chaseLastX, y - s.chaseLastY) < 100) continue;
            // ...nor on the line he was running along: the chasers keep running that way for a while after losing sight of him.
            const hx = s.chaseDirX, hy = s.chaseDirY;
            if (hx || hy) {
              const t = Math.max(0, Math.min(700, (x - s.chaseLastX) * hx + (y - s.chaseLastY) * hy));
              if (Math.hypot(x - (s.chaseLastX + hx * t), y - (s.chaseLastY + hy * t)) < 70) continue;
            }
            const len = pathLen(s.player.x, s.player.y, x, y, 130, true);
            if (len < best) { best = len; found = { x, y, len }; }
          }
        }
        return found;
      };
      // The smart runner's step (also the first half of the hide player): every 300 ms pick the point he can reach
      // well before the nearest pursuer, out of their sight, not past an officer who is not already after him.
      const fleeStep = (t) => {
        // A human fleeing: every 300 ms pick the point he can reach well before the nearest pursuer, out of
        // their sight, not past an officer who is not already after him; he turns at corners and changes
        // direction to break sight, and keeps going away from the nearest pursuer.
        if (t - fleeAt > 300) {
          fleeAt = t;
          const pursuers = s.officers.filter((k) => k.chasing || k.searching);
          let bestScore = -Infinity, best = null;
          // First keep clear of every officer who is not after him yet (a cone reaches about 230); if that leaves
          // nowhere to go, only of the ones within 130.
          for (const avoid of [240, 130]) {
          if (best) break;
          if (pursuers.length) {
            for (let y = s.player.y - 420; y <= s.player.y + 420; y += 50) {
              for (let x = 30; x <= L.width - 30; x += 50) {
                if (!nav.isFree(x, y)) continue;
                const len = pathLen(s.player.x, s.player.y, x, y, avoid);
                if (!Number.isFinite(len) || len < 60) continue;
                let margin = Infinity, seen = false;
                for (const k of pursuers) {
                  margin = Math.min(margin, Math.hypot(k.x - x, k.y - y) / 1.08);
                  if (nav.clear(k.x, k.y, x, y)) seen = true;
                }
                let score = Math.min(margin - len, 250) - (seen ? 120 : 0) - 0.1 * len;
                if (fleeTarget && Math.hypot(fleeTarget.x - x, fleeTarget.y - y) < 40) score += 40;
                if (score > bestScore) { bestScore = score; best = { x, y }; }
              }
            }
          }
          }
          fleeTarget = best;
        }
        if (fleeTarget) goTo(t, fleeTarget.x, fleeTarget.y, 1); else s.joystick.vector.set(0, 0);
      };
      // Where to meet the crowd: a point on its route that Pip can reach before it does, at least 150
      // from the spot where he was seen (the officers go there first), by walking distance and speed.
      const meetPoint = (c) => {
        const route = [{ x: c.x, y: c.y }, ...c.data.path.slice(c.leg)];
        let along = 0, best = null;
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1], b = route[i], len = Math.hypot(b.x - a.x, b.y - a.y);
          for (let d = 0; d < len; d += 30) {
            const q = { x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len };
            const crowdEta = (along + d) / c.speed;
            const pipEta = pathLen(s.player.x, s.player.y, q.x, q.y, 130, true) / (s.tired ? 102 : s.carrying ? 144 : 170);
            if (Math.hypot(q.x - s.chaseLastX, q.y - s.chaseLastY) < 200) continue;
            if (pipEta + 0.3 <= crowdEta) return q;
            best = q;
          }
          along += len;
        }
        return best;
      };
      if (trace) lines.push(`  pocket ${pocket ? pocket.x + ',' + pocket.y : 'none'}`);
      for (let t = 0; t < 60000 && !s.finished; t += STEP) {
        if (policy === 'run') {
          // Keeps running in the open: to the far end and back again, never stopping.
          if (Math.hypot(runTo.x - s.player.x, runTo.y - s.player.y) < 60) runTo = runTo === finish ? L.start : finish;
          goTo(t, runTo.x, runTo.y, 1);
        }
        else if (policy === 'flee') fleeStep(t);
        else if (policy === 'hold') s.joystick.vector.set(0, 0);
        else {
          const c = s.crowds.filter((k) => k.active && k.speed > 0).sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y))[0];
          // Until the chasers have lost him (a search has begun) he flees like the smart runner, but a dark pocket he reaches
          // well before any chaser (out of everyone's sight, off the way they run) is better than running on: he goes in and stands still.
          if (!lostThem && s.officers.some((k) => k.searching)) lostThem = true;
          if (over.dark !== false && t - darkAt > 400) {
            darkAt = t;
            dark = findDark();
            if (dark) {
              const myEta = dark.len / (s.tired ? 102 : s.carrying ? 144 : 170);
              const theirs = Math.min(Infinity, ...s.officers.filter((k) => k.chasing).map((k) => Math.hypot(k.x - dark.x, k.y - dark.y) / 184));
              if (!lostThem && myEta + 0.2 > theirs) dark = null;
            }
          }
          const inPocket = dark && Math.hypot(dark.x - s.player.x, dark.y - s.player.y) <= 14;
          if (dark && (lostThem ? (!c || dark.len < 700) : dark.len < 450)) {
            if (!inPocket) goTo(t, dark.x, dark.y, dark.len < 120 ? 0.6 : 1); else s.joystick.vector.set(0, 0);
          }
          else if (!lostThem) fleeStep(t);
          else if (!c) s.joystick.vector.set(0, 0); // no crowd on the street just now: wait
          else if (Math.hypot(c.x - s.player.x, c.y - s.player.y) > 45) {
            if (t - meetAt > 500) { meet = meetPoint(c); meetAt = t; }
            // Slows to crowd pace (60 percent) on the last stretch, so he is hidden the moment he is in it.
            const near = Math.hypot(c.x - s.player.x, c.y - s.player.y) < 100;
            if (meet) goTo(t, near ? c.x : meet.x, near ? c.y : meet.y, near ? 0.6 : 1); else s.joystick.vector.set(0, 0);
          } else {
            // In the crowd: three-quarter push along its heading, nudged toward its centre (the pace assist does the rest).
            const dx = c.headingX + (c.x - s.player.x) * 0.02, dy = c.headingY + (c.y - s.player.y) * 0.02, d = Math.hypot(dx, dy) || 1;
            s.joystick.vector.set((dx / d) * 0.75, (dy / d) * 0.75);
          }
        }
        s.update(0, STEP);
        if (trace && t % 480 === 0) lines.push(`  t=${t} pip ${Math.round(s.player.x)},${Math.round(s.player.y)} spd ${Math.round(s.playerSpeed)} st ${s.stamina.toFixed(2)}${s.tired ? "T" : ""} ${s.hidden ? 'HIDDEN' : ''}${lostThem ? ' lost-them' : ''} pocket ${dark ? Math.round(dark.x) + ',' + Math.round(dark.y) + '/' + Math.round(dark.len) : '-'} | ` + s.officers.map((k, i) => `${i}:${k.chasing ? 'C' : k.searching ? 'S' : k.alerted ? 'r' : '.'}@${Math.round(k.x)},${Math.round(k.y)} d${Math.round(Math.hypot(k.x - s.player.x, k.y - s.player.y))}`).join(' ') + ` crowd ${s.crowds[0].active ? Math.round(s.crowds[0].x) + ',' + Math.round(s.crowds[0].y) : '-'}`);
        const chasers = s.officers.filter((k) => k.chasing).length;
        peakChasers = Math.max(peakChasers, chasers);
        if (trace && !shotSpot) { shotSpot = true; await snap('1-spotted'); }
        if (trace && !shotSearch && s.officers.some((k) => k.searching)) { shotSearch = true; await snap('2-searching'); }
        if (trace && t > 0 && t % 4000 === 0) await snap(`3-t${t / 1000}s`);
        if (s.officers.some((k) => k.searching)) sawSearch = true;
        // A searching officer within 80 units of a hidden Pip: did he notice him (take up the chase again)?
        for (const [i, k] of s.officers.entries()) {
          const was = wasSearching[i];
          wasSearching[i] = k.searching;
          if (was && k.chasing && over.why) lines.push(`  t=${t} officer ${i} took up the chase: dist ${Math.round(Math.hypot(k.x - s.player.x, k.y - s.player.y))} hidden ${s.hidden} speed ${Math.round(s.playerSpeed)} others chasing ${s.officers.filter((j, n) => n !== i && j.chasing).length} suspicion ${Math.round(s.suspicion)}`);
          if (s.hidden && k.searching) minHidden = Math.min(minHidden, Math.hypot(k.x - s.player.x, k.y - s.player.y));
          if (s.hidden && (k.searching || (was && k.chasing)) && Math.hypot(k.x - s.player.x, k.y - s.player.y) <= 80) {
            closeCall = true;
            if (was && k.chasing) noticed = true;
          }
        }
        if (chaseEndedAt === null && t > 1000 && s.officers.every((k) => !k.chasing && !k.searching)) chaseEndedAt = t;
        if (chaseEndedAt !== null) { if (trace) await snap('4-back-on-patrol'); break; } // the chase is over with Pip free: that is the measure
      }
      const caught = s.finished;
      return { minHidden, closeCall, noticed, caught, free: !caught && chaseEndedAt !== null, end: `${Math.round(s.player.x)},${Math.round(s.player.y)}`, time: s.elapsedMs - delay, sawSearch, chaseEndedAt, peakChasers, at: caught ? `${Math.round(s.player.x)},${Math.round(s.player.y)}` : null };
    }

    if (traceArg) {
      const [pol, i] = String(traceArg).split(',');
      lines.push(`trace of "${pol}" at start ${Number(i) * every} ms:`);
      trace = true;
      const r = await attempt(pol, Number(i) * every);
      lines.push(`  result: ${r.caught ? 'caught at ' + r.at : r.free ? 'got away' : 'still chased'}`);
      return lines;
    }
    lines.push(used);
    const policies = (over.only ? String(over.only).split(',') : hold ? ['run', 'flee', 'hide', 'hold'] : ['run', 'flee', 'hide']);
    const names = { flee: 'smart runner (turns at corners, breaks sight, flees the nearest chaser)', run: 'keeps running in a straight line', hide: 'breaks sight, then hides in the crowd', hold: 'stands still where spotted' };
    for (const p of policies) {
      const rows = [];
      for (let i = 0; i < starts; i++) rows.push(await attempt(p, i * every));
      const esc = rows.filter((r) => r.free);
      const searched = rows.filter((r) => r.sawSearch).length;
      const ended = rows.filter((r) => r.chaseEndedAt !== null);
      const avgPeak = rows.reduce((a, r) => a + r.peakChasers, 0) / rows.length;
      const caughtN = rows.filter((r) => r.caught).length;
      const close = rows.filter((r) => r.closeCall);
      lines.push(`${names[p]}: got away ${esc.length} of ${rows.length}, caught ${caughtN}, still chased or searched for after 60 s ${rows.length - esc.length - caughtN}; searches began in ${searched}` +
        (ended.length ? `; chase over after avg ${(ended.reduce((a, r) => a + r.chaseEndedAt, 0) / ended.length / 1000).toFixed(1)} s` : '') + `; most officers chasing at once ${avgPeak.toFixed(1)} on average` +
        (p === 'hide' ? `; a searching officer came within 80 of him while hidden in ${close.length} runs, and noticed him in ${close.filter((r) => r.noticed).length}` : ''));
      if (over.why && p === 'hide') lines.push('  hide runs (got away / caught): closest searcher while hidden: ' + rows.map((r) => `${r.free ? 'ok' : 'X'}:${r.minHidden === Infinity ? '-' : Math.round(r.minHidden)}`).join(' '));
      const caught = rows.filter((r) => r.caught).map((r) => r.at);
      if (caught.length) lines.push(`  caught at: ${caught.join(' ')}`);
    }
    return lines;
  }, [spot, starts, every, !!args.hold, args.trace ?? null, { speed: args.speed, react: args.react, join: args.join, ahead: args.ahead, max: args.max, alert: args.alert, pursuit: args.pursuit, drain: args.drain, recover: args.recover, rest: args.rest, tired: args.tired, only: args.only, case: !!args.case, dark: args.dark === 0 ? false : undefined, spread: args.spread, search: args.search, why: !!args.why }, args.difficulty ?? 'normal']);
  out.forEach((l) => console.log(l));
});
