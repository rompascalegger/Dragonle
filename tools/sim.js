/*
 * Balancing simulation for Dragonle.
 *   node tools/sim.js [hours] [seed]      or open tools/sim.html?args=hours,seed
 * A simple bot buys Cheap eggs, incubates, pairs, collects and sells.
 * Output per hour: gold, population per faction, wars, materials.
 */
'use strict';
(function () {
  const inNode = typeof require === 'function' && typeof window === 'undefined';
  if (inNode) {
    const path = require('path');
    require(path.join(__dirname, '..', 'config.js'));
    require(path.join(__dirname, '..', 'core.js'));
  }
  const G = globalThis.Dragonle;
  const args = inNode ? process.argv.slice(2) : (new URLSearchParams(location.search).get('args') || '').split(',');
  const hours = +(args[0] || 4);
  const seed = +(args[1] || 12345);
  const out = [];
  const log = t => { out.push(t); if (inNode) console.log(t); };
  G.init(seed);
  const S = () => G.S;

  // check the clutch distribution (spec section 7.1)
  {
    const counts = new Array(13).fill(0); const N = 200000;
    for (let i = 0; i < N; i++) counts[G._rollClutch('test').z]++;
    S().logs.rolls = [];
    const mean = counts.reduce((s, c, z) => s + c * z, 0) / N;
    log('Clutch: E[z] = ' + mean.toFixed(3) + ' (target 2.036)  P(0) = ' + (counts[0] / N * 100).toFixed(1) + ' %  P(1) = ' + (counts[1] / N * 100).toFixed(1) + ' %');
  }

  const dt = 0.5;
  let wars = 0, eggsBought = 0;
  for (let t = 0; t < hours * 3600; t += dt) {
    G.tick(dt);
    for (const e of G.drain()) if (e.type === 'warResult') wars++;
    if (t % 5 !== 0) continue;
    const s = S();
    for (const id in s.zones) { const z = s.zones[id]; if (!G.zoneOpen(z)) continue; z.ground.slice().forEach(sc => { if (G.canCollect(sc)) G.collect(id, sc.id); }); }
    G.sellAllScales();
    for (const id in s.zones) s.zones[id].inc.forEach(x => { if (typeof x === 'number' && s.dragons[x] && s.dragons[x].ready) G.hatch(x); });
    for (const id in s.zones) {
      const z = s.zones[id]; if (!G.zoneOpen(z)) continue;
      while (z.inc.slice(0, z.slots).some(x => x == null)) {
        let egg = s.chamber.find(i => s.dragons[i]);
        if (egg == null) { const r = G.buyEgg('cheap'); if (!r.ok) break; eggsBought++; egg = r.egg.id; }
        if (!G.incubate(egg, id).ok) break;
      }
      if (s.gold > G.slotPrice(z) * 3) G.buySlot(id);
    }
    const cands = G.list(d => G.canPairCandidate(d) && !s.nests.some(n => n && (n.a === d.id || n.b === d.id)));
    s.nests.forEach((n, i) => {
      if (n) return;
      for (let a = 0; a < cands.length; a++) for (let b = a + 1; b < cands.length; b++) {
        if (s.nests[i]) return;
        if (G.setPair(i, cands[a].id, cands[b].id).ok) { cands.splice(b, 1); cands.splice(a, 1); return; }
      }
    });
    for (let f = 0; f < G.NE; f++) if (s.access[f]) (s.offers[f] || []).forEach((o, i) => { if (!o.done && G.ACTI[o.id].group === 'neutral') G.doActivity(f, i); });
    if (t % 3600 === 0 && t > 0) report(t / 3600);
  }
  report(hours);

  function report(h) {
    const s = S();
    const pop = G.EL.map((e, f) => e.name.slice(0, 4) + ':' + G.adultsOf(f).length).join(' ');
    const mats = Object.values(s.collection).reduce((n, o) => n + Object.values(o).reduce((a, b) => a + b, 0), 0);
    const reps = G.EL.map((e, f) => s.access[f] ? e.name.slice(0, 4) + '=' + G.REPL[G.repLevel(f)].name.slice(0, 5) : '').filter(Boolean).join(' ');
    log(`--- hour ${h}: gold ${Math.round(s.gold)} (earned ${s.stats.gold}), hatched ${s.stats.hatched} (duds ${s.stats.duds}), eggs bought ${eggsBought}, wars ${wars}, materials ${mats}, scales ${s.stats.scales}`);
    log('    population ' + pop + ' | ruler ' + G.EL[s.ruler].name + ' | pupils ' + G.list(d => d.status === 'school').length + ' | wild young ' + G.list(d => d.status === 'wild').length);
    log('    reputation ' + reps + ' | portals open ' + Object.values(s.zones).filter(z => z.unlocked).length + ' | school rep ' + s.schoolRep);
  }
  if (!inNode) { const pre = document.getElementById('out'); if (pre) pre.textContent = out.join('\n'); window.SIM_OUT = out; }
})();
