/*
 * Dragonle – game logic (no DOM, also runs in Node for the balancing simulation).
 * All numbers come from config.js.
 */
(function (root) {
  'use strict';
  const C = root.DRAGONLE_CONFIG;
  const EL = C.elements;
  const NE = EL.length;
  const STEPS = C.vector.steps;
  const EI = {};
  EL.forEach((e, i) => { EI[e.id] = i; });
  const REPL = C.rep.levels;
  const REPI = {};
  REPL.forEach((l, i) => { REPI[l.id] = i; });
  const CLS = {};
  C.eggClasses.forEach((c, i) => { CLS[c.id] = Object.assign({ idx: i }, c); });

  let S = null;
  let events = [];
  function emit(type, data) { events.push(Object.assign({ type }, data || {})); }

  // ------------------------------------------------------------ Randomness (seedable, Mulberry32)
  function R() {
    let t = (S.rng = (S.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(R() * arr.length)]; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function weighted(ws) { let s = 0; for (const w of ws) s += w; let r = R() * s; for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) return i; } return ws.length - 1; }
  function pickWeightedKey(obj) { const keys = Object.keys(obj); return keys[weighted(keys.map(k => obj[k]))]; }
  function logRoll(label, value, range) {
    S.logs.rolls.unshift({ t: Math.round(S.played), label, value, range });
    if (S.logs.rolls.length > 300) S.logs.rolls.length = 300;
  }
  function logEvent(text, kind) {
    S.logs.events.unshift({ t: Math.round(S.played), text, kind: kind || 'info' });
    if (S.logs.events.length > 200) S.logs.events.length = 200;
  }

  // ------------------------------------------------------------ Helpers
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const enemyOf = i => i ^ 1;
  const isEnemy = (a, b) => (a ^ 1) === b;
  function now() { return Date.now() / 1000 + S.worldOffset; }
  function ageOf(d) { return (d.status === 'adult' || d.status === 'exile') && d.t1000 != null ? C.time.adultAge + (now() - d.t1000) : d.age; }
  function strength(d) { return Math.exp(-(ageOf(d) - C.time.adultAge) / C.war.tau); }
  function dominants(v) { let m = -1; const out = []; for (let i = 0; i < NE; i++) { if (v[i] > m) { m = v[i]; out.length = 0; out.push(i); } else if (v[i] === m) out.push(i); } return out; }
  function dominant(v) { return dominants(v)[0]; }
  function isPure(v) { return v.some(n => n === STEPS); }
  function hasEnemyPair(v) { for (let i = 0; i < NE; i += 2) if (v[i] > 0 && v[i + 1] > 0) return true; return false; }
  function present(v) { const o = []; for (let i = 0; i < NE; i++) if (v[i] > 0) o.push(i); return o; }
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(c) { return '#' + c.map(x => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join(''); }
  function mixColor(v) { const c = [0, 0, 0]; for (let i = 0; i < NE; i++) if (v[i]) { const r = hexToRgb(EL[i].color); for (let k = 0; k < 3; k++) c[k] += r[k] * v[i] / STEPS; } return rgbToHex(c); }
  function towards(x, t, rate) { return x + (t - x) * Math.min(1, rate); }
  function name() { const n = C.names; return pick(n.a) + pick(n.b) + (R() < 0.6 ? pick(n.c) : ''); }
  function vecText(v) { return present(v).sort((a, b) => v[b] - v[a]).map(i => Math.round(v[i] * 100 / STEPS) + ' % ' + EL[i].name).join(' · '); }

  // ------------------------------------------------------------ Reputation
  function repLevel(f) { const r = S.rep[f]; let idx = 0; for (let i = 0; i < REPL.length; i++) if (r >= REPL[i].min) idx = i; return idx; }
  function repAtLeast(f, id) { return repLevel(f) >= REPI[id]; }
  function setRepRaw(f, value) {
    const before = repLevel(f);
    S.rep[f] = clamp(value, C.rep.floor, C.rep.cap);
    const after = repLevel(f);
    if (after !== before && S.access[f]) {
      emit('repLevel', { f, from: before, to: after, up: after > before });
      logEvent(EL[f].name + ': reputation ' + REPL[after].name, after > before ? 'good' : 'bad');
    }
  }
  // change reputation; spread = transfer through the relationship matrix
  function addRep(f, delta, spread) {
    setRepRaw(f, S.rep[f] + delta);
    if (spread !== false) {
      for (let b = 0; b < NE; b++) {
        if (b === f) continue;
        const d = delta * (S.rel[b][f] / 100) * C.rep.transfer;
        if (Math.abs(d) >= 0.5) setRepRaw(b, S.rep[b] + d);
      }
    }
  }

  // ------------------------------------------------------------ Relations & alliances
  function allied(a, b) {
    if (a === b || isEnemy(a, b)) return false;
    const T = C.relations.allianceThreshold;
    return S.rel[a][b] >= T && S.rel[b][a] >= T;
  }
  function allies(a) { const o = []; for (let b = 0; b < NE; b++) if (allied(a, b)) o.push(b); return o; }
  function allianceName(a, b) { const [x, y] = a < b ? [a, b] : [b, a]; return EL[x].pre + EL[y].suf; }
  function allianceColor(a, b) { const v = new Array(NE).fill(0); v[a] = 10; v[b] = 10; return mixColor(v); }
  function alliances() { const o = []; for (let a = 0; a < NE; a++) for (let b = a + 1; b < NE; b++) if (allied(a, b)) o.push({ a, b, name: allianceName(a, b), color: allianceColor(a, b) }); return o; }

  // ------------------------------------------------------------ Generating vectors
  function compatible(i, chosen) { return !chosen.includes(i) && !chosen.some(c => isEnemy(c, i)); }
  function randomCompatible(chosen) { const opts = []; for (let i = 0; i < NE; i++) if (compatible(i, chosen)) opts.push(i); return opts.length ? pick(opts) : -1; }
  function spread(v, els, units) { for (let u = 0; u < units; u++) v[pick(els)]++; }
  function genVector(cls) {
    const v = new Array(NE).fill(0);
    if (cls === 'cheap') {
      const k = ri(2, 4); const els = [];
      for (let i = 0; i < k; i++) { const e = randomCompatible(els); if (e >= 0) els.push(e); }
      els.forEach(e => { v[e] = 1; });
      spread(v, els, STEPS - els.length);
      return v;
    }
    if (cls === 'pure') { v[ri(0, NE - 1)] = STEPS; return v; }
    if (cls === 'rare') {
      const al = alliances();
      if (R() < 0.5 || !al.length) {
        if (R() < 0.5) { const p = ri(0, NE / 2 - 1) * 2; v[p] = 10; v[p + 1] = 10; return v; }
        const a = ri(0, NE - 1); const b = randomCompatible([a]); v[a] = 10; v[b] = 10; return v;
      }
      const p = pick(al); v[p.a] = 10; v[p.b] = 10; return v;
    }
    const min = CLS[cls].minShare;
    const d = ri(0, NE - 1);
    v[d] = ri(min, STEPS - 1);
    const els = []; const n = ri(1, 2);
    for (let i = 0; i < n; i++) { const e = randomCompatible([d].concat(els)); if (e >= 0) els.push(e); }
    spread(v, els, STEPS - v[d]);
    return v;
  }
  function classify(v) {
    if (isPure(v)) return 'pure';
    const top = Math.max.apply(null, v);
    if (hasEnemyPair(v)) return 'rare';
    const p = present(v);
    if (p.length === 2 && v[p[0]] === 10 && allied(p[0], p[1])) return 'rare';
    if (top >= CLS.noble.minShare) return 'noble';
    if (top >= CLS.common.minShare) return 'common';
    return 'cheap';
  }

  // ------------------------------------------------------------ Inheritance
  function inherit(a, b) {
    const pa = a.v, pb = b.v;
    const da = dominant(pa), db = dominant(pb);
    if (isPure(pa) && isPure(pb) && da === db) { const v = new Array(NE).fill(0); v[da] = STEPS; return { v, mutated: false, shifts: 0 }; }
    const v = new Array(NE).fill(0); const odd = [];
    for (let i = 0; i < NE; i++) { const s = pa[i] + pb[i]; v[i] = Math.floor(s / 2); if (s % 2) odd.push(i); }
    shuffle(odd);
    for (let i = 0; i < odd.length / 2; i++) v[odd[i]]++;
    const shifts = ri(0, C.breed.shiftMax);
    for (let s = 0; s < shifts; s++) {
      const p = present(v); if (p.length < 2) break;
      const from = pick(p); const to = pick(p.filter(x => x !== from));
      v[from]--; v[to]++;
    }
    let mutated = false;
    if (R() < C.breed.mutationChance) {
      const absent = []; for (let i = 0; i < NE; i++) if (!v[i]) absent.push(i);
      if (absent.length) { const e = pick(absent); const top = dominant(v); v[top]--; v[e]++; mutated = e; }
    }
    return { v, mutated, shifts };
  }
  function inheritPreview(a, b) {
    const pa = a.v, pb = b.v;
    if (isPure(pa) && isPure(pb) && dominant(pa) === dominant(pb)) return { pure: true, el: dominant(pa), ranges: [{ el: dominant(pa), min: STEPS, max: STEPS }], mutation: 0 };
    const ranges = [];
    for (let i = 0; i < NE; i++) {
      const s = pa[i] + pb[i]; if (!s) continue;
      const lo = Math.floor(s / 2), hi = Math.ceil(s / 2);
      ranges.push({ el: i, min: Math.max(0, lo - C.breed.shiftMax), max: Math.min(STEPS, hi + C.breed.shiftMax) });
    }
    ranges.sort((x, y) => y.max - x.max);
    return { pure: false, ranges, mutation: C.breed.mutationChance };
  }

  // ------------------------------------------------------------ Clutch [FIXED]
  function rollClutch(tag) {
    const a = ri(0, C.breed.gateMax);
    logRoll(tag + ' gate roll', a, '0–' + C.breed.gateMax);
    if (a === 0) return { a, x: 0, y: 0, z: 0 };
    const x = ri(1, C.breed.xMax); logRoll(tag + ' roll x', x, '1–' + C.breed.xMax);
    const y = ri(1, x); logRoll(tag + ' roll y', y, '1–' + x);
    const z = ri(1, y); logRoll(tag + ' roll z', z, '1–' + y);
    return { a, x, y, z };
  }

  // ------------------------------------------------------------ Dragons
  function newDragon(o) {
    const d = Object.assign({
      id: S.nextId++, v: null, mat: 0, status: 'egg', age: 0, seed: Math.floor(R() * 1e9),
      name: name(), parents: null, owned: true, zone: null, faction: null, war: false,
      shimmer: false, deep: false, zn: 0, role: null, raised: false, examined: false,
      riddle: null, cls: null, bred: false, dud: false, incT: 0, ready: false,
    }, o);
    S.dragons[d.id] = d;
    return d;
  }
  function tutStep(k) { return !!S.tutorial.done[k]; }
  function list(fn) { const o = []; for (const k in S.dragons) { const d = S.dragons[k]; if (fn(d)) o.push(d); } return o; }
  let adultCache = null;
  function dirty() { adultCache = null; }
  function adultsOf(f) {
    if (!adultCache) {
      adultCache = []; for (let i = 0; i < NE; i++) adultCache.push([]);
      for (const k in S.dragons) { const d = S.dragons[k]; if (d.status === 'adult' && d.faction != null) adultCache[d.faction].push(d); }
    }
    return adultCache[f];
  }
  function removeDragon(d, status) {
    d.status = status;
    S.nests.forEach((n, i) => { if (n && (n.a === d.id || n.b === d.id)) S.nests[i] = null; });
    if (S.king === d.id) S.king = null;
    S.gov = S.gov.filter(id => id !== d.id);
    delete S.dragons[d.id];
    dirty();
  }

  // ------------------------------------------------------------ Material
  function materialChance(k) { return 1 / (C.material.base * Math.pow(C.material.growth, k - 1)); }
  function rollMaterial() {
    const luck = 1 + S.market.luck * C.material.luckStep;
    const u = R(); let acc = 0;
    for (let k = C.material.tiers.length; k >= 1; k--) {
      acc += materialChance(k) * luck;
      if (u < acc) { S.market.luck = 0; logRoll('Material', k, 'tier'); return k; }
    }
    S.market.luck++;
    return 0;
  }
  const matFactor = k => (k ? 1 + k * C.material.factorPerTier : 1);

  // ------------------------------------------------------------ Zones
  function zoneOf(id) { return S.zones[id]; }
  function zoneFactions(z) { return z.els; }
  function zoneOpen(z) {
    if (!z.unlocked) return false;
    const hostile = z.els.some(f => S.access[f] && repLevel(f) <= REPI[C.portals.closeLevel]);
    return !hostile || z.backdoorOn;
  }
  function zoneHostile(z) { return z.els.some(f => S.access[f] && repLevel(f) <= REPI[C.portals.closeLevel]); }
  function incubatorOf(z) {
    if (z.els.length > 1) return { name: 'Mixed pool', style: 'mix' };
    return C.zones.incubators[EL[z.els[0]].id] || C.zones.incubatorPlaceholder;
  }
  function zoneName(z) { return z.els.length > 1 ? allianceName(z.els[0], z.els[1]) : EL[z.els[0]].name; }
  function zoneColor(z) { if (z.els.length === 1) return EL[z.els[0]].color; return allianceColor(z.els[0], z.els[1]); }
  function slotPrice(z) { return Math.round(C.zones.slotPriceBase * Math.pow(C.zones.slotPriceGrowth, z.slots - C.zones.startSlots)); }
  function portalPrice() { const extra = Object.values(S.zones).filter(z => z.unlocked && z.els.length === 1).length - C.zones.start.length; return Math.round(C.portals.goldBase * Math.pow(C.portals.goldGrowth, Math.max(0, extra))); }

  // ------------------------------------------------------------ Initialisation
  function init(seed) {
    seed = (seed == null ? Math.floor(Math.random() * 4294967295) : seed) >>> 0;
    S = {
      version: C.version, seed, rng: seed, created: Date.now(), played: 0, worldOffset: 0,
      gold: C.market.startGold, nextId: 1, dragons: {}, chamber: [], zones: {},
      inventory: { normal: {}, fractal: {} }, rep: [], access: [], schoolRep: 0, streak: 0,
      factions: [], rel: [], relBase: [], ruler: EI[C.factions.startRuler], king: null, gov: [], hidden: [],
      war: null, warCooldown: C.war.startPeaceSeconds, nests: new Array(C.breed.nests).fill(null),
      market: { offers: [], sat: new Array(NE).fill(0), lastWonder: '', shells: 0, shellCls: 'cheap', luck: 0 },
      offers: {}, offersAt: -1e9, quests: [], warriorFor: null,
      logs: { breed: [], riddle: [], rolls: [], events: [], wars: [] },
      stats: { clutch: new Array(C.breed.xMax + 1).fill(0), clutches: 0, hatched: 0, duds: 0, scales: 0, gold: 0, wars: 0, riddleHits: 0, riddleTries: 0 },
      collection: {}, settings: { anim: 'auto', sound: true, flash: true }, tutorial: { done: {} },
      seen: {},
    };
    for (let i = 0; i < NE; i++) {
      const id = EL[i].id;
      S.zones[id] = { id, els: [i], unlocked: C.zones.start.includes(id), slots: C.zones.startSlots, inc: new Array(C.zones.startSlots).fill(null), ground: [], backdoor: false, backdoorOn: false };
      S.rep.push(0); S.access.push(false);
      const wv = C.factions.worldviews[id] || C.factions.worldviewPlaceholder;
      S.factions.push({ k: wv.k, needs: { raum: 80, brut: 50, ehre: 50, tribut: 40 }, nest: [], disturbedUntil: 0, wins: 0, losses: 0, warned: 0 });
    }
    // relations
    const RC = C.relations;
    for (let a = 0; a < NE; a++) {
      S.rel.push(new Array(NE).fill(0)); S.relBase.push(new Array(NE).fill(0));
    }
    for (let a = 0; a < NE; a++) for (let b = a + 1; b < NE; b++) {
      const base = isEnemy(a, b) ? ri(RC.enemyStart[0], RC.enemyStart[1]) : ri(RC.otherStart[0], RC.otherStart[1]);
      S.relBase[a][b] = clamp(base + ri(-RC.asymmetry, RC.asymmetry), -100, 100);
      S.relBase[b][a] = clamp(base + ri(-RC.asymmetry, RC.asymmetry), -100, 100);
    }
    for (let n = 0; n < RC.startAlliances; n++) {
      const a = ri(0, NE - 1); const b = randomCompatible([a]);
      S.relBase[a][b] = ri(65, 85); S.relBase[b][a] = ri(65, 85);
    }
    for (let a = 0; a < NE; a++) for (let b = 0; b < NE; b++) S.rel[a][b] = S.relBase[a][b];
    // wild starting population
    for (let f = 0; f < NE; f++) {
      let n = ri(C.factions.startAdults[0], C.factions.startAdults[1]);
      if (f === S.ruler) n += C.factions.rulerStartBonus;
      for (let i = 0; i < n; i++) spawnWildAdult(f, ri(0, C.factions.startAgeMax));
    }
    dirty();
    refreshOffers();
    refreshActivities();
    updateRoles(true);
    return S;
  }
  function spawnWildAdult(f, extraAge) {
    const v = new Array(NE).fill(0);
    const pure = R() < 0.6;
    if (pure) v[f] = STEPS; else { v[f] = ri(14, 19); const o = randomCompatible([f]); v[o] = STEPS - v[f]; }
    const d = newDragon({ v, status: 'adult', owned: false, faction: f, zone: EL[f].id, t1000: now() - extraAge });
    d.zn = v[f]; d.shimmer = false; // wild-born, not raised by the player
    dirty();
    return d;
  }

  // ------------------------------------------------------------ Market
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function lawOf(f) { return C.laws[EL[f].id] || null; }
  function law() { return lawOf(S.ruler); }
  function eggPrice(cls) { const l = law(); return Math.round(CLS[cls].price * (1 - ((l && l.eggDiscount) || 0))); }
  function refreshOffers() {
    const M = S.market;
    M.offers = M.offers.filter(o => o.expires > S.played);
    while (M.offers.length < C.market.offerCount) {
      const cls = pickWeightedKey(C.market.offerWeights);
      const life = ri(C.market.offerLifetime[0], C.market.offerLifetime[1]);
      M.offers.push({ id: S.nextId++, cls, expires: S.played + life, life });
    }
  }
  function makeEgg(cls, opts) {
    opts = opts || {};
    const v = opts.v || genVector(cls);
    const mat = cls === 'cheap' && !opts.noMat ? rollMaterial() : 0;
    const dud = !opts.noDud && R() < CLS[cls].dud;
    return newDragon({ v, mat, cls, dud, status: 'egg', bought: !opts.bred, bred: !!opts.bred, wonder: !!opts.wonder, riddleFaction: opts.riddleFaction == null ? null : opts.riddleFaction, parents: opts.parents || null });
  }
  function chamberAdd(d) {
    if (S.chamber.length >= C.market.chamberCapacity) {
      const p = eggSalePrice(d); S.gold += p; S.stats.gold += p;
      emit('toast', { text: 'Egg chamber full – egg sold for ' + p + ' gold.' });
      delete S.dragons[d.id];
      return false;
    }
    S.chamber.push(d.id); return true;
  }
  function buyEgg(cls, offerId) {
    const price = eggPrice(cls);
    if (S.gold < price) return { ok: false, msg: 'Not enough gold.' };
    if (S.chamber.length >= C.market.chamberCapacity) return { ok: false, msg: 'The egg chamber is full.' };
    if (offerId != null) {
      const i = S.market.offers.findIndex(o => o.id === offerId);
      if (i < 0) return { ok: false, msg: 'Offer expired.' };
      S.market.offers.splice(i, 1);
    }
    S.gold -= price;
    const d = makeEgg(cls);
    d.paid = price;
    chamberAdd(d);
    tut('buy');
    return { ok: true, egg: d };
  }
  function wonderAvailable() { return S.market.lastWonder !== todayStr(); }
  function claimWonder() {
    if (!wonderAvailable()) return { ok: false, msg: 'The wonder egg returns tomorrow.' };
    if (S.chamber.length >= C.market.chamberCapacity) return { ok: false, msg: 'The egg chamber is full.' };
    S.market.lastWonder = todayStr();
    const cls = pickWeightedKey(C.market.wonderEgg.weights);
    const d = makeEgg(cls, { noDud: true, wonder: true }); d.paid = 0;
    chamberAdd(d);
    logEvent('Wonder egg received (' + CLS[cls].name + ')', 'good');
    return { ok: true, egg: d };
  }
  function eggSalePrice(d) {
    const cls = d.cls || classify(d.v);
    const base = eggPrice(cls) * C.market.buybackRate * (d.examined ? 1 + C.market.examinedBonus : 1);
    const e = dominant(d.v);
    return Math.max(1, Math.round(base / (1 + C.market.saturationStrength * S.market.sat[e])));
  }
  function sellEgg(id) {
    const d = S.dragons[id]; const i = S.chamber.indexOf(id);
    if (!d || i < 0) return { ok: false };
    const p = eggSalePrice(d);
    S.gold += p; S.stats.gold += p;
    S.market.sat[dominant(d.v)] += C.market.saturationPerSale;
    S.chamber.splice(i, 1); delete S.dragons[id];
    return { ok: true, price: p };
  }

  // ------------------------------------------------------------ Examination & riddles
  function schoolClarity() { return Math.min(C.riddle.maxClarity, Math.floor(S.schoolRep / C.riddle.repPerLevel)); }
  function makeRiddle(d) {
    const RC = C.riddle;
    const dom = dominant(d.v);
    const cand = [dom];
    while (cand.length < 3) { const e = ri(0, NE - 1); if (!cand.includes(e)) cand.push(e); }
    shuffle(cand);
    const clarity = schoolClarity();
    const nHints = RC.baseHints + Math.floor(clarity / 2) * RC.hintsPerTwoLevels;
    const noise = Math.max(RC.noiseMin, RC.noiseStart - RC.noisePerLevel * clarity);
    const id = EL[dom].id;
    const good = RC.phrases.filter(p => p.el.includes(id));
    const bad = RC.phrases.filter(p => !p.el.includes(id));
    const hints = []; const used = new Set();
    for (let i = 0; i < nHints * 4 && hints.length < nHints; i++) {
      const pool = R() < noise ? bad : good;
      const p = pick(pool);
      if (used.has(p.t)) continue;
      used.add(p.t); hints.push(p.t);
    }
    const glitter = d.mat ? R() < C.material.riddleGlitter : R() < C.material.riddleFalseGlitter;
    if (glitter) hints.push(C.riddle.glitter);
    return { cand, hints, label: null, clarity };
  }
  function examineCost(d) { return C.market.examineCost[d.cls || classify(d.v)] || 10; }
  function examine(id) {
    const d = S.dragons[id];
    if (!d || (d.status !== 'egg' && d.status !== 'incubating')) return { ok: false };
    if (d.examined) return { ok: true, riddle: d.riddle };
    const cost = examineCost(d);
    if (S.gold < cost) return { ok: false, msg: 'Not enough gold for the examination.' };
    S.gold -= cost;
    d.examined = true; d.riddle = makeRiddle(d);
    tut('examine');
    return { ok: true, riddle: d.riddle };
  }
  function setLabel(id, el) {
    const d = S.dragons[id];
    if (!d || !d.riddle || !d.riddle.cand.includes(el)) return false;
    d.riddle.label = el; tut('label'); return true;
  }

  // ------------------------------------------------------------ Incubation
  function freeSlot(z) { for (let i = 0; i < z.slots; i++) if (z.inc[i] == null) return i; return -1; }
  function incubate(id, zoneId) {
    const d = S.dragons[id]; const z = S.zones[zoneId];
    if (!d || d.status !== 'egg' || !z) return { ok: false };
    if (!zoneOpen(z)) return { ok: false, msg: 'The portal is closed.' };
    const slot = freeSlot(z);
    if (slot < 0) return { ok: false, msg: 'No free brood slot in this zone.' };
    S.chamber = S.chamber.filter(x => x !== id);
    z.inc[slot] = id; d.status = 'incubating'; d.zone = zoneId; d.incT = 0; d.ready = false;
    tut('incubate');
    return { ok: true };
  }
  function buySlot(zoneId) {
    const z = S.zones[zoneId];
    if (!z || z.slots >= C.zones.maxSlots) return { ok: false, msg: 'Maximum reached.' };
    const p = slotPrice(z);
    if (S.gold < p) return { ok: false, msg: 'Not enough gold.' };
    S.gold -= p; z.slots++; z.inc.push(null);
    return { ok: true };
  }
  function crackStage(d) { return Math.min(C.incubation.crackStages - 1, Math.floor(d.incT / C.incubation.seconds * (C.incubation.crackStages - 1))); }
  function hatch(id) {
    const d = S.dragons[id];
    if (!d || d.status !== 'incubating' || !d.ready) return { ok: false };
    const z = S.zones[d.zone];
    if (!zoneOpen(z)) return { ok: false, msg: 'The portal is closed.' };
    z.inc[z.inc.indexOf(id)] = null;
    S.stats.hatched++;
    if (d.dud) {
      const cls = d.cls || 'cheap';
      const refund = Math.round((d.paid != null ? d.paid : eggPrice(cls)) * CLS[cls].refund);
      S.gold += refund; S.stats.duds++;
      S.market.shells++; if (CLS[cls].idx > CLS[S.market.shellCls].idx) S.market.shellCls = cls;
      let pity = null;
      if (S.market.shells >= C.market.pityShells) {
        const ni = Math.min(C.eggClasses.length - 1, CLS[S.market.shellCls].idx + 1);
        const pc = C.eggClasses[ni].id;
        S.market.shells = 0; S.market.shellCls = 'cheap';
        const egg = makeEgg(pc, { noDud: true }); egg.paid = 0;
        chamberAdd(egg); pity = egg;
        logEvent('Pity rule: free ' + C.eggClasses[ni].name + ' egg', 'good');
      }
      delete S.dragons[id];
      logEvent('A dud hatched, ' + refund + ' gold refunded', 'bad');
      return { ok: true, dud: true, refund, pity, cls };
    }
    d.status = 'school'; d.age = 0; d.hatchedAt = S.played;
    const dom = dominant(d.v);
    let hit = null;
    if (d.riddle && d.riddle.label != null) {
      hit = dominants(d.v).includes(d.riddle.label);
      S.stats.riddleTries++;
      if (hit) {
        S.stats.riddleHits++;
        const gain = Math.round(C.riddle.hitRep * (1 + C.riddle.streakBonus * Math.min(S.streak, C.riddle.streakCap)));
        S.schoolRep += gain; S.streak++;
        if (d.riddleFaction != null) addRep(d.riddleFaction, C.riddle.factionHitRep);
      } else S.streak = 0;
      S.logs.riddle.unshift({ t: Math.round(S.played), hints: d.riddle.hints, label: d.riddle.label, actual: d.v.slice(), hit, name: d.name });
      if (S.logs.riddle.length > 100) S.logs.riddle.length = 100;
    }
    if (d.mat) {
      const key = EL[dom].id;
      S.collection[key] = S.collection[key] || {};
      S.collection[key][d.mat] = (S.collection[key][d.mat] || 0) + 1;
      logEvent(C.material.tiers[d.mat - 1].name + ' dragon hatched!', 'epic');
    }
    // quest: Matching Brood
    S.quests = S.quests.filter(q => {
      if (q.type === 'match' && z.els.includes(q.f) && d.v[q.f] >= STEPS / 2) { addRep(q.f, C.activities.rep.neutral); emit('toast', { text: 'Matching Brood fulfilled: ' + EL[q.f].name }); return false; }
      return true;
    });
    tut('hatch');
    return { ok: true, dud: false, dragon: d, hit, impossible: hasEnemyPair(d.v) };
  }

  // ------------------------------------------------------------ Coming of age
  function graduate(d) {
    const z = S.zones[d.zone];
    const before = d.v.slice();
    const zels = z.els;
    d.deep = zels.some(e => d.v[enemyOf(e)] > 0);
    let shifted = false;
    if (!d.deep) {
      for (let s = 0; s < C.zones.imprintSteps; s++) {
        const t = zels.length > 1 ? (d.v[zels[0]] <= d.v[zels[1]] ? zels[0] : zels[1]) : zels[0];
        if (d.v[t] >= STEPS) break;
        let src = -1, m = 0;
        for (let i = 0; i < NE; i++) if (!zels.includes(i) && d.v[i] > m) { m = d.v[i]; src = i; }
        if (src < 0) break;
        d.v[src]--; d.v[t]++; shifted = true;
      }
    }
    d.zn = d.deep ? 0 : (zels.length > 1 ? Math.round((d.v[zels[0]] + d.v[zels[1]]) / 2) : d.v[zels[0]]);
    const doms = dominants(d.v);
    d.shimmer = zels.some(e => doms.includes(e));
    const becamePure = !isPure(before) && isPure(d.v);
    // faction choice
    const opts = present(d.v);
    let f, probs;
    if (S.warriorFor != null && d.v[S.warriorFor] >= 0) {
      f = S.warriorFor; probs = [{ el: f, p: 1 }];
      addRep(f, C.activities.rep.war, false); angerOthers(f);
      S.warriorFor = null;
    } else {
      const ws = opts.map(e => {
        let w = d.v[e];
        if (e === S.ruler) w *= C.factions.choice.rulerPull;
        if (isEnemy(e, S.ruler)) w *= C.factions.choice.rulerEnemyPush;
        return w;
      });
      const sum = ws.reduce((a, b) => a + b, 0);
      probs = opts.map((e, i) => ({ el: e, p: ws[i] / sum }));
      const roll = R();
      let acc = 0; f = opts[opts.length - 1];
      for (let i = 0; i < opts.length; i++) { acc += ws[i] / sum; if (roll < acc) { f = opts[i]; break; } }
      logRoll('Faction choice ' + d.name, Math.round(roll * 100) / 100, '0–1');
    }
    d.status = 'adult'; d.faction = f; d.owned = false; d.raised = true;
    d.t1000 = now() - (d.age - C.time.adultAge);
    if (S.factions[f].ended) reformFaction(f, d.name + ' raises its banner again', d);
    dirty();
    let firstAccess = false;
    if (!S.access[f]) {
      S.access[f] = true; firstAccess = true;
      if (S.rep[f] < REPL[REPI.friendly].min) S.rep[f] = REPL[REPI.friendly].min;
      logEvent('Access to the faction ' + EL[f].name, 'good');
    }
    // quest: Diplomat
    S.quests = S.quests.filter(q => {
      if (q.type === 'diplomat' && present(d.v).length >= 2 && Math.max.apply(null, d.v) <= STEPS / 2) {
        present(d.v).forEach(e => addRep(e, C.activities.rep.group * d.v[e] / STEPS));
        emit('toast', { text: 'Diplomat trained: ' + d.name });
        return false;
      }
      return true;
    });
    // check nesting pairs
    S.nests.forEach((n, i) => { if (n && (n.a === d.id || n.b === d.id) && !pairValid(n.a, n.b).ok) S.nests[i] = null; });
    logEvent(d.name + ' has grown up and joins ' + EL[f].name, 'good');
    emit('graduate', { id: d.id, before, after: d.v.slice(), deep: d.deep, shifted, becamePure, faction: f, probs, firstAccess, zone: z.id });
    tut('graduate');
  }

  // ------------------------------------------------------------ Scales
  function scaleLevel(age) { return 1 + Math.max(0, Math.floor(Math.log2(age / C.time.adultAge))); }
  function scaleQuality(d) {
    const q = C.scales.qualityChance;
    if (d.role && R() < q.radiant) return 'radiant';
    if (d.war && R() < q.war) return 'war';
    if (d.shimmer && R() < q.shimmer) return 'shimmer';
    return 'common';
  }
  function dropScale(d) {
    const z = S.zones[d.zone]; if (!z) return;
    if (z.ground.length >= C.zones.groundCapacity) z.ground.shift(); // oldest scale decays
    const fractal = R() < C.scales.fractalChance;
    const s = {
      id: S.nextId++, fractal, level: scaleLevel(ageOf(d)), q: scaleQuality(d), mat: d.mat, zn: d.zn, f: d.faction,
      x: 0.04 + R() * 0.92, y: 0.1 + R() * 0.8, t: S.played,
    };
    if (fractal) s.v = d.v.slice(); else s.el = present(d.v)[weighted(present(d.v).map(i => d.v[i]))];
    z.ground.push(s);
    emit('scaleDrop', { zone: z.id, scale: s });
  }
  function scaleNeed(s) {
    let need = REPI[C.rep.need.normal];
    if (s.fractal) need = Math.max(need, REPI[C.rep.need.fractal]);
    if (s.q !== 'common') need = Math.max(need, REPI[C.rep.need[s.q]]);
    return need;
  }
  function canCollect(s) { return S.access[s.f] && repLevel(s.f) >= scaleNeed(s); }
  function scaleKey(s) { return (s.fractal ? s.v.join('.') : s.el) + '|' + s.level + '|' + s.q + '|' + s.mat + '|' + s.zn; }
  function parseKey(kind, key) {
    const p = key.split('|');
    const o = { fractal: kind === 'fractal', level: +p[1], q: p[2], mat: +p[3], zn: +p[4] };
    if (o.fractal) o.v = p[0].split('.').map(Number); else o.el = +p[0];
    return o;
  }
  function scaleValue(s) {
    return C.scales.baseValue * s.level * (1 + s.zn / STEPS) * C.scales.quality[s.q].factor * (s.fractal ? C.scales.fractalFactor : 1) * matFactor(s.mat);
  }
  function demandOf(s) {
    const share = e => (s.fractal ? s.v[e] / STEPS : (s.el === e ? 1 : 0));
    const r = S.ruler;
    return 1 + (C.scales.rulerDemand - 1) * share(r) + (C.scales.rulerEnemyDemand - 1) * share(enemyOf(r));
  }
  function scaleSalePrice(s) {
    const l = law();
    return Math.max(1, Math.round(scaleValue(s) * demandOf(s) * (1 - ((l && l.scaleTax) || 0))));
  }
  function collect(zoneId, scaleId) {
    const z = S.zones[zoneId]; if (!z || !zoneOpen(z)) return { ok: false, msg: 'The portal is closed.' };
    const i = z.ground.findIndex(s => s.id === scaleId); if (i < 0) return { ok: false };
    const s = z.ground[i];
    if (!S.access[s.f]) return { ok: false, msg: 'First raise a dragon that joins ' + EL[s.f].name + '.' };
    if (!canCollect(s)) return { ok: false, msg: 'Reputation with ' + EL[s.f].name + ' too low (needs ' + REPL[scaleNeed(s)].name + ').' };
    z.ground.splice(i, 1);
    const kind = s.fractal ? 'fractal' : 'normal'; const key = scaleKey(s);
    S.inventory[kind][key] = (S.inventory[kind][key] || 0) + 1;
    S.stats.scales++;
    tut('collect');
    return { ok: true, scale: s };
  }
  function sellScales(kind, key, count) {
    const inv = S.inventory[kind]; const have = inv[key] || 0;
    count = Math.min(have, count == null ? have : count); if (count <= 0) return { ok: false };
    const s = parseKey(kind, key);
    const each = scaleSalePrice(s);
    const total = each * count;
    const l = law();
    if (l && l.scaleTax) S.factions[S.ruler].needs.tribut = Math.min(100, S.factions[S.ruler].needs.tribut + count * 0.5);
    S.gold += total; S.stats.gold += total;
    inv[key] = have - count; if (!inv[key]) delete inv[key];
    tut('sell');
    return { ok: true, total, each, count };
  }
  function sellAllScales() {
    let total = 0, count = 0;
    for (const kind of ['normal', 'fractal']) for (const key of Object.keys(S.inventory[kind])) { const r = sellScales(kind, key); if (r.ok) { total += r.total; count += r.count; } }
    return { ok: count > 0, total, count };
  }
  function takeScales(filter, n) {
    // removes n scales matching filter(s); returns them or null
    const found = [];
    for (const kind of ['normal', 'fractal']) for (const key of Object.keys(S.inventory[kind])) {
      const s = parseKey(kind, key); if (!filter(s)) continue;
      for (let c = 0; c < S.inventory[kind][key] && found.length < n; c++) found.push({ kind, key, s });
    }
    if (found.length < n) return null;
    found.forEach(x => { S.inventory[x.kind][x.key]--; if (!S.inventory[x.kind][x.key]) delete S.inventory[x.kind][x.key]; });
    return found;
  }

  // ------------------------------------------------------------ Nesting ground
  function canPairCandidate(d) {
    if (!d) return false;
    if (d.status === 'school') return d.age >= C.time.matureAge;
    if (d.status === 'adult') return S.access[d.faction] && repAtLeast(d.faction, 'friendly');
    return false;
  }
  function pairValid(ia, ib) {
    const a = S.dragons[ia], b = S.dragons[ib];
    if (!a || !b || a === b) return { ok: false, msg: 'Choose two different dragons.' };
    if (!canPairCandidate(a) || !canPairCandidate(b)) return { ok: false, msg: 'Both must be able to breed (300 years) or belong to a faction where you are Friendly.' };
    if (isEnemy(dominant(a.v), dominant(b.v))) return { ok: false, msg: 'Arch-enemies never mate.' };
    if (a.status === 'adult' && b.status === 'adult' && a.faction !== b.faction && !allied(a.faction, b.faction)) return { ok: false, msg: 'Only dragons of the same or an allied faction.' };
    const ad = a.status === 'adult' ? a : (b.status === 'adult' ? b : null);
    const ot = ad === a ? b : a;
    if (ad && ot.status === 'school' && isEnemy(dominant(ot.v), ad.faction)) return { ok: false, msg: 'Arch-enemies never mate.' };
    return { ok: true };
  }
  function breedP(a, b) {
    let p = C.breed.chancePerYear;
    if (a.status === 'adult' || b.status === 'adult') p *= C.breed.adultBoost;
    const l = law(); if (l && l.breedMult) p *= l.breedMult;
    return Math.min(0.99, p);
  }
  function sampleInterval(p) { const u = R(); return C.breed.minYears + Math.max(0, Math.ceil(Math.log(1 - u) / Math.log(1 - p)) - 1); }
  function setPair(slot, ia, ib) {
    const v = pairValid(ia, ib); if (!v.ok) return v;
    if (S.nests.some((n, i) => n && i !== slot && [n.a, n.b].some(x => x === ia || x === ib))) return { ok: false, msg: 'One dragon is already in another nest.' };
    const a = S.dragons[ia], b = S.dragons[ib];
    S.nests[slot] = { a: ia, b: ib, next: sampleInterval(breedP(a, b)), since: S.played };
    tut('pair');
    return { ok: true };
  }
  function clearPair(slot) { S.nests[slot] = null; }
  function nestRestless(n) { return n && n.next <= C.breed.restlessYears; }
  function doBreed(slot) {
    const n = S.nests[slot]; const a = S.dragons[n.a], b = S.dragons[n.b];
    const roll = rollClutch(a.name + ' × ' + b.name);
    const eggs = [];
    for (let i = 0; i < roll.z; i++) {
      const inh = inherit(a, b);
      const d = makeEgg(classify(inh.v), { v: inh.v, bred: true, noDud: true, noMat: true, parents: [a.id, b.id] });
      d.cls = classify(d.v); d.mutated = inh.mutated; d.shell = mixColor(a.v.map((x, k) => x + b.v[k]).map(x => x / 2));
      eggs.push(d);
    }
    S.stats.clutch[roll.z]++; S.stats.clutches++;
    S.logs.breed.unshift({ t: Math.round(S.played), a: a.name, b: b.name, va: a.v.slice(), vb: b.v.slice(), roll, eggs: eggs.length });
    if (S.logs.breed.length > 200) S.logs.breed.length = 200;
    n.next = sampleInterval(breedP(a, b));
    emit('clutch', { slot, roll, eggs: eggs.map(e => e.id), a: a.id, b: b.id });
    eggs.forEach(e => chamberAdd(e));
    tut('clutch');
  }

  // ------------------------------------------------------------ Factions, king, needs
  function factionPower(f) { return adultsOf(f).reduce((s, d) => s + strength(d), 0); }
  function needsMean(f) { const n = S.factions[f].needs; return (n.raum + n.brut + n.ehre + n.tribut) / 400; }
  function warRisk(f) {
    const N = adultsOf(f).length; const K = C.factions.capacity;
    return (N / K) * (1 - needsMean(f)) * (1 - S.factions[f].k);
  }
  function eldest(f) { const a = adultsOf(f); if (!a.length) return null; return a.reduce((m, d) => (d.t1000 < m.t1000 ? d : m)); }
  function updateRoles(silent) {
    if (!adultsOf(S.ruler).length) {
      let best = -1, bp = 0;
      for (let f = 0; f < NE; f++) { const p = factionPower(f); if (p > bp) { bp = p; best = f; } }
      if (best >= 0 && best !== S.ruler) setRuler(best, 'empty throne', silent);
    }
    const k = eldest(S.ruler);
    const oldKing = S.king;
    S.king = k ? k.id : null;
    if (S.king !== oldKing || S.gov.some(id => !S.dragons[id])) {
      list(d => d.role).forEach(d => { d.role = null; });
      if (k) {
        k.role = 'king';
        const pool = list(d => d.status === 'adult' && d.id !== k.id && (d.faction === S.ruler || allied(d.faction, S.ruler)));
        pool.sort((x, y) => (present(y.v).length - present(x.v).length) || (x.t1000 - y.t1000));
        S.gov = pool.slice(0, C.factions.govSize).map(d => { d.role = 'gov'; return d.id; });
        if (!silent && oldKing !== S.king) { emit('coronation', { king: k.id, f: S.ruler }); logEvent(k.name + ' becomes Dragon King (' + EL[S.ruler].name + ')', 'epic'); }
      } else S.gov = [];
    }
  }
  function setRuler(f, reason, silent) {
    S.ruler = f;
    const l = law();
    S.hidden = [];
    if (l && l.hideRelations) for (let a = 0; a < NE; a++) for (let b = 0; b < NE; b++) if (a !== b && R() < l.hideRelations) S.hidden.push(a * NE + b);
    S.king = null;
    if (!silent) logEvent(EL[f].name + ' rules the sky (' + reason + ')', 'epic');
  }
  function updateNeeds(dt) {
    const N = C.factions.needs; const rate = N.driftPerSecond * dt;
    for (let f = 0; f < NE; f++) {
      const F = S.factions[f]; const n = F.needs; const ruler = f === S.ruler;
      const pop = adultsOf(f).length;
      n.raum = 100 * clamp(N.raumFree - pop / C.factions.capacity, 0, 1);
      n.brut = towards(n.brut, F.disturbedUntil > S.played ? 15 : N.brutTarget, rate);
      n.ehre = towards(n.ehre, ruler ? N.ehreRuler : N.ehreOther, rate);
      n.tribut = towards(n.tribut, ruler ? N.tributRuler : N.tributOther, rate);
    }
  }
  function updateRelations(dt) {
    const RC = C.relations;
    for (let a = 0; a < NE; a++) for (let b = 0; b < NE; b++) {
      if (a === b) continue;
      let r = S.rel[a][b];
      r += (S.relBase[a][b] - r) * RC.reversion * dt + (R() - 0.5) * RC.noise * dt;
      r = clamp(r, -100, 100);
      if (isEnemy(a, b)) r = Math.min(r, RC.enemyCap);
      S.rel[a][b] = r;
    }
  }
  function changeRel(a, b, d, both) {
    const cap = isEnemy(a, b) ? C.relations.enemyCap : 100;
    S.rel[a][b] = clamp(S.rel[a][b] + d, -100, cap); S.relBase[a][b] = clamp(S.relBase[a][b] + d * 0.5, -100, cap);
    if (both !== false) { S.rel[b][a] = clamp(S.rel[b][a] + d, -100, cap); S.relBase[b][a] = clamp(S.relBase[b][a] + d * 0.5, -100, cap); }
  }

  // ------------------------------------------------------------ War
  // Alliances always help each other: every ally of a leader joins its side at full strength.
  function warSides(A, D) {
    const sa = [A], sd = [D];
    for (let f = 0; f < NE; f++) {
      if (f === A || f === D || S.factions[f].ended || !adultsOf(f).length) continue;
      const withA = allied(f, A), withD = allied(f, D);
      if (withA && withD) (S.rel[f][A] >= S.rel[f][D] ? sa : sd).push(f);
      else if (withA) sa.push(f);
      else if (withD) sd.push(f);
    }
    return { sa, sd };
  }
  function sidePower(side, leader) {
    return side.reduce((p, f) => p + factionPower(f) * (f === leader ? 1 : C.war.allyWeight), 0);
  }
  const sideName = side => side.map(f => EL[f].name).join(' + ');
  function updateWar(dt) {
    if (S.war) {
      const W = S.war; W.t += dt;
      if (!W.sa) { const sides = warSides(W.attacker, W.defender); W.sa = sides.sa; W.sd = sides.sd; }
      if (W.phase === 'announce' && W.t >= C.war.announceSeconds) {
        // allies who formed an alliance during the threat still rally to their friends
        const sides = warSides(W.attacker, W.defender); W.sa = sides.sa; W.sd = sides.sd;
        W.phase = 'fight'; W.t = 0; emit('warFight', { sa: W.sa, sd: W.sd });
      }
      else if (W.phase === 'fight' && W.t >= (W.fight || C.war.fightSeconds)) resolveWar();
      return;
    }
    S.warCooldown -= dt;
    if (S.warCooldown > 0) return;
    for (let f = 0; f < NE; f++) {
      const N = adultsOf(f).length; if (!N) continue;
      const risk = warRisk(f);
      if (risk > 0.35 && S.access[f] && S.played - S.factions[f].warned > 120) {
        S.factions[f].warned = S.played;
        emit('speech', { f, text: C.speech.warn.replace('{f}', EL[f].name) });
      }
      if (R() < risk * C.war.baseRate * dt) {
        let def = S.ruler;
        if (f === S.ruler || allied(f, S.ruler)) {
          let worst = 1e9; def = -1;
          for (let g = 0; g < NE; g++) if (g !== f && !allied(f, g) && adultsOf(g).length && S.rel[f][g] < worst) { worst = S.rel[f][g]; def = g; }
        }
        if (def < 0 || def === f) continue;
        let total = 0; for (let g = 0; g < NE; g++) total += adultsOf(g).length;
        const pressure = Math.max(1, total / (C.factions.capacity * NE));
        const sides = warSides(f, def);
        S.war = { phase: 'announce', t: 0, attacker: f, defender: def, sa: sides.sa, sd: sides.sd, fight: Math.max(C.war.fightSecondsMin, C.war.fightSeconds / pressure) };
        logEvent(C.speech.war.replace('{a}', sideName(sides.sa)).replace('{b}', sideName(sides.sd)), 'war');
        emit('warAnnounce', { attacker: f, defender: def, sa: sides.sa, sd: sides.sd });
        return;
      }
    }
  }
  function resolveWar() {
    const W = S.war; const A = W.attacker, D = W.defender;
    const sa = (W.sa || [A]).filter(f => !S.factions[f].ended), sd = (W.sd || [D]).filter(f => !S.factions[f].ended);
    const pa = sidePower(sa, A), pd = sidePower(sd, D);
    const chance = pa + pd > 0 ? pa / (pa + pd) : 0.5;
    const roll = R();
    logRoll('War ' + sideName(sa) + ' vs ' + sideName(sd), Math.round(roll * 1000) / 1000, '< ' + chance.toFixed(3) + ' = attackers win');
    const attackerWins = roll < chance;
    const winner = attackerWins ? A : D, loser = attackerWins ? D : A;
    const wside = attackerWins ? sa : sd, lside = attackerWins ? sd : sa;
    // all participants become war-marked
    sa.concat(sd).forEach(f => adultsOf(f).forEach(d => { d.war = true; }));
    const fates = []; const losses = {};
    lside.forEach(f => {
      const lead = f === loser;
      const die = lead ? C.war.loserDie : C.war.allyLoserDie;
      const defect = lead ? C.war.loserDefect : C.war.allyLoserDefect;
      const king = f === S.ruler && S.king ? S.dragons[S.king] : eldest(f);
      losses[f] = { fallen: 0, defect: 0, fled: 0 };
      adultsOf(f).slice().forEach(d => {
        let fate;
        if (lead && d === king) fate = 'fallen';
        else {
          const r = R();
          if (r < die) fate = 'fallen';
          else if (r < die + defect) fate = wside.some(w => d.v[w] > 0) ? 'defect' : 'fled';
          else fate = 'stay';
        }
        if (d.raised) fates.push({ id: d.id, name: d.name, fate, f, v: d.v.slice(), mat: d.mat, seed: d.seed });
        if (fate === 'fallen') { losses[f].fallen++; removeDragon(d, 'dead'); }
        else if (fate === 'fled') { losses[f].fled++; exile(d); }
        else if (fate === 'defect') {
          losses[f].defect++;
          const to = wside.filter(w => d.v[w] > 0).sort((x, y) => d.v[y] - d.v[x])[0];
          d.faction = to; d.zone = EL[to].id; if (d.role) { d.role = null; S.gov = S.gov.filter(x => x !== d.id); } dirty();
        }
      });
    });
    wside.forEach(f => { S.factions[f].needs.ehre = Math.min(100, S.factions[f].needs.ehre + C.war.ehreSwing); S.factions[f].wins++; });
    lside.forEach(f => { S.factions[f].needs.ehre = Math.max(0, S.factions[f].needs.ehre - C.war.ehreSwing); S.factions[f].losses++; });
    // after the war the factions re-form their politics
    changeRel(A, D, -C.war.relationHit);
    wside.forEach(x => wside.forEach(y => { if (x < y) changeRel(x, y, C.war.victoryBond); }));
    lside.forEach(x => lside.forEach(y => { if (x < y) changeRel(x, y, -C.war.defeatStrain); }));
    wside.forEach(x => lside.forEach(y => changeRel(y, x, -C.war.relationHit / 2, false)));
    let newRuler = false;
    if (lside.includes(S.ruler)) { setRuler(winner, 'war won'); newRuler = true; }
    // factions that are too small collapse
    const collapsed = [];
    lside.forEach(f => { if (adultsOf(f).length < C.war.collapseBelow) { endFaction(f, 'lost the war'); collapsed.push(f); } });
    S.stats.wars++;
    const res = { attacker: A, defender: D, sa, sd, chance, roll, attackerWins, winner, loser, wside, lside, losses, collapsed, fates, newRuler, pa, pd, t: Math.round(S.played) };
    S.logs.wars.unshift(res); if (S.logs.wars.length > 50) S.logs.wars.length = 50;
    let total = 0; for (let f = 0; f < NE; f++) total += adultsOf(f).length;
    const pressure = Math.max(1, total / (C.factions.capacity * NE));
    S.war = null; S.warCooldown = C.war.cooldownSeconds / Math.pow(pressure, C.war.cooldownPressureExp);
    logEvent('War: ' + sideName(wside) + ' defeat ' + sideName(lside), 'war');
    updateRoles(false);
    emit('warResult', res);
  }

  // ------------------------------------------------------------ Exile, collapse and reformation
  function exile(d, of) {
    d.exileOf = of == null ? d.faction : of; d.status = 'exile'; d.exiledAt = S.played;
    if (d.role) { d.role = null; S.gov = S.gov.filter(x => x !== d.id); }
    if (S.king === d.id) S.king = null;
    S.nests.forEach((n, i) => { if (n && (n.a === d.id || n.b === d.id)) S.nests[i] = null; });
    dirty();
  }
  function endFaction(f, why) {
    const F = S.factions[f]; if (F.ended) return;
    adultsOf(f).slice().forEach(d => {
      // survivors scatter to a living faction they carry, otherwise into exile
      const to = present(d.v).filter(e => e !== f && !S.factions[e].ended && adultsOf(e).length).sort((x, y) => d.v[y] - d.v[x])[0];
      if (to != null) { d.faction = to; d.zone = EL[to].id; if (d.role) { d.role = null; S.gov = S.gov.filter(x => x !== d.id); } dirty(); }
      else exile(d, f);
    });
    F.nest.forEach(id => { delete S.dragons[id]; }); F.nest = [];
    F.ended = true; F.endedAt = S.played; F.falls = (F.falls || 0) + 1;
    for (let g = 0; g < NE; g++) if (g !== f) { S.rel[f][g] = S.relBase[f][g] = 0; S.rel[g][f] = S.relBase[g][f] = isEnemy(f, g) ? C.relations.enemyCap : 0; }
    if (S.warriorFor === f) S.warriorFor = null;
    dirty();
    logEvent(EL[f].name + ' has fallen (' + why + ')', 'war');
    emit('factionFallen', { f, why });
  }
  function reformFaction(f, how, founder) {
    const F = S.factions[f]; if (!F.ended) return;
    F.ended = false; F.reformedAt = S.played; F.reforms = (F.reforms || 0) + 1;
    let n = 0;
    list(d => d.status === 'exile' && d.exileOf === f).forEach(d => { d.status = 'adult'; d.faction = f; d.zone = EL[f].id; d.exileOf = null; n++; });
    if (founder) n++;
    F.needs = { raum: 80, brut: 50, ehre: 40, tribut: 40 };
    const RC = C.relations;
    for (let g = 0; g < NE; g++) if (g !== f) {
      const base = isEnemy(f, g) ? ri(RC.enemyStart[0], RC.enemyStart[1]) : ri(-20, 35);
      S.relBase[f][g] = S.rel[f][g] = clamp(base + ri(-RC.asymmetry, RC.asymmetry), -100, 100);
      S.relBase[g][f] = S.rel[g][f] = clamp(base + ri(-RC.asymmetry, RC.asymmetry), -100, 100);
    }
    dirty();
    logEvent(EL[f].name + ' reforms (' + how + ')', 'epic');
    emit('factionReformed', { f, how, n });
  }
  function updateExiles(dt) {
    const ex = list(d => d.status === 'exile');
    ex.forEach(d => {
      const F = S.factions[d.exileOf];
      if (F && !F.ended && S.played - d.exiledAt >= C.war.exileReturnSeconds) { d.status = 'adult'; d.faction = d.exileOf; d.zone = EL[d.exileOf].id; d.exileOf = null; dirty(); }
    });
    for (let f = 0; f < NE; f++) {
      const F = S.factions[f];
      if (!F.ended || S.played - F.endedAt < C.factions.reformSeconds) continue;
      const n = ex.filter(d => d.exileOf === f && d.status === 'exile').length;
      if (n >= C.factions.reformMin) reformFaction(f, n + ' exiles return home');
    }
  }

  // ------------------------------------------------------------ Wild nests
  function updateWild(dt) {
    const l = law(); const mult = (l && l.breedMult) || 1;
    for (let f = 0; f < NE; f++) {
      const F = S.factions[f];
      const ad = adultsOf(f);
      if (F.disturbedUntil <= S.played && ad.length >= 2 && F.nest.length < C.wild.nestCapacity && S.played - (F.lastClutch || -1e9) >= C.breed.minYears) {
        const room = Math.max(0, 1 - ad.length / C.factions.capacity);
        if (R() < C.wild.breedChancePerYear * mult * room * dt) {
          F.lastClutch = S.played;
          const roll = rollClutch('Wild nest ' + EL[f].name);
          S.stats.clutch[roll.z]++; S.stats.clutches++;
          const n = Math.min(roll.z, C.wild.nestCapacity - F.nest.length);
          for (let i = 0; i < n; i++) {
            const a = pick(ad); let b = pick(ad); let tries = 0;
            while ((b === a || isEnemy(dominant(a.v), dominant(b.v))) && tries++ < 5) b = pick(ad);
            if (b === a) continue;
            const inh = inherit(a, b);
            const d = newDragon({ v: inh.v, status: 'wildegg', owned: false, faction: f, zone: EL[f].id, parents: [a.id, b.id] });
            F.nest.push(d.id);
          }
          F.needs.brut = Math.min(100, F.needs.brut + 15);
          S.logs.breed.unshift({ t: Math.round(S.played), wild: f, roll, eggs: n });
          if (S.logs.breed.length > 200) S.logs.breed.length = 200;
        }
      }
      F.nest = F.nest.filter(id => {
        const d = S.dragons[id]; if (!d) return false;
        if (d.status === 'wildegg') { d.incT += dt; if (d.incT >= C.wild.broodSeconds) { d.status = 'wild'; d.age = 0; return false; } return true; }
        return false;
      });
    }
    list(d => d.status === 'wild').forEach(d => {
      d.age += dt;
      if (d.age >= C.time.adultAge) {
        d.status = 'adult'; d.t1000 = now() - (d.age - C.time.adultAge);
        d.zn = d.v[d.faction]; d.shimmer = false; d.deep = d.v[enemyOf(d.faction)] > 0; dirty();
        if (d.deep) d.zn = 0;
      }
    });
  }

  // ------------------------------------------------------------ Portals
  function updatePortals(dt) {
    for (const id in S.zones) {
      const z = S.zones[id];
      if (z.els.length === 1 && !z.unlocked) {
        const f = z.els[0];
        const ok = (S.access[f] && repAtLeast(f, C.portals.unlockLevel)) || allies(f).some(a => S.access[a] && repAtLeast(a, C.portals.unlockLevel));
        if (ok) openPortal(z, 'favour');
      }
      if (z.backdoor && z.backdoorOn) {
        const cost = C.portals.backdoorUpkeepPerMinute / 60 * dt;
        if (S.gold < cost) { z.backdoorOn = false; emit('toast', { text: 'Backdoor device ' + zoneName(z) + ' has failed – no gold.' }); }
        else { S.gold -= cost; z.els.forEach(f => setRepRaw(f, S.rep[f] - C.portals.backdoorRepDrain * dt)); }
      }
    }
  }
  function openPortal(z, how) {
    z.unlocked = true;
    logEvent('Portal ' + zoneName(z) + ' opened (' + how + ')', 'epic');
    emit('portal', { zone: z.id, how });
  }
  function buyPortal(id) {
    const z = S.zones[id]; if (!z || z.unlocked) return { ok: false };
    const p = portalPrice(); if (S.gold < p) return { ok: false, msg: 'Not enough gold (' + p + ').' };
    S.gold -= p; openPortal(z, 'gold'); return { ok: true };
  }
  function buyBackdoor(id) {
    const z = S.zones[id]; if (!z || z.backdoor) return { ok: false };
    if (S.gold < C.portals.backdoorPrice) return { ok: false, msg: 'Not enough gold.' };
    S.gold -= C.portals.backdoorPrice; z.backdoor = true; z.backdoorOn = true; return { ok: true };
  }
  function toggleBackdoor(id) { const z = S.zones[id]; if (z && z.backdoor) z.backdoorOn = !z.backdoorOn; }

  // ------------------------------------------------------------ Activities (20 in 4 groups)
  const ACTS = [
    // neutral
    { id: 'nestCare', group: 'neutral', name: 'Nest Care', desc: 'Warm and clean the wild nest.' },
    { id: 'scaleOffer', group: 'neutral', name: 'Scale Offering', desc: 'Return common scales of the element at the nest.' },
    { id: 'elderRiddle', group: 'neutral', name: 'Riddle of the Elders', desc: 'A faction egg with a riddle. The right label brings reputation after hatching.' },
    { id: 'matchBrood', group: 'neutral', name: 'Matching Brood', desc: 'Hatch an egg with at least 50 % of the element in its zone.' },
    { id: 'smallNeed', group: 'neutral', name: 'Meet a Small Need', desc: 'A resting place or food: the lowest need rises.' },
    // war
    { id: 'banner', group: 'war', name: 'War Banner', desc: 'Consecrate the faction’s own zone.' },
    { id: 'armor', group: 'war', name: 'Armour Delivery', desc: 'Deliver war-marked scales.' },
    { id: 'youngWarriors', group: 'war', name: 'Young Warriors', desc: 'Your next grown dragon joins this faction (its free choice is waived).' },
    { id: 'throne', group: 'war', name: 'Back the Claim', desc: 'Recognise the faction’s eldest dragon as future king.' },
    { id: 'lendSlots', group: 'war', name: 'Cede Brood Slots', desc: 'Lend a free brood slot to the faction for a while.' },
    // counter
    { id: 'nestRaid', group: 'counter', name: 'Nest Raid', desc: 'Steal an egg from the target faction’s wild nest.' },
    { id: 'rumors', group: 'counter', name: 'Spread Rumours', desc: 'Sour the target faction’s relation with a third one.' },
    { id: 'disturb', group: 'counter', name: 'Disturb the Hatchery', desc: 'The target faction cannot breed for a while.' },
    { id: 'flood', group: 'counter', name: 'Flood the Market', desc: 'Sell all common scales of the target faction at half price.' },
    { id: 'defector', group: 'counter', name: 'Recruit a Defector', desc: 'Persuade a mixed dragon of the target faction to switch sides.' },
    // group
    { id: 'fractalGift', group: 'group', name: 'Fractal Gift', desc: 'Give away a fractal scale: every contained faction gains reputation by share.' },
    { id: 'diplomat', group: 'group', name: 'Train a Diplomat', desc: 'Raise a balanced mixed dragon (at most 50 % per element).' },
    { id: 'forgeAlliance', group: 'group', name: 'Forge an Alliance', desc: 'Improve the relation between two factions.' },
    { id: 'mixedPool', group: 'group', name: 'Mixed Brood Pool', desc: 'Build a mixed zone for an alliance.' },
    { id: 'peace', group: 'group', name: 'Peace Festival', desc: 'All factions not hostile to each other benefit.' },
  ];
  const ACTI = {}; ACTS.forEach(a => { ACTI[a.id] = a; });
  function rollTarget(f, group) {
    const others = []; for (let g = 0; g < NE; g++) if (g !== f) others.push(g);
    if (group === 'counter') return others[weighted(others.map(g => Math.max(1, 60 - S.rel[f][g])))];
    if (group === 'group') { const ok = others.filter(g => !isEnemy(f, g)); return ok[weighted(ok.map(g => Math.max(1, 60 + S.rel[f][g])))]; }
    return null;
  }
  function refreshActivities() {
    S.offers = {}; S.offersAt = S.played;
    for (let f = 0; f < NE; f++) {
      const ids = shuffle(ACTS.map(a => a.id)).slice(0, C.activities.perFaction);
      S.offers[f] = ids.map(id => ({ id, target: rollTarget(f, ACTI[id].group), done: false }));
    }
  }
  function angerOthers(f) { for (let g = 0; g < NE; g++) if (g !== f) setRepRaw(g, S.rep[g] + C.activities.rep.warOthers); }
  function pay(n) { if (S.gold < n) return false; S.gold -= n; return true; }
  function doActivity(f, idx) {
    const o = S.offers[f] && S.offers[f][idx];
    if (!o || o.done) return { ok: false };
    if (!S.access[f]) return { ok: false, msg: 'No access to this faction.' };
    if (S.factions[f].ended) return { ok: false, msg: EL[f].name + ' has fallen – nobody is left to ask.' };
    const A = C.activities; const RP = A.rep; const T = o.target; const F = S.factions[f];
    let msg = '';
    switch (o.id) {
      case 'nestCare':
        if (!pay(A.costs.nestCare)) return { ok: false, msg: 'Not enough gold.' };
        F.needs.brut = Math.min(100, F.needs.brut + 20); addRep(f, RP.neutral); msg = 'The nest is warm.'; break;
      case 'scaleOffer': {
        const got = takeScales(s => !s.fractal && s.el === f && s.q === 'common', A.costs.scaleOffer);
        if (!got) return { ok: false, msg: 'Needs ' + A.costs.scaleOffer + ' common ' + EL[f].name + ' scales.' };
        F.needs.tribut = Math.min(100, F.needs.tribut + 15); addRep(f, RP.neutral); msg = 'The scales lie at the nest.'; break;
      }
      case 'elderRiddle': {
        if (S.chamber.length >= C.market.chamberCapacity) return { ok: false, msg: 'The egg chamber is full.' };
        const v = new Array(NE).fill(0); v[f] = ri(8, 16); const o2 = randomCompatible([f]); v[o2] = STEPS - v[f];
        if (R() < 0.5) { const t = v[f]; v[f] = v[o2]; v[o2] = t; }
        const d = makeEgg(classify(v), { v, noDud: true, noMat: true, riddleFaction: f }); d.paid = 0;
        d.examined = true; d.riddle = makeRiddle(d); chamberAdd(d); msg = 'A riddle egg waits in the egg chamber.'; break;
      }
      case 'matchBrood': S.quests.push({ type: 'match', f }); msg = 'Task accepted.'; break;
      case 'smallNeed': {
        if (!pay(A.costs.smallNeed)) return { ok: false, msg: 'Not enough gold.' };
        const n = F.needs; const k = ['brut', 'ehre', 'tribut'].reduce((m, x) => (n[x] < n[m] ? x : m), 'brut');
        n[k] = Math.min(100, n[k] + 25); addRep(f, RP.neutral); msg = 'Need met.'; break;
      }
      case 'banner':
        if (!pay(A.costs.banner)) return { ok: false, msg: 'Not enough gold.' };
        F.needs.ehre = Math.min(100, F.needs.ehre + 25); addRep(f, RP.war, false); angerOthers(f); msg = 'The banner flies.'; break;
      case 'armor': {
        const got = takeScales(s => s.q === 'war', A.costs.armor);
        if (!got) return { ok: false, msg: 'Needs ' + A.costs.armor + ' war-marked scales.' };
        addRep(f, RP.war, false); angerOthers(f); msg = 'Armour delivered.'; break;
      }
      case 'youngWarriors': S.warriorFor = f; msg = 'Your next grown dragon will join ' + EL[f].name + '.'; break;
      case 'throne': {
        const e = eldest(f); if (!e) return { ok: false, msg: 'The faction has no adult dragons.' };
        F.needs.ehre = Math.min(100, F.needs.ehre + 20); addRep(f, RP.war, false); angerOthers(f);
        if (f !== S.ruler) setRepRaw(S.ruler, S.rep[S.ruler] + RP.warOthers);
        msg = e.name + ' is now the heir apparent.'; break;
      }
      case 'lendSlots': {
        let done = false;
        for (const id in S.zones) { const z = S.zones[id]; if (!z.unlocked) continue; const i = freeSlot(z); if (i >= 0) { z.inc[i] = { lent: f, until: S.played + A.lendSeconds }; done = true; break; } }
        if (!done) return { ok: false, msg: 'No free brood slot.' };
        F.needs.brut = Math.min(100, F.needs.brut + 30); addRep(f, RP.war, false); angerOthers(f); msg = 'Brood slot ceded.'; break;
      }
      case 'nestRaid': {
        const TF = S.factions[T]; if (!TF.nest.length) return { ok: false, msg: 'The nest of ' + EL[T].name + ' is empty.' };
        if (S.chamber.length >= C.market.chamberCapacity) return { ok: false, msg: 'The egg chamber is full.' };
        const d = S.dragons[TF.nest.shift()];
        d.status = 'egg'; d.owned = true; d.faction = null; d.cls = classify(d.v); d.incT = 0; d.stolen = true; chamberAdd(d);
        TF.needs.brut = Math.max(0, TF.needs.brut - 25); addRep(T, RP.counter); msg = 'Egg stolen.'; break;
      }
      case 'rumors': {
        let third = -1, best = -1e9;
        for (let g = 0; g < NE; g++) if (g !== T && g !== f && S.rel[T][g] > best) { best = S.rel[T][g]; third = g; }
        changeRel(T, third, -A.rumorHit); addRep(T, RP.counter / 2); msg = 'Rumours between ' + EL[T].name + ' and ' + EL[third].name + '.'; break;
      }
      case 'disturb': S.factions[T].disturbedUntil = S.played + A.disturbSeconds; addRep(T, RP.counter); msg = 'The hatchery of ' + EL[T].name + ' is disturbed.'; break;
      case 'flood': {
        let total = 0, n = 0;
        for (const key of Object.keys(S.inventory.normal)) { const s = parseKey('normal', key); if (s.el !== T) continue; const c = S.inventory.normal[key]; total += Math.round(scaleSalePrice(s) * A.floodRate) * c; n += c; delete S.inventory.normal[key]; }
        if (!n) return { ok: false, msg: 'No ' + EL[T].name + ' scales in your bag.' };
        S.gold += total; addRep(T, RP.counter); msg = n + ' scales dumped for ' + total + ' gold.'; break;
      }
      case 'defector': {
        const cand = adultsOf(T).filter(d => present(d.v).length >= 2 && d.role !== 'king');
        cand.sort((x, y) => (y.role === 'gov') - (x.role === 'gov'));
        if (!cand.length) return { ok: false, msg: EL[T].name + ' has no mixed dragon.' };
        const d = cand[0]; const to = present(d.v).filter(e => e !== T).sort((a, b) => d.v[b] - d.v[a])[0];
        d.faction = to; d.zone = EL[to].id; dirty(); if (d.role === 'gov') { d.role = null; S.gov = S.gov.filter(x => x !== d.id); }
        addRep(T, RP.counter); msg = d.name + ' switches to ' + EL[to].name + '.'; break;
      }
      case 'fractalGift': {
        const got = takeScales(s => s.fractal, A.costs.fractalGift);
        if (!got) return { ok: false, msg: 'Needs one fractal scale.' };
        const v = got[0].s.v; present(v).forEach(e => addRep(e, RP.group * v[e] / STEPS)); msg = 'Gift handed over.'; break;
      }
      case 'diplomat': S.quests.push({ type: 'diplomat' }); msg = 'Task accepted.'; break;
      case 'forgeAlliance':
        if (!pay(A.costs.alliance)) return { ok: false, msg: 'Not enough gold.' };
        changeRel(f, T, A.allianceBoost); addRep(f, RP.group / 2); addRep(T, RP.group / 2);
        msg = 'Relation ' + EL[f].name + ' – ' + EL[T].name + ' improved.'; break;
      case 'mixedPool': {
        const al = allies(f); if (!al.length) return { ok: false, msg: EL[f].name + ' has no alliance.' };
        const g = al.includes(T) ? T : al[0]; const id = 'mix-' + Math.min(f, g) + '-' + Math.max(f, g);
        if (S.zones[id]) return { ok: false, msg: 'This mixed zone already exists.' };
        if (!pay(A.costs.mixedPool)) return { ok: false, msg: 'Not enough gold.' };
        S.zones[id] = { id, els: [Math.min(f, g), Math.max(f, g)], unlocked: true, slots: C.zones.startSlots, inc: new Array(C.zones.startSlots).fill(null), ground: [], backdoor: false, backdoorOn: false, mixed: true };
        addRep(f, RP.group / 2); addRep(g, RP.group / 2);
        emit('portal', { zone: id, how: 'built' }); msg = 'Mixed zone ' + allianceName(f, g) + ' built.'; break;
      }
      case 'peace': {
        if (!pay(A.costs.peace)) return { ok: false, msg: 'Not enough gold.' };
        const ok = []; for (let g = 0; g < NE; g++) if (S.rel[f][g] >= 0 || g === f) ok.push(g);
        const guests = ok.filter(g => ok.every(h => h === g || S.rel[g][h] > -50));
        guests.forEach(g => { setRepRaw(g, S.rep[g] + RP.neutral); S.factions[g].needs.ehre = Math.min(100, S.factions[g].needs.ehre + 5); });
        S.warCooldown = Math.max(S.warCooldown, 60); msg = guests.length + ' factions celebrate.'; break;
      }
      default: return { ok: false };
    }
    o.done = true;
    tut('activity');
    return { ok: true, msg };
  }

  // ------------------------------------------------------------ Tutorial [OPEN] -> placeholder
  function tut(step) { S.tutorial.done[step] = true; }

  // ------------------------------------------------------------ Main loop
  function tick(dt) {
    S.played += dt;
    // brood slots
    for (const id in S.zones) {
      const z = S.zones[id];
      for (let i = 0; i < z.inc.length; i++) {
        const x = z.inc[i];
        if (x && typeof x === 'object') { if (x.until <= S.played) z.inc[i] = null; continue; }
        if (x == null) continue;
        const d = S.dragons[x]; if (!d) { z.inc[i] = null; continue; }
        if (!d.ready) { d.incT += dt; if (d.incT >= C.incubation.seconds) { d.incT = C.incubation.seconds; d.ready = true; emit('eggReady', { id: d.id, zone: id }); } }
      }
    }
    // dragon school
    list(d => d.status === 'school').forEach(d => {
      const before = d.age; d.age += dt;
      if (before < C.time.matureAge && d.age >= C.time.matureAge) emit('mature', { id: d.id });
      if (d.age >= C.time.adultAge) graduate(d);
    });
    // nesting ground
    S.nests.forEach((n, i) => {
      if (!n) return;
      const v = pairValid(n.a, n.b); if (!v.ok) { S.nests[i] = null; return; }
      n.next -= dt;
      if (n.next <= 0) doBreed(i);
    });
    updateWild(dt);
    // scale drops
    const p = dt / C.scales.dropMeanSeconds;
    for (const k in S.dragons) { const d = S.dragons[k]; if (d.status === 'adult' && R() < p) dropScale(d); }
    updateNeeds(dt);
    updateRelations(dt);
    updateWar(dt);
    updateExiles(dt);
    updatePortals(dt);
    // market
    const decay = Math.pow(0.5, dt / C.market.saturationHalfLife);
    for (let i = 0; i < NE; i++) S.market.sat[i] *= decay;
    if (S.market.offers.some(o => o.expires <= S.played)) refreshOffers();
    if (S.played - S.offersAt >= C.activities.refreshSeconds) refreshActivities();
    S._roleT = (S._roleT || 0) + dt;
    if (S._roleT >= 1) { S._roleT = 0; updateRoles(false); }
  }

  // ------------------------------------------------------------ Saving
  function serialize() { return JSON.stringify(S); }
  function load(json) {
    const o = typeof json === 'string' ? JSON.parse(json) : json;
    if (!o || o.version !== C.version) return false;
    S = o; dirty(); return true;
  }

  root.Dragonle = {
    C, EL, NE, STEPS, EI, REPL, REPI, CLS, ACTS, ACTI,
    get S() { return S; },
    init, load, serialize, tick,
    drain() { const e = events; events = []; return e; },
    // queries
    now, ageOf, strength, dominant, dominants, isPure, hasEnemyPair, present, mixColor, vecText, isEnemy, enemyOf,
    repLevel, repAtLeast, allied, allies, alliances, allianceName, allianceColor, inheritPreview,
    zoneOpen, zoneHostile, incubatorOf, zoneName, zoneColor, slotPrice, portalPrice, crackStage,
    scaleValue, scaleSalePrice, parseKey, canCollect, scaleNeed, matFactor, materialChance,
    eggPrice, eggSalePrice, examineCost, wonderAvailable, schoolClarity, classify,
    adultsOf, warSides, factionPower, needsMean, warRisk, eldest, list, law, lawOf, nestRestless, canPairCandidate, pairValid,
    // actions
    buyEgg, claimWonder, sellEgg, examine, setLabel, incubate, buySlot, hatch, collect, sellScales, sellAllScales,
    setPair, clearPair, buyPortal, buyBackdoor, toggleBackdoor, doActivity, refreshActivities,
    // tests & simulation
    _rollClutch: rollClutch, _inherit: inherit, _genVector: genVector, _R: () => R(),
  };
})(typeof window !== 'undefined' ? window : globalThis);
