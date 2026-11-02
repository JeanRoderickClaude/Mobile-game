// Moving barricades (chapter 6): push-out, the teaching stretch, the heavy barricades and officer routing.
// Usage: node tools/barricades.mjs src/levels/level-06.json [--difficulty easy] [--runs 12] [--eager]
// --eager: the whole-level bot walks straight to the nearer gap and waits in front of it, instead of waiting out of the way.
import { parseArgs, run } from './lib.mjs';

const args = parseArgs();
await run(args._[0], async (page) => {
  const out = await page.evaluate(async ([runs, eager]) => {
    const R = {};
    const PR = 16.25;
    const overlap = (x, y, r) => x + PR > r.x && x - PR < r.x + r.width && y + PR > r.y && y - PR < r.y + r.height;
    const stepper = (s) => (n = 1) => { for (let i = 0; i < n; i++) s.update(0, 16); };
    const snap = (s) => s.barricades.snapshot();
    const timedIdx = (s) => snap(s).map((b, i) => (b.kind === 'timed' ? i : -1)).filter((i) => i >= 0);

    // 1. Push-out: stand in each timed barricade's band while it closes. Pip must end clear of every blocker.
    {
      const rows = [];
      let s = await window.__restart();
      const idxs = timedIdx(s);
      for (const i of idxs) {
        s = await window.__restart();
        s.officers.length = 0;
        const step = stepper(s);
        const full = snap(s)[i].full;
        const items = s.barricades.items;
        const it = items[i];
        // Jump the clock to just before the warning starts, then stand in the bar's path.
        s.barricades.clock = it.openMs - (it.data.phaseMs ?? 0) + 5 * it.period - 100;
        step();
        s.player.x = full.x + full.width / 2 + 3; s.player.y = full.y + full.height / 2 + 2;
        let maxPush = 0, stuck = 0, crushed = 0;
        const y0 = s.player.y;
        for (let t = 0; t < 4500; t += 16) {
          step();
          maxPush = Math.max(maxPush, Math.abs(s.player.y - y0), Math.abs(s.player.x - (full.x + full.width / 2 + 3)));
          if (s.blockers.some((b) => overlap(s.player.x, s.player.y, b) && !s.barricades.ghost.has(b))) crushed++;
        }
        const finalOverlap = s.blockers.some((b) => overlap(s.player.x, s.player.y, b));
        const phase = snap(s)[i].phase;
        rows.push({ i, phase, pushedUnits: Math.round(maxPush), overlapAtEnd: finalOverlap, framesInsideSolid: crushed });
      }
      R.push = rows;
    }

    // 2. Teaching stretch, y 2600 to 1700. A careful bot waits for open bars; a reckless one walks straight at full speed.
    {
      const rows = [];
      for (const mode of ['careful', 'reckless']) for (let k = 0; k < runs; k++) {
        const s = await window.__restart();
        s.officers.length = 0;
        const step = stepper(s);
        s.barricades.clock = k * 1700; // different start phases
        let t = 0, maxWait = 0, wait = 0, shoves = 0;
        while (s.player.y > 1650 && t < 120000) {
          const bars = snap(s);
          const ahead = bars.filter((b, i) => i < 4 && b.full.y + b.full.height < s.player.y + 20 && b.full.y + b.full.height > s.player.y - 140).sort((a, b) => b.full.y - a.full.y)[0];
          let go = true;
          if (mode === 'careful' && ahead && s.player.y - (ahead.full.y + ahead.full.height) < 110) go = ahead.phase === 'open' && ahead.openLeftMs > 900;
          s.joystick.vector.set(0, go ? -1 : 0);
          // steer to x 270
          s.player.x += (270 - s.player.x) * 0.2;
          const before = s.player.y;
          step(); t += 16;
          if (go && before - s.player.y < 0.5) { wait += 16; maxWait = Math.max(maxWait, wait); } else wait = 0;
          if (s.barricades.ghost.size) shoves++;
          if (s.finished) break;
        }
        rows.push({ mode, start: k * 1700, reachedPlaza: s.player.y <= 1650, timeSec: +(t / 1000).toFixed(1), longestStuckMs: maxWait, framesShoved: shoves });
      }
      R.teach = rows;
    }

    // 3. Heavy barricades. Alone: Pip leans on H1 for 60 s. With the crowd: ride crowd 0 through it.
    {
      let s = await window.__restart();
      s.officers.length = 0;
      let step = stepper(s);
      s.player.x = 270; s.player.y = 1330;
      s.crowds.forEach((c) => (c.active = false));
      s.crowds.forEach((c) => c.despawn?.(1e9, false));
      s.joystick.vector.set(0, -1);
      let minY = 9999;
      for (let t = 0; t < 60000; t += 16) { step(); minY = Math.min(minY, s.player.y); }
      const h1 = snap(s).find((b) => b.kind === 'heavy');
      R.heavyAlone = { minYReached: Math.round(minY), h1Phase: h1.phase, blockedByBar: minY > 1250 + 12 };

      const rides = [];
      for (let k = 0; k < runs; k++) {
        s = await window.__restart();
        step = stepper(s);
        const g = s.crowds[0];
        s.player.x = 270; s.player.y = 1620;
        let t = 0, spawns = g.active ? 1 : 0;
        while (!(spawns === (k % 4) + 1 && g.active) && t < 1e6) { const was = g.active; step(); t += 16; s.suspicion = 0; s.player.x = 270; s.player.y = 1620; if (!was && g.active) spawns++; }
        s.suspicion = 0;
        s.player.x = g.x; s.player.y = g.y + 20;
        let peak = 0, outcome = 'timeout', halted = 0, openAt = null, passedAt = null;
        const t0 = t;
        for (; t < t0 + 40000; t += 16) {
          const dx = g.x - s.player.x, dy = g.y - s.player.y, d = Math.hypot(dx, dy) || 1;
          const cap = Math.max(g.speed * 1.05, 40) / 170, mag = Math.min(cap, (d / 10) * cap);
          s.joystick.vector.set((dx / d) * mag, (dy / d) * mag);
          step();
          if (g.halted) halted += 16;
          if (openAt === null && snap(s).find((b) => b.kind === 'heavy').closed === 0) openAt = t - t0;
          if (s.suspicion > peak) peak = s.suspicion;
          if (s.player.y < 1200 && passedAt === null) passedAt = t - t0;
          if (s.officers.some((o) => o.chasing)) { outcome = 'chased'; break; }
          if (s.finished) { outcome = 'caught'; break; }
          if (!g.active) { outcome = passedAt !== null ? 'through' : 'group vanished first'; break; }
        }
        rides.push({ k, outcome, peakMs: Math.round(peak), crowdHaltedMs: halted, barricadeOpenAfterMs: openAt, passedAfterMs: passedAt });
      }
      R.heavyRide = rides;
    }

    // 4. Routing: an officer on one side of the divider wall walks to Pip on the other side.
    {
      const rows = [];
      const s = await window.__restart();
      const step = stepper(s);
      const o = s.officers[0];
      for (let k = 0; k < 8; k++) {
        s.barricades.clock = k * 1000;
        step();
        const nav = o.constructor.nav;
        const bars = snap(s);
        const gaps = bars.map((b, i) => ({ i, b })).filter((e) => e.b.kind === 'timed' && Math.abs(e.b.full.y - 638) < 5);
        const path = nav.findPath(270, 760, 270, 520);
        // A path is valid when none of its legs crosses a bar the grid counts closed.
        const crossing = (a, b) => gaps.filter((e) => e.b.phase !== 'open' && Math.min(a.x, b.x) < e.b.full.x + e.b.full.width && Math.max(a.x, b.x) > e.b.full.x && Math.min(a.y, b.y) < e.b.full.y + e.b.full.height && Math.max(a.y, b.y) > e.b.full.y).length;
        let bad = 0, prev = { x: 270, y: 760 };
        for (const p of path) { bad += crossing(prev, p); prev = p; }
        const via = path.find((p) => p.y < 700 && p.y > 600);
        rows.push({ clockMs: k * 1000, phases: gaps.map((e) => e.b.phase), pathLegs: path.length, throughGapAtX: via ? Math.round(via.x) : null, legsCrossingClosedBar: bad });
      }
      R.routing = rows;
      // The grid's version moves when a bar changes state.
      R.navVersion = o.constructor.nav.version;
    }
    // 5. The whole level: a bot that waits for open bars, rides both crowds and crosses the divider wall at an open gap. Blind to the cones.
    {
      const rows = [];
      for (let k = 0; k < runs; k++) {
        const s = await window.__restart();
        const step = stepper(s);
        s.barricades.clock = (k * 1700) % 8300;
        let t = 0, stage = 0, outcome = 'timeout', where = null, gap = null, ridden = 0;
        const go = (tx, ty, mag = 1) => { const dx = tx - s.player.x, dy = ty - s.player.y, d = Math.hypot(dx, dy) || 1; s.joystick.vector.set((dx / d) * Math.min(1, mag), (dy / d) * Math.min(1, mag)); };
        const ride = (g) => { const dx = g.x - s.player.x, dy = g.y - s.player.y, d = Math.hypot(dx, dy) || 1; const cap = Math.max(g.speed * 1.05, 40) / 170, mag = Math.min(cap, (d / 10) * cap); s.joystick.vector.set((dx / d) * mag, (dy / d) * mag); };
        const idle = k * 700;
        while (t < 240000) {
          const bars = snap(s);
          if (t < idle) s.joystick.vector.set(0, 0);
          else if (stage === 0) {
            const ahead = bars.filter((b, i) => i < 4 && b.full.y + b.full.height < s.player.y + 20 && b.full.y + b.full.height > s.player.y - 140).sort((a, b) => b.full.y - a.full.y)[0];
            let ok = true;
            if (ahead && s.player.y - (ahead.full.y + ahead.full.height) < 110) ok = ahead.phase === 'open' && ahead.openLeftMs > 900;
            if (ok) go(270, 1500); else s.joystick.vector.set(0, 0);
            if (s.player.y < 1600) stage = 1;
          } else if (stage === 1) {
            const g = s.crowds[0];
            if (!g.active || g.y > 1610) { go(270, 1620, 0.5); if (Math.hypot(s.player.x - 270, s.player.y - 1620) < 8) s.joystick.vector.set(0, 0); }
            else { ride(g); ridden++; }
            if (g.active && g.y < 1560 && s.player.y < 1500) stage = 2;
          } else if (stage === 2) {
            const g = s.crowds[0];
            if (g.active) ride(g);
            else { stage = 3; }
          } else if (stage === 3) {
            // From the crowd's end, pick an open gap.
            const t1 = bars[5], t2 = bars[6];
            const good = (b) => b.phase === 'open' && b.openLeftMs > 1800;
            if (gap === null) { if (eager) gap = t1.phase === 'open' || (t2.phase !== 'open' && t1.closed <= t2.closed) ? 'a' : 'b'; else if (good(t1)) gap = 'a'; else if (good(t2)) gap = 'b'; }
            const wait = { x: 270, y: 820 };
            if (gap === null) go(wait.x, wait.y, 0.5);
            else {
              const gx = gap === 'a' ? 200 : 340;
              const open = bars[gap === 'a' ? 5 : 6];
              const clear = open.phase === 'open' && open.openLeftMs > 600;
              if (s.player.y > 700 || !clear) go(gx, 700, s.player.y > 700 ? 1 : 0); else go(gx, 590);
              if (s.player.y < 600) stage = 4;
            }
          } else if (stage === 4) {
            const g = s.crowds[1];
            if (!g.active || g.y < 560 || g.y > 600) { go(270, 600, 0.5); if (Math.hypot(s.player.x - 270, s.player.y - 600) < 10) s.joystick.vector.set(0, 0); }
            else ride(g);
            if (g.active && g.y < 570 && Math.hypot(g.x - s.player.x, g.y - s.player.y) < 60) stage = 5;
          } else if (stage === 5) {
            const g = s.crowds[1];
            if (g.active) ride(g); else go(270, 40);
          }
          step(); t += 16;
          if (s.officers.some((o) => o.chasing) && where === null) where = { x: Math.round(s.player.x), y: Math.round(s.player.y), stage };
          if (s.finished) { outcome = s.suspicion >= s.catchTimeMs || where ? 'caught' : 'finished'; break; }
        }
        rows.push({ k, outcome, timeSec: +(t / 1000).toFixed(1), firstChase: where, stageAtEnd: stage });
      }
      R.full = rows;
    }
    return R;
  }, [args.runs ?? 8, !!args.eager]);

  console.log('PUSH-OUT (stand in the bar as it closes):');
  for (const r of out.push) console.log(`  bar ${r.i}: pushed ${r.pushedUnits} units, overlapping a solid at the end: ${r.overlapAtEnd}, frames inside a solid that did not shove: ${r.framesInsideSolid}, phase after 4.5 s ${r.phase}`);
  console.log('\nTEACHING STRETCH (y 2600 to 1700):');
  for (const mode of ['careful', 'reckless']) {
    const rows = out.teach.filter((r) => r.mode === mode);
    const t = rows.map((r) => r.timeSec);
    console.log(`  ${mode}: ${rows.filter((r) => r.reachedPlaza).length} of ${rows.length} reached the plaza, time ${Math.min(...t)} to ${Math.max(...t)} s (median ${t.sort((a, b) => a - b)[Math.floor(t.length / 2)]}), longest stuck ${Math.max(...rows.map((r) => r.longestStuckMs))} ms, frames shoved ${rows.reduce((a, r) => a + r.framesShoved, 0)}`);
  }
  console.log('\nHEAVY BARRICADE H1:');
  console.log(`  alone, 60 s pushing north: nearest y ${out.heavyAlone.minYReached} (bar at 1250), still closed: ${out.heavyAlone.h1Phase === 'closed'}, held back: ${out.heavyAlone.blockedByBar}`);
  for (const r of out.heavyRide) console.log(`  ride ${r.k}: ${r.outcome}, peak suspicion ${r.peakMs} ms, crowd stood pushing ${r.crowdHaltedMs} ms, bar open after ${r.barricadeOpenAfterMs} ms, Pip past it after ${r.passedAfterMs} ms`);
  const through = out.heavyRide.filter((r) => r.outcome === 'through').length;
  console.log(`  ${through} of ${out.heavyRide.length} crowd rides got through unseen.`);
  console.log('\nWHOLE LEVEL (waits for open bars, rides both crowds, blind to cones):');
  for (const r of out.full) console.log(`  start ${r.k}: ${r.outcome} after ${r.timeSec} s${r.firstChase ? `, chase began at ${r.firstChase.x},${r.firstChase.y} (stage ${r.firstChase.stage})` : ''}, stage ${r.stageAtEnd}`);
  const done = out.full.filter((r) => r.outcome === 'finished');
  console.log(`  ${done.length} of ${out.full.length} finished${done.length ? `, median ${done.map((r) => r.timeSec).sort((a, b) => a - b)[Math.floor(done.length / 2)]} s` : ''}.`);
  console.log('\nROUTING (officer at 270,760 to a point at 270,520, across the divider wall):');
  for (const r of out.routing) console.log(`  clock ${r.clockMs} ms: gaps ${r.phases.join(' / ')}, path ${r.pathLegs} legs via x ${r.throughGapAtX}, legs through a closed bar: ${r.legsCrossingClosedBar}`);
});
