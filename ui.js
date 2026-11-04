/*
 * Dragonle – user interface, animations, sky and sound.
 */
(function () {
  'use strict';
  const G = window.Dragonle, C = G.C, EL = G.EL, NE = G.NE, SP = window.Sprites;
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const SPEED = Math.max(1, Math.min(200, +params.get('speed') || 1)); // test aid: ?speed=20
  const view = $('#view');

  const ui = { screen: 'world', zone: null, tabs: { school: 'chamber', factions: 'overview', bag: 'scales', log: 'breed' }, last: '', queue: [], modal: null, combo: { n: 0, t: 0 }, nestSel: {}, skip: false };
  let S;

  // ------------------------------------------------------------ saving & start
  function save() { try { localStorage.setItem(C.saveKey, G.serialize()); } catch (e) { /* full or blocked */ } }
  function boot() {
    let ok = false;
    try { const raw = localStorage.getItem(C.saveKey); if (raw) ok = G.load(raw); } catch (e) { ok = false; }
    if (!ok) { G.init(params.get('seed') != null ? +params.get('seed') : null); ui.first = true; }
    S = G.S;
  }

  // ------------------------------------------------------------ formatting
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  const pct = x => Math.round(x * 100) + ' %';
  function fmtYears(a) { a = Math.floor(a); return a < 100000 ? fmt(a) + ' yrs' : (a / 1000).toFixed(0) + 'k yrs'; }
  function fmtTime(s) { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ':' + String(x).padStart(2, '0'); }
  const elName = e => EL[e].name;
  const sw = (e, title) => `<span class="sw" style="background:${EL[e].color}" title="${title || EL[e].name}"></span>`;
  const swc = (c, title) => `<span class="sw" style="background:${c}" title="${title || ''}"></span>`;
  const elTag = e => `${sw(e)} ${elName(e)}`;
  const matName = k => C.material.tiers[k - 1].name;
  const isNum = x => typeof x === 'number';
  const zoneTitle = z => G.zoneName(z) + ' Zone';

  // ------------------------------------------------------------ images
  const im = (o, alt, cls) => `<img ${cls ? `class="${cls}"` : ''} src="${o.src}" width="${o.w}" height="${o.h}" alt="${alt || ''}">`;
  const icon = (name, scale) => SP.iconImg(name, scale || 2);
  function imgDragon(d, scale, flip) { return im(SP.dragon(d, scale || 3, flip), d.name); }
  function eggShell(d) { if (d.shell) return { shell: d.shell, spots: SP.shade(d.shell, 0.65) }; const c = G.CLS[d.cls || 'cheap']; return { shell: c.shell, spots: c.spots }; }
  function imgEgg(d, scale, crack) { const sh = eggShell(d); return im(SP.egg({ shell: sh.shell, spots: sh.spots, crack: crack || 0, seed: d.seed }, scale || 3), 'Egg'); }
  function imgScale(s, scale) { return im(SP.scaleSprite(SP.scaleColor(s), s.q, s.fractal, s.mat, scale || 3), 'Scale'); }
  function portalArt(z, locked) {
    const cols = z.els.map(e => EL[e].color);
    if (locked) return im(SP.portal(cols, 0, true, 4), '');
    return im(SP.portal(cols, 0, false, 4), '', 'f0') + im(SP.portal(cols, 1, false, 4), '', 'f1');
  }
  function vecBar(v) { return `<div class="vec">${G.present(v).sort((a, b) => v[b] - v[a]).map(e => `<span style="width:${v[e] * 5}%;background:${EL[e].color}" title="${elName(e)} ${v[e] * 5} %"></span>`).join('')}</div>`; }
  function vecRows(v) { return `<div class="vecrows">${G.present(v).sort((a, b) => v[b] - v[a]).map(e => `<div class="vecrow"><span>${elTag(e)}</span><div class="bar"><i style="width:${v[e] * 5}%;background:${EL[e].color}"></i></div><b>${v[e] * 5} %</b></div>`).join('')}</div>`; }
  const mutated = d => d.mutated != null && d.mutated !== false;
  function tags(d) {
    const t = [];
    if (G.isPure(d.v)) t.push('<span class="tag pure">purebred</span>');
    if (G.hasEnemyPair(d.v)) t.push('<span class="tag imp">impossible</span>');
    if (d.deep) t.push('<span class="tag deep">deep</span>');
    if (d.mat) t.push(`<span class="tag mat">${matName(d.mat)}</span>`);
    if (mutated(d)) t.push('<span class="tag imp">mutation</span>');
    if (d.war) t.push('<span class="tag war">war-marked</span>');
    if (d.role === 'king') t.push('<span class="tag role">♛ King</span>');
    if (d.role === 'gov') t.push('<span class="tag role">Government</span>');
    if (d.shimmer && d.status === 'adult') t.push('<span class="tag">shimmering</span>');
    return t.join('');
  }

  // ------------------------------------------------------------ sound (Web Audio)
  const Snd = {
    ctx: null,
    init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone(f, d, type, vol, delay) {
      if (!S.settings.sound || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime((vol || 0.06), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    },
    seq(notes, step, type, vol) { notes.forEach((f, i) => this.tone(f, step * 1.6, type, vol, i * step)); },
    collect(n) { this.tone(660 * Math.pow(1.06, Math.min(n, 24)), 0.08, 'square', 0.05); },
    coin() { this.seq([988, 1319], 0.06, 'square', 0.05); },
    tick() { this.tone(1400, 0.02, 'square', 0.025); },
    egg(i) { this.tone(440 * Math.pow(2, i / 12 * 2), 0.18, 'triangle', 0.08); },
    hatch() { this.seq([523, 659, 784, 1047], 0.08, 'square', 0.05); },
    fanfare() { this.seq([523, 523, 784, 1047, 1319], 0.1, 'square', 0.06); },
    bad() { this.seq([220, 165], 0.12, 'sawtooth', 0.04); },
    drum() { this.seq([110, 98, 110, 82], 0.16, 'triangle', 0.12); },
    epic() { this.seq([392, 523, 659, 784, 1047, 1319, 1568], 0.07, 'triangle', 0.08); },
  };

  // ------------------------------------------------------------ toasts, flash, modal
  function toast(text, kind) {
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.innerHTML = text;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 4200);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }
  function flash() { if (!S.settings.flash) return; const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  function showModal(m, front) { if (front) ui.queue.unshift(m); else ui.queue.push(m); if (!ui.modal) nextModal(); }
  function nextModal() {
    const m = ui.queue.shift();
    const box = $('#modal');
    if (!m) { ui.modal = null; box.hidden = true; return; }
    ui.modal = m; ui.skip = false; box.hidden = false;
    const body = $('#modal-body');
    if (m.build) m.build(body); else body.innerHTML = m.html;
    applyLive(body);
  }
  function closeModal() { if (ui.modal && ui.modal.busy) { ui.skip = true; return; } const m = ui.modal; if (m && m.onClose) m.onClose(); nextModal(); render(true); }
  function refreshModal() { if (ui.modal && ui.modal.rebuild) { const body = $('#modal-body'); body.innerHTML = ui.modal.rebuild(); applyLive(body); } }
  const wait = ms => new Promise(res => { if (ui.skip) return res(); const t0 = performance.now(); const id = setInterval(() => { if (ui.skip || performance.now() - t0 >= ms) { clearInterval(id); res(); } }, 16); });

  // ------------------------------------------------------------ live values (change constantly, no re-render)
  function liveValue(key) {
    const p = key.split(':');
    const d = S.dragons[p[1]];
    switch (p[0]) {
      case 'age': return d ? fmtYears(G.ageOf(d)) : '';
      case 'lvl': return d ? String(Math.floor(G.ageOf(d) / C.time.levelEvery)) : '';
      case 'str': return d ? pct(G.strength(d)) : '';
      case 'school': return d ? Math.min(100, G.ageOf(d) / C.time.adultAge * 100) : 0;
      case 'inc': return d ? d.incT / C.incubation.seconds * 100 : 0;
      case 'incleft': return d ? Math.max(0, Math.ceil(C.incubation.seconds - d.incT)) + ' s' : '';
      case 'offer': { const o = S.market.offers.find(x => x.id === +p[1]); return o ? Math.max(0, (o.expires - S.played) / o.life * 100) : 0; }
      case 'offerleft': { const o = S.market.offers.find(x => x.id === +p[1]); return o ? Math.max(0, Math.ceil(o.expires - S.played)) + ' s' : ''; }
      case 'lent': { const z = S.zones[p[1]]; const x = z && z.inc[+p[2]]; return x && !isNum(x) ? Math.max(0, Math.ceil(x.until - S.played)) + ' s' : ''; }
      case 'rep': return fmt(S.rep[+p[1]]);
      case 'repbar': { const f = +p[1]; const li = G.repLevel(f); const lo = G.REPL[li].min === -Infinity ? C.rep.floor : G.REPL[li].min; const hi = li + 1 < G.REPL.length ? G.REPL[li + 1].min : C.rep.cap; return Math.max(0, Math.min(100, (S.rep[f] - lo) / (hi - lo) * 100)); }
      case 'need': return S.factions[+p[1]].needs[p[2]];
      case 'risk': return pct(Math.min(1, G.warRisk(+p[1])));
      case 'power': return G.factionPower(+p[1]).toFixed(1);
      case 'nest': { const n = S.nests[+p[1]]; return n ? (G.nestRestless(n) ? 'restless!' : 'calm') : ''; }
      case 'wonder': return G.wonderAvailable() ? 'ready!' : 'back tomorrow';
      default: return '';
    }
  }
  function applyLive(root) {
    (root || view).querySelectorAll('[data-live]').forEach(el => { el.textContent = liveValue(el.dataset.live); });
    (root || view).querySelectorAll('[data-livew]').forEach(el => { el.style.width = liveValue(el.dataset.livew) + '%'; });
    (root || view).querySelectorAll('[data-live-cls]').forEach(el => { const n = S.nests[+el.dataset.liveCls]; el.classList.toggle('restless', !!(n && G.nestRestless(n))); });
  }

  // ------------------------------------------------------------ screens
  const SCREENS = {};

  SCREENS.world = function () {
    const zones = Object.values(S.zones).sort((a, b) => (a.els.length - b.els.length) || (a.els[0] - b.els[0]));
    const cards = zones.map(z => {
      if (!z.unlocked) {
        const f = z.els[0];
        return `<div class="portal">
          <div class="art">${portalArt(z, true)}</div>
          <div class="pname">${G.zoneName(z)}</div>
          <div class="pinfo">Honored with ${elName(f)} or one of its allies</div>
          <button class="btn small" type="button" data-act="buyPortal" data-id="${z.id}">${icon('coin')} Open: ${fmt(G.portalPrice())}</button>
        </div>`;
      }
      const open = G.zoneOpen(z);
      const used = z.inc.slice(0, z.slots).filter(x => x != null).length;
      const ready = z.inc.filter(x => isNum(x) && S.dragons[x] && S.dragons[x].ready).length;
      const coll = z.ground.filter(s => G.canCollect(s)).length;
      const school = G.list(d => d.status === 'school' && d.zone === z.id).length;
      const back = G.zoneHostile(z) ? (z.backdoor ? `<button class="btn small ${z.backdoorOn ? 'ember' : 'ghost'}" type="button" data-act="toggleBackdoor" data-id="${z.id}">Backdoor ${z.backdoorOn ? 'on' : 'off'}</button>` : `<button class="btn small" type="button" data-act="backdoor" data-id="${z.id}">Backdoor device ${fmt(C.portals.backdoorPrice)} G</button>`) : '';
      return `<div class="portal ${open ? '' : 'closed'}" ${open ? `data-act="zone" data-id="${z.id}"` : ''}>
        ${ready || coll ? `<span class="badge">${ready ? ready + ' egg' + (ready > 1 ? 's' : '') : ''}${ready && coll ? ' · ' : ''}${coll ? coll + ' ✦' : ''}</span>` : ''}
        <div class="art">${portalArt(z, false)}</div>
        <div class="pname">${G.zoneName(z)}</div>
        <div class="pinfo"><span>Brood <b>${used}/${z.slots}</b></span><span>School <b>${school}</b></span><span>Ground <b>${z.ground.length}</b></span></div>
        ${open ? '' : '<div class="bad">Portal closed – reputation hostile</div>'}${back}
      </div>`;
    }).join('');
    return `<div class="screen-head"><h2>The Dragon World</h2><span class="sub">Pick a portal. Eggs hatch in the elemental zones.</span></div>
      <div class="hub">${cards}</div>${tutorialPanel()}`;
  };

  function tutorialPanel() {
    // [OPEN] tutorial and onboarding -> simple placeholder checklist
    const steps = [['buy', 'Buy an egg at the Market'], ['incubate', 'Incubate it in a zone'], ['examine', 'Examine an egg at the School (magnifier)'], ['label', 'Pick a label for its riddle'], ['hatch', 'Click the last crack'], ['pair', 'Pair two dragons aged 300+ at the Nest'], ['graduate', 'Raise a dragon to 1000 years'], ['collect', 'Collect scales from the ground'], ['sell', 'Sell scales from your Bag'], ['activity', 'Court a faction with an activity']];
    const done = steps.filter(s => S.tutorial.done[s[0]]).length;
    if (done === steps.length) return '';
    return `<div class="section"><h3>First steps</h3><small>placeholder tutorial · ${done}/${steps.length}</small></div>
      <div class="panel alt grid cols-2">${steps.map(s => `<div>${S.tutorial.done[s[0]] ? '<b class="good">✔</b>' : '<span class="mute">☐</span>'} ${s[1]}</div>`).join('')}</div>`;
  }

  SCREENS.zone = function () {
    const z = S.zones[ui.zone];
    if (!z) { ui.screen = 'world'; return SCREENS.world(); }
    const c = G.zoneColor(z); const inc = G.incubatorOf(z);
    const open = G.zoneOpen(z);
    const cols = z.els.map(e => EL[e].color);
    const hatch = `<span class="hatch">${im(SP.hatchery(inc.style, cols, 0, 4), '')}${inc.style === 'lava' || inc.style === 'oven' ? im(SP.hatchery(inc.style, cols, 1, 4), '', 'f1') : ''}</span>`;
    const note = inc.placeholder ? '<span class="placeholder-note">hatchery art open (placeholder)</span>' : '';
    const slots = [];
    for (let i = 0; i < z.slots; i++) {
      const x = z.inc[i];
      if (x == null) slots.push(`<div class="inc ${inc.style} free">${note}${hatch}<button class="btn small" type="button" data-act="pickEgg" data-id="${z.id}" style="position:relative;z-index:1;margin-bottom:-110px">${icon('egg')} Add egg</button></div>`);
      else if (!isNum(x)) slots.push(`<div class="inc ${inc.style}">${note}${hatch}<span class="inc-label">Lent to ${elName(x.lent)} · <span data-live="lent:${z.id}:${i}"></span></span></div>`);
      else {
        const d = S.dragons[x]; if (!d) continue;
        const st = d.ready ? 3 : G.crackStage(d);
        slots.push(`<div class="inc ${inc.style}">${note}${hatch}
          <span class="eggimg ${d.ready ? 'ready' : 'crack' + st}" data-act="${d.ready ? 'hatch' : 'eggInfo'}" data-id="${d.id}" title="${d.ready ? 'Trigger the last crack!' : 'Egg'}">${imgEgg(d, 4, st)}</span>
          ${d.ready ? '<span class="inc-label"><b>Ready – click the last crack!</b></span>' : `<div class="bar gold"><i data-livew="inc:${d.id}"></i></div><span class="inc-label">${G.CLS[d.cls].name} · <span data-live="incleft:${d.id}"></span>${d.examined ? '' : ` · <a href="#" data-act="examine" data-id="${d.id}">examine</a>`}</span>`}
        </div>`);
      }
    }
    if (z.slots < C.zones.maxSlots) slots.push(`<div class="inc free"><button class="btn small" type="button" data-act="buySlot" data-id="${z.id}">+ Brood slot ${fmt(G.slotPrice(z))} G</button></div>`);
    const school = G.list(d => d.status === 'school' && d.zone === z.id).sort((a, b) => b.age - a.age);
    const residents = G.list(d => d.status === 'adult' && d.zone === z.id).length;
    const scales = z.ground.map(s => {
      const ok = G.canCollect(s);
      return `<button type="button" class="scale q-${s.q} ${S.played - s.t < 0.6 ? 'new' : ''} ${ok ? '' : 'locked'} ${s.mat || s.fractal ? 'glint' : ''}" style="left:${s.x * 100}%;top:${s.y * 100}%" data-pdown="collect" data-zone="${z.id}" data-id="${s.id}" title="${scaleTitle(s)}">${imgScale(s, 3)}</button>`;
    }).join('');
    const locked = z.ground.filter(s => !G.canCollect(s)).length;
    return `<div class="zone-head" style="--zc:${c}">
        <button class="btn small ghost" type="button" data-act="nav" data-id="world">◀ World</button>
        <h2>${zoneTitle(z)}</h2>
        <span class="info">${inc.name}${inc.placeholder ? ' (placeholder)' : ''} · ${residents} dragons live here</span>
        ${open ? '' : '<span class="tag war">portal closed</span>'}
      </div>
      <div class="section"><h3>Brood slots</h3><small>brood time ${C.incubation.seconds} s (placeholder)</small></div>
      <div class="incs">${slots.join('')}</div>
      <div class="section"><h3>Dragon School</h3><small>${school.length} pupils · the zone imprints them at 1000 years</small></div>
      ${school.length ? `<div class="grid cols-3">${school.map(d => dragonCard(d)).join('')}</div>` : '<div class="empty panel">No pupils in this zone yet.</div>'}
      <div class="section"><h3>Ground</h3><small>${z.ground.length}/${C.zones.groundCapacity} scales${locked ? ' · ' + locked + ' locked (reputation too low)' : ''}</small></div>
      <div class="ground" id="ground" style="--zc:${c}">${scales || '<div class="empty">Adult dragons drop their scales here. Collect fast to build a combo!</div>'}</div>`;
  };
  function scaleTitle(s) {
    const what = s.fractal ? 'Fractal scale ' + G.vecText(s.v) : elName(s.el) + ' scale';
    const need = G.canCollect(s) ? '' : ' – needs ' + G.REPL[G.scaleNeed(s)].name + ' with ' + elName(s.f) + (S.access[s.f] ? '' : ' (raise a dragon for them first)');
    return `${what}, lvl ${s.level}, ${C.scales.quality[s.q].name}${s.mat ? ', ' + matName(s.mat) : ''}, worth ${G.scaleSalePrice(s)} G${need}`;
  }
  function dragonCard(d, extra) {
    const mature = d.status === 'school' && d.age >= C.time.matureAge;
    return `<div class="card click" data-act="dragon" data-id="${d.id}">
      <div class="pic">${imgDragon(d, 3)}</div>
      <div class="meta"><div class="nm">${d.name} ${tags(d)}</div>${vecBar(d.v)}
        <div class="dim"><span data-live="age:${d.id}"></span> · lvl <span data-live="lvl:${d.id}"></span>${mature ? ' · <span class="mature">mature</span>' : ''}${extra || ''}</div>
        ${d.status === 'school' ? `<div class="bar"><i data-livew="school:${d.id}"></i></div>` : ''}
      </div></div>`;
  }

  SCREENS.school = function () {
    const tab = ui.tabs.school;
    const tabs = tabBar('school', [['chamber', 'Egg chamber (' + S.chamber.length + ')'], ['pupils', 'Pupils'], ['riddles', 'Riddle log']]);
    const clar = G.schoolClarity();
    let body = '';
    if (tab === 'chamber') {
      const eggs = S.chamber.map(id => S.dragons[id]).filter(Boolean);
      body = eggs.length ? `<div class="grid cols-2">${eggs.map(eggCard).join('')}</div>` : '<div class="empty panel">The egg chamber is empty. Buy eggs at the Market or pair dragons at the Nest.</div>';
    } else if (tab === 'pupils') {
      const ps = G.list(d => d.status === 'school').sort((a, b) => b.age - a.age);
      body = ps.length ? `<div class="grid cols-3">${ps.map(d => dragonCard(d, ' · ' + zoneTitle(S.zones[d.zone]))).join('')}</div>` : '<div class="empty panel">No pupils yet.</div>';
    } else {
      body = S.logs.riddle.length ? `<div class="log">${S.logs.riddle.map(r => `<div class="li ${r.hit ? 'good' : 'bad'}"><span class="t">${fmtTime(r.t)}</span><span><b>${r.name}</b>: ${r.hints.map(h => '“' + h + '”').join(' ')} → label ${elTag(r.label)} · actually ${G.vecText(r.actual)} · ${r.hit ? '<b class="good">hit</b>' : '<b class="bad">miss</b>'}</span></div>`).join('')}</div>` : '<div class="empty panel">No solved riddles yet. Examine an egg, pick a label and hatch it.</div>';
    }
    return `<div class="screen-head"><h2>Dragon School</h2><span class="chip">${icon('cap')} School rep <b>${fmt(S.schoolRep)}</b> · clarity ${clar}/${C.riddle.maxClarity}${S.streak ? ' · streak ' + S.streak : ''}</span></div>${tabs}${body}`;
  };
  function eggCard(d) {
    const cls = G.CLS[d.cls || 'cheap'];
    const extra = [];
    if (d.bred && d.parents) { const a = S.dragons[d.parents[0]], b = S.dragons[d.parents[1]]; extra.push('clutch of ' + (a ? a.name : '?') + ' × ' + (b ? b.name : '?')); }
    if (d.wonder) extra.push('<span class="epic">wonder egg</span>');
    if (d.stolen) extra.push('<span class="bad">stolen</span>');
    if (d.riddleFaction != null) extra.push('Riddle of the Elders (' + elName(d.riddleFaction) + ')');
    const label = d.riddle && d.riddle.label != null ? ' · label ' + elTag(d.riddle.label) : '';
    return `<div class="card"><div class="pic" data-act="eggInfo" data-id="${d.id}">${imgEgg(d, 4)}</div>
      <div class="meta"><div class="nm">${cls.name} egg${label}</div><small>${extra.join(' · ') || (d.bought ? 'from the merchant' : '')}</small>
        <div class="acts">
          ${d.examined ? `<button class="btn small ghost" type="button" data-act="riddle" data-id="${d.id}">${icon('lupe')} Riddle</button>` : `<button class="btn small ghost" type="button" data-act="examine" data-id="${d.id}">${icon('lupe')} Examine ${G.examineCost(d)} G</button>`}
          <button class="btn small go" type="button" data-act="pickZone" data-id="${d.id}">Incubate</button>
          <button class="btn small" type="button" data-act="sellEgg" data-id="${d.id}">Sell ${fmt(G.eggSalePrice(d))} G</button>
        </div></div></div>`;
  }

  SCREENS.nest = function () {
    const cands = G.list(d => G.canPairCandidate(d)).sort((a, b) => (a.status === b.status ? a.id - b.id : a.status === 'school' ? -1 : 1));
    const nests = S.nests.map((n, i) => {
      if (n) {
        const a = S.dragons[n.a], b = S.dragons[n.b];
        const pv = G.inheritPreview(a, b);
        return `<div class="panel nest-card">
          <div class="row"><h3>Nest ${i + 1}</h3><span class="spacer"></span><span class="tag" data-live-cls="${i}" data-live="nest:${i}"></span></div>
          <div class="nest-pair"><div class="card click" data-act="dragon" data-id="${a.id}"><div class="pic">${imgDragon(a, 2)}</div><div class="meta"><b>${a.name}</b><small>${a.status === 'adult' ? elName(a.faction) : 'pupil'}</small></div></div>
            <div class="nest-heart on">${icon('heart', 3)}</div>
            <div class="card click" data-act="dragon" data-id="${b.id}"><div class="pic">${imgDragon(b, 2, true)}</div><div class="meta"><b>${b.name}</b><small>${b.status === 'adult' ? elName(b.faction) : 'pupil'}</small></div></div></div>
          ${previewHtml(pv)}
          <div class="row"><small>On average every ${Math.round(1 / (C.breed.chancePerYear * ((G.law() && G.law().breedMult) || 1)))} years, with a wide spread.</small><span class="spacer"></span><button class="btn small danger" type="button" data-act="unpair" data-id="${i}">Separate</button></div>
        </div>`;
      }
      const used = new Set(); S.nests.forEach(x => { if (x) { used.add(x.a); used.add(x.b); } });
      const sel = ui.nestSel[i] || {};
      const opts = which => `<option value="">– choose –</option>` + cands.filter(d => !used.has(d.id)).map(d => `<option value="${d.id}" ${+sel[which] === d.id ? 'selected' : ''}>${d.name} · ${d.status === 'adult' ? elName(d.faction) + ' (adult)' : Math.floor(d.age) + ' yrs'} · ${G.vecText(d.v)}</option>`).join('');
      let pv = '';
      if (sel.a && sel.b && S.dragons[sel.a] && S.dragons[sel.b]) {
        const v = G.pairValid(+sel.a, +sel.b);
        pv = v.ok ? previewHtml(G.inheritPreview(S.dragons[sel.a], S.dragons[sel.b])) : `<p class="bad"><b>${v.msg}</b></p>`;
      }
      return `<div class="panel nest-card"><h3>Nest ${i + 1}</h3>
        <div class="nest-pair"><select data-nest="${i}" data-which="a" aria-label="First dragon">${opts('a')}</select><div class="nest-heart">${icon('heart', 3)}</div><select data-nest="${i}" data-which="b" aria-label="Second dragon">${opts('b')}</select></div>
        ${pv}<div class="row"><span class="spacer"></span><button class="btn small" type="button" data-act="pair" data-id="${i}">${icon('heart')} Pair</button></div></div>`;
    }).join('');
    return `<div class="screen-head"><h2>Nesting Ground</h2><span class="sub">Pairs from 300 years: pupils, or adults of factions where you are Friendly. Arch-enemies never mate.</span></div>
      ${cands.length ? '' : '<div class="panel empty" style="margin-bottom:14px">No dragons can breed yet. Pupils mature at 300 years (5 minutes).</div>'}
      <div class="grid cols-2">${nests}</div>`;
  };
  function previewHtml(pv) {
    if (pv.pure) return `<div class="preview"><b>Guaranteed purebred: ${elTag(pv.el)}</b></div>`;
    return `<div class="preview"><small>${icon('lupe')} Possible results (before imprinting)</small>${pv.ranges.map(r => `<div class="rng"><span>${elTag(r.el)}</span><span class="rngbar"><i style="left:${r.min * 5}%;width:${Math.max(2, (r.max - r.min) * 5)}%;background:${EL[r.el].color}"></i></span><span>${r.min * 5}–${r.max * 5} %</span></div>`).join('')}<small>+ ${pct(pv.mutation)} chance of a mutation (new element)</small></div>`;
  }

  SCREENS.market = function () {
    const l = G.law();
    const cheap = G.CLS.cheap;
    const offers = S.market.offers.map(o => {
      const c = G.CLS[o.cls];
      return `<div class="panel offer">${im(SP.egg({ shell: c.shell, spots: c.spots, seed: o.id }, 4), '')}<span class="oname">${c.name} egg</span>
        <small>dud ${pct(c.dud)} · refund ${pct(c.refund)}</small><span class="price">${fmt(G.eggPrice(o.cls))} G</span>
        <div class="bar timer"><i data-livew="offer:${o.id}"></i></div><small>expires in <span data-live="offerleft:${o.id}"></span></small>
        <button class="btn small" type="button" data-act="buyEgg" data-cls="${o.cls}" data-offer="${o.id}">Buy</button></div>`;
    }).join('');
    const sat = EL.map((e, i) => S.market.sat[i] > 0.3 ? `<span>${sw(i)} −${Math.round((1 - 1 / (1 + C.market.saturationStrength * S.market.sat[i])) * 100)} %</span>` : '').filter(Boolean).join(' ');
    let invTotal = 0, invCount = 0;
    for (const kind of ['normal', 'fractal']) for (const k in S.inventory[kind]) { const n = S.inventory[kind][k]; invTotal += G.scaleSalePrice(G.parseKey(kind, k)) * n; invCount += n; }
    return `<div class="screen-head"><h2>The Merchant</h2><span class="sub">Buy and sell eggs. No real-money purchases, ever.</span></div>
      <div class="grid cols-4">
        <div class="panel offer">${im(SP.egg({ shell: cheap.shell, spots: cheap.spots, seed: 7 }, 4), '')}<span class="oname">Cheap egg</span><small>random mix · the only source of metal and gem dragons</small>
          <small>dud ${pct(cheap.dud)} · refund ${pct(cheap.refund)}</small><span class="price">${fmt(G.eggPrice('cheap'))} G</span>
          <div class="row"><button class="btn small" type="button" data-act="buyEgg" data-cls="cheap">Buy</button><button class="btn small ghost" type="button" data-act="buyEgg" data-cls="cheap" data-n="5">×5</button></div></div>
        <div class="panel offer wonder">${im(SP.egg({ shell: '#E7A6E0', spots: '#FFF27A', seed: 99, glow: '#FFFFFF' }, 4), '')}<span class="oname">Wonder egg</span><small>free once a day · never a dud · class is rolled</small>
          <span class="price" data-live="wonder"></span><button class="btn small" type="button" data-act="wonder" ${G.wonderAvailable() ? '' : 'disabled'}>Claim</button></div>
        ${offers}
      </div>
      <div class="section"><h3>Selling</h3></div>
      <div class="panel row"><span>${icon('bag')} ${fmt(invCount)} scales in your bag · worth <b>${fmt(invTotal)} G</b>${l && l.scaleTax ? ' <small class="bad">(after ' + pct(l.scaleTax) + ' levy)</small>' : ''}</span><span class="spacer"></span><button class="btn small" type="button" data-act="sellAll">Sell all scales</button><button class="btn small ghost" type="button" data-act="nav" data-id="bag">Open bag</button></div>
      <p style="color:#e9dcff">Sell eggs in the School's egg chamber (${pct(C.market.buybackRate)} of the price, examined +${pct(C.market.examinedBonus)}).</p>
      <div class="section"><h3>Merchant's ledger</h3></div>
      <div class="panel grid cols-2">
        <div>Dud shells: <b>${S.market.shells}/${C.market.pityShells}</b> <small>– then a guaranteed egg of a higher class</small><div class="bar ember"><i style="width:${S.market.shells / C.market.pityShells * 100}%"></i></div></div>
        <div>Luck counter: <b>+${S.market.luck} %</b> <small>material chance, grows with every Cheap egg without material</small></div>
        <div>Law: <b>${l ? l.name : C.lawPlaceholder.name}</b> <small>${l ? l.text : C.lawPlaceholder.text}</small></div>
        <div>Saturation: ${sat || '<small>none – the merchant pays in full</small>'}</div>
      </div>`;
  };

  SCREENS.factions = function () {
    const tab = ui.tabs.factions;
    const tabs = tabBar('factions', [['overview', 'Overview'], ['matrix', 'Relations'], ['net', 'Network'], ['wars', 'Wars']]);
    const king = S.king && S.dragons[S.king];
    const l = G.law();
    const al = G.alliances();
    const war = S.war ? `<div class="bad">${icon('sword')} <b>${S.war.phase === 'announce' ? 'War threat' : 'War'}: ${elName(S.war.attacker)} vs ${elName(S.war.defender)}</b></div>` : `<div>${icon('peace')} Peace in the sky.</div>`;
    const head = `<div class="panel grid cols-2">
      <div class="kingbox">${king ? `<div class="pic" data-act="dragon" data-id="${king.id}">${imgDragon(king, 3)}</div>` : ''}<div>${icon('crown')} <b>${king ? king.name : '–'}</b><br><small>Dragon King · ${elTag(S.ruler)}${king ? ' · <span data-live="age:' + king.id + '"></span>' : ''}</small></div></div>
      <div>${icon('scroll')} <b>${l ? l.name : C.lawPlaceholder.name}</b><br><small>${l ? l.text : C.lawPlaceholder.text}</small></div>
      <div><small>Government:</small> ${S.gov.map(id => S.dragons[id]).filter(Boolean).map(d => `<a href="#" data-act="dragon" data-id="${d.id}">${d.name}</a>`).join(', ') || '–'}</div>
      <div>${war}</div>
      <div><small>Alliances:</small> ${al.length ? al.map(a => `<span class="tag" style="background:${a.color}">${a.name}</span>`).join(' ') : '<small>none</small>'}</div>
    </div>`;
    let body = '';
    if (tab === 'overview') body = `<div class="grid cols-2">${EL.map((e, f) => factionCard(f)).join('')}</div>`;
    else if (tab === 'matrix') body = matrixHtml();
    else if (tab === 'net') body = netHtml();
    else body = S.logs.wars.length ? `<div class="log">${S.logs.wars.map(w => `<div class="li war"><span class="t">${fmtTime(w.t)}</span><span>${elTag(w.attacker)} (power ${w.pa.toFixed(1)}) vs ${elTag(w.defender)} (power ${w.pd.toFixed(1)}) · chance ${pct(w.chance)} · roll ${w.roll.toFixed(3)} → <b>${elName(w.winner)} wins</b>${w.newRuler ? ' · new ruler' : ''}${w.fates.length ? '<br>' + w.fates.map(x => x.name + ': ' + fateText(x.fate)).join(' · ') : ''}</span></div>`).join('')}</div>` : '<div class="empty panel">No war yet.</div>';
    return `<div class="screen-head"><h2>The Factions</h2><span class="sub">Twelve elements fight over the sky.</span></div>${head}<div style="height:16px"></div>${tabs}${body}`;
  };
  function factionCard(f) {
    const F = S.factions[f]; const N = G.adultsOf(f).length; const risk = G.warRisk(f);
    const wv = C.factions.worldviews[EL[f].id] || C.factions.worldviewPlaceholder;
    const lvl = G.REPL[G.repLevel(f)];
    const young = G.list(d => d.status === 'wild' && d.faction === f).length;
    const acts = S.access[f] ? (S.offers[f] || []).map((o, i) => {
      const a = G.ACTI[o.id];
      const tgt = o.target != null ? ' → ' + elTag(o.target) : '';
      return `<div class="act ${o.done ? 'done' : ''}"><div><span class="grp ${a.group}">${a.group}</span> <b>${a.name}</b>${tgt}<br><small>${a.desc}${actCost(o.id)}</small></div>
        <button class="btn small ${o.done ? 'ghost' : ''}" type="button" data-act="activity" data-f="${f}" data-i="${i}" ${o.done ? 'disabled' : ''}>${o.done ? 'done' : 'Do it'}</button></div>`;
    }).join('') : '<small>First raise a dragon that chooses to join this faction.</small>';
    const needs = [['raum', 'Space'], ['brut', 'Brood'], ['ehre', 'Honour'], ['tribut', 'Tribute']];
    const dark = f === 3;
    return `<div class="panel fac">
      <div class="fac-head" style="background:${EL[f].color}${dark ? ';background-image:var(--dots-light);background-size:7px 7px' : ''}">${f === S.ruler ? icon('crown') : ''}<h3>${elName(f)}</h3><span class="tag">${S.access[f] ? lvl.name : 'no access'}</span></div>
      <div class="repbar"><div class="bar gold"><i data-livew="repbar:${f}"></i></div><small><span data-live="rep:${f}"></span></small></div>
      <div class="row" style="font-size:14px"><span>Dragons <b>${N}</b>/${C.factions.capacity}</span><span>Power <b data-live="power:${f}"></b></span><span>War risk <b data-live="risk:${f}"></b></span><span>Nest ${F.nest.length} · young ${young}</span><span>Arch-enemy ${sw(G.enemyOf(f))}</span></div>
      <div class="needs ${risk > 0.35 ? 'alarm' : ''}">${needs.map(n => `<div>${n[1]}<div class="bar ${n[0] === 'raum' ? '' : 'gold'}"><i data-livew="need:${f}:${n[0]}"></i></div></div>`).join('')}</div>
      <small class="${wv.placeholder ? 'mute' : ''}">Worldview: ${wv.text} (compromise ${pct(wv.k)})</small>
      <div class="acts">${acts}</div>
    </div>`;
  }
  function actCost(id) {
    const c = C.activities.costs;
    const m = { nestCare: c.nestCare + ' G', smallNeed: c.smallNeed + ' G', banner: c.banner + ' G', forgeAlliance: c.alliance + ' G', peace: c.peace + ' G', mixedPool: c.mixedPool + ' G', scaleOffer: c.scaleOffer + ' scales', armor: c.armor + ' war-marked scales', fractalGift: '1 fractal scale' }[id];
    return m ? ' · cost: ' + m : '';
  }
  function relColor(r) { if (r >= 0) return `rgba(63,184,90,${0.15 + r / 120})`; return `rgba(255,77,61,${0.15 - r / 120})`; }
  function matrixHtml() {
    const hidden = new Set(S.hidden);
    let h = '<div class="panel matrix-wrap"><table class="matrix"><tr><th></th>' + EL.map((e, i) => `<th>${sw(i)}</th>`).join('') + '</tr>';
    for (let a = 0; a < NE; a++) {
      h += `<tr><th>${sw(a)}</th>`;
      for (let b = 0; b < NE; b++) {
        if (a === b) { h += '<td style="background:var(--ink)"></td>'; continue; }
        if (hidden.has(a * NE + b)) { h += '<td title="hidden by the Shadow Edict">?</td>'; continue; }
        const r = Math.round(S.rel[a][b]);
        const al = G.allied(a, b);
        h += `<td style="background:${al ? G.allianceColor(a, b) : relColor(r)}" title="${elName(a)} about ${elName(b)}: ${r}${al ? ' · alliance ' + G.allianceName(a, b) : ''}${G.isEnemy(a, b) ? ' · arch-enemies' : ''}">${G.isEnemy(a, b) ? '✕' : r}</td>`;
      }
      h += '</tr>';
    }
    return h + `</table><p class="center"><small>Row = what that faction thinks of the column (−100 hostile … +100 allied). Alliance from ${C.relations.allianceThreshold} in both directions. ✕ = arch-enemies.</small></p></div>`;
  }
  function netHtml() {
    const R = 150, cx = 200, cy = 190; const pos = EL.map((e, i) => [cx + R * Math.cos(i / NE * Math.PI * 2 - Math.PI / 2), cy + R * Math.sin(i / NE * Math.PI * 2 - Math.PI / 2)]);
    const hidden = new Set(S.hidden);
    let lines = '';
    for (let a = 0; a < NE; a++) for (let b = a + 1; b < NE; b++) {
      if (hidden.has(a * NE + b) || hidden.has(b * NE + a)) continue;
      const r = (S.rel[a][b] + S.rel[b][a]) / 2;
      const al = G.allied(a, b);
      if (!al && Math.abs(r) < C.relations.strong) continue;
      const col = al ? G.allianceColor(a, b) : r > 0 ? '#3fb85a' : '#ff4d3d';
      if (al) lines += `<line x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}" stroke="#1b1024" stroke-width="10"/>`;
      lines += `<line x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}" stroke="${col}" stroke-width="${al ? 6 : 3}" ${r < 0 ? 'stroke-dasharray="7 5"' : ''}><title>${elName(a)} – ${elName(b)}: ${Math.round(r)}${al ? ' · ' + G.allianceName(a, b) : ''}</title></line>`;
      if (al) lines += `<text x="${(pos[a][0] + pos[b][0]) / 2}" y="${(pos[a][1] + pos[b][1]) / 2 - 8}" fill="${col}" font-size="18" text-anchor="middle" font-family="Bangers" stroke="#1b1024" stroke-width="4" paint-order="stroke" letter-spacing="1">${G.allianceName(a, b)}</text>`;
    }
    const nodes = EL.map((e, i) => `<g><rect x="${pos[i][0] - 14}" y="${pos[i][1] - 14}" width="28" height="28" rx="4" fill="${e.color}" stroke="${i === S.ruler ? '#ffd23f' : '#1b1024'}" stroke-width="${i === S.ruler ? 5 : 3}"/><text x="${pos[i][0]}" y="${pos[i][1] + (pos[i][1] > cy ? 34 : -22)}" fill="#1b1024" font-size="17" text-anchor="middle" font-family="Bangers" letter-spacing="1">${e.name}</text></g>`).join('');
    return `<div class="panel"><svg class="net" viewBox="0 0 400 380" role="img" aria-label="Faction relationship network">${lines}${nodes}</svg>
      <div class="legend"><span><span class="sw" style="background:#3fb85a"></span> strong liking</span><span><span class="sw" style="background:#ff4d3d"></span> strong dislike</span><span>thick = alliance with its own colour and name</span></div></div>`;
  }
  const fateText = f => ({ fallen: '<b class="bad">fallen</b>', defect: '<b class="good">defected to the victor</b>', fled: '<span class="mute">fled</span>', stay: 'stays as a subject' })[f];

  SCREENS.bag = function () {
    const tab = ui.tabs.bag;
    const tabs = tabBar('bag', [['scales', 'Scales'], ['collection', 'Collection']]);
    if (tab === 'collection') {
      let h = `<div class="panel"><p>Metal and gem dragons hatch only from Cheap eggs. 20 tiers per element.</p><div class="table-wrap"><div class="coll"><span></span>${C.material.tiers.map((t, i) => `<span title="${t.name} · 1 : ${Math.round(1 / G.materialChance(i + 1))}">${i + 1}</span>`).join('')}`;
      EL.forEach((e, f) => {
        const have = S.collection[e.id] || {};
        h += `<span>${sw(f)} ${e.name}</span>` + C.material.tiers.map((t, i) => `<span class="cell ${have[i + 1] ? 'have' : ''}" style="${have[i + 1] ? 'background:' + t.color : ''}" title="${t.name}${have[i + 1] ? ' ×' + have[i + 1] : ' – not found yet'}"></span>`).join('');
      });
      return `<div class="screen-head"><h2>Your Bag</h2></div>${tabs}${h}</div></div></div>`;
    }
    const rows = [];
    for (const kind of ['fractal', 'normal']) for (const key of Object.keys(S.inventory[kind])) {
      const s = G.parseKey(kind, key); const n = S.inventory[kind][key];
      rows.push({ s, n, kind, key, each: G.scaleSalePrice(s) });
    }
    rows.sort((a, b) => b.each - a.each);
    const total = rows.reduce((t, r) => t + r.each * r.n, 0);
    const table = rows.length ? `<div class="panel table-wrap"><table class="list"><tr><th></th><th>Scale</th><th>Lvl</th><th>Quality</th><th>Zone</th><th>Count</th><th>Each</th><th></th></tr>
      ${rows.map(r => `<tr><td>${imgScale(r.s, 3)}</td><td>${r.s.fractal ? '<b class="epic">Fractal</b> ' + G.vecText(r.s.v) : elTag(r.s.el)}${r.s.mat ? ' <span class="tag mat">' + matName(r.s.mat) + '</span>' : ''}</td><td>${r.s.level}</td>
        <td><span class="tag" style="background:${C.scales.quality[r.s.q].color}">${C.scales.quality[r.s.q].name}</span></td><td>×${(1 + r.s.zn / G.STEPS).toFixed(2)}</td><td>${fmt(r.n)}</td><td><b>${fmt(r.each)} G</b></td>
        <td><div class="row"><button class="btn small ghost" type="button" data-act="sellStack" data-kind="${r.kind}" data-key="${r.key}" data-n="1">1</button><button class="btn small" type="button" data-act="sellStack" data-kind="${r.kind}" data-key="${r.key}">All</button></div></td></tr>`).join('')}</table></div>` : '<div class="empty panel">No scales yet. Adult dragons drop them in their zone.</div>';
    return `<div class="screen-head"><h2>Your Bag</h2><span class="chip">${icon('coin')} worth <b>${fmt(total)} G</b></span>${rows.length ? '<button class="btn small" type="button" data-act="sellAll">Sell everything</button>' : ''}</div>${tabs}${table}
      <p style="color:#e9dcff">Value = base × level × (1 + zone share) × quality × (fractal ×${C.scales.fractalFactor}) × material · ruler's element ×${C.scales.rulerDemand}, its arch-enemy ×${C.scales.rulerEnemyDemand}.</p>`;
  };

  SCREENS.log = function () {
    const tab = ui.tabs.log;
    const tabs = tabBar('log', [['breed', 'Breeding log'], ['rolls', 'Rolls'], ['events', 'Events']]);
    let body = '';
    if (tab === 'breed') {
      const st = S.stats; const tot = st.clutches;
      const exp = expectedClutch();
      const max = Math.max(0.01, ...exp, ...st.clutch.map(c => tot ? c / tot : 0));
      const hist = st.clutch.map((c, z) => `<div class="col" title="${z} eggs: ${c}× (${tot ? pct(c / tot) : '–'}) · expected ${(exp[z] * 100).toFixed(2)} %"><i style="height:${tot ? c / tot / max * 100 : 0}%"></i><b style="bottom:${exp[z] / max * 100}%"></b></div>`).join('');
      const mean = tot ? st.clutch.reduce((s, c, z) => s + c * z, 0) / tot : 0;
      body = `<div class="panel"><div class="row"><h3>Statistics</h3><span class="spacer"></span><small>${fmt(tot)} clutches · mean ${mean.toFixed(2)} eggs (expected ${(57 / 28).toFixed(2)})</small></div>
        <div class="hist">${hist}</div><div class="hist-x">${st.clutch.map((c, z) => `<span>${z}</span>`).join('')}</div><small>bars = observed, dashed = expected (gate roll 0–6, then x, y, z).</small></div>
        <div style="height:12px"></div><div class="log">${S.logs.breed.map(b => `<div class="li"><span class="t">${fmtTime(b.t)}</span><span>${b.wild != null ? 'Wild nest ' + elTag(b.wild) : '<b>' + b.a + ' × ' + b.b + '</b>'} · gate ${b.roll.a}${b.roll.a ? ' · x ' + b.roll.x + ' · y ' + b.roll.y + ' · z ' + b.roll.z : ' (empty)'} → <b>${b.roll.z} eggs</b></span></div>`).join('') || '<div class="empty panel">No clutches yet.</div>'}</div>`;
    } else if (tab === 'rolls') {
      body = `<div class="log">${S.logs.rolls.map(r => `<div class="li"><span class="t">${fmtTime(r.t)}</span><span>${r.label}: <b>${r.value}</b> <small>(${r.range})</small></span></div>`).join('') || '<div class="empty panel">No rolls yet.</div>'}</div><p style="color:#e9dcff">Randomness: seedable generator (seed ${S.seed}). Every roll is logged openly here.</p>`;
    } else {
      body = `<div class="log">${S.logs.events.map(e => `<div class="li ${e.kind}"><span class="t">${fmtTime(e.t)}</span><span>${e.text}</span></div>`).join('') || '<div class="empty panel">Nothing has happened yet.</div>'}</div>`;
    }
    return `<div class="screen-head"><h2>The Log</h2></div>${tabs}${body}`;
  };
  function expectedClutch() {
    const out = new Array(C.breed.xMax + 1).fill(0); const pg = 1 / (C.breed.gateMax + 1);
    out[0] = pg;
    for (let x = 1; x <= C.breed.xMax; x++) for (let y = 1; y <= x; y++) for (let z = 1; z <= y; z++) out[z] += (1 - pg) / C.breed.xMax / x / y;
    return out;
  }
  function tabBar(group, items) { return `<div class="tabs">${items.map(t => `<button class="btn small ${ui.tabs[group] === t[0] ? 'on' : ''}" type="button" data-act="tab" data-group="${group}" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`; }

  // ------------------------------------------------------------ rendering
  function render(force) {
    const html = (SCREENS[ui.screen] || SCREENS.world)();
    const ae = document.activeElement;
    const busy = ae && ae.tagName === 'SELECT' && view.contains(ae);
    if ((force || html !== ui.last) && (!busy || force)) { view.innerHTML = html; ui.last = html; }
    applyLive();
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === (ui.screen === 'zone' ? 'world' : ui.screen)));
    navDots();
  }
  function navDots() {
    const ready = Object.values(S.zones).some(z => z.inc.some(x => isNum(x) && S.dragons[x] && S.dragons[x].ready));
    const dots = { world: ready, nest: S.nests.some(n => n && G.nestRestless(n)), market: G.wonderAvailable() };
    document.querySelectorAll('.nav button').forEach(b => {
      const on = !!dots[b.dataset.nav]; let d = b.querySelector('.dot');
      if (on && !d) { d = document.createElement('span'); d.className = 'dot'; b.appendChild(d); } else if (!on && d) d.remove();
    });
  }
  function updateTop() {
    $('#gold').textContent = fmt(S.gold);
    $('#schoolrep').textContent = fmt(S.schoolRep);
    $('#played').textContent = fmtTime(S.played);
    const k = S.king && S.dragons[S.king];
    const rc = `${icon('crown')} ${sw(S.ruler)} <b>${elName(S.ruler)}</b>${k ? ' <small>' + k.name + '</small>' : ''}`;
    if (ui.rulerHtml !== rc) { $('#ruler-chip').innerHTML = rc; ui.rulerHtml = rc; }
    const snd = icon(S.settings.sound ? 'sound' : 'mute', 2);
    if (ui.sndHtml !== snd) { $('#btn-sound').innerHTML = snd; ui.sndHtml = snd; }
    const an = icon('play', 2) + `<small>${({ auto: 'AUTO', full: 'FULL', short: 'SHORT' })[S.settings.anim]}</small>`;
    if (ui.animHtml !== an) { $('#btn-anim').innerHTML = an; ui.animHtml = an; }
  }

  // ------------------------------------------------------------ modals
  function dragonModal(id) {
    const d = S.dragons[id]; if (!d) return;
    if (d.status === 'egg' || d.status === 'incubating') return eggModal(id);
    const parents = d.parents ? d.parents.map(p => S.dragons[p]).filter(Boolean).map(p => p.name).join(' × ') : '';
    const statusText = { school: 'Pupil in the ' + zoneTitle(S.zones[d.zone]), adult: 'Adult · belongs to ' + elName(d.faction), wild: 'Young wild dragon' }[d.status] || d.status;
    showModal({ rebuild: () => dragonModalHtml(d, statusText, parents), build(b) { b.innerHTML = this.rebuild(); } }, true);
  }
  function dragonModalHtml(d, statusText, parents) {
    return `<h2>${d.name}</h2><div class="reveal"><div class="hero ${d.mat ? 'mat' : ''}">${imgDragon(d, 7)}</div><div>${tags(d)}</div></div>
      <p class="center"><b>${statusText}</b></p>
      <h3>${icon('lupe')} Magnifier – exact shares</h3>${vecRows(d.v)}
      <div class="grid cols-2" style="margin-top:12px;gap:6px">
        <div>Age: <b data-live="age:${d.id}"></b></div><div>Level: <b data-live="lvl:${d.id}"></b></div>
        ${d.status === 'adult' ? `<div>Strength: <b data-live="str:${d.id}"></b></div><div>Scales: lvl ${1 + Math.max(0, Math.floor(Math.log2(G.ageOf(d) / 1000)))} · zone ×${(1 + d.zn / 20).toFixed(2)}</div>` : `<div>Mature: ${d.age >= C.time.matureAge ? '<b class="good">yes</b>' : 'at 300 yrs'}</div><div>Adult at 1000 yrs</div>`}
        ${d.mat ? `<div>Material: <b>${matName(d.mat)}</b> (tier ${d.mat}, 1 : ${Math.round(1 / G.materialChance(d.mat))})</div>` : ''}
        ${parents ? `<div>Parents: ${parents}</div>` : ''}
      </div>`;
  }
  function eggModal(id) {
    showModal({
      rebuild() {
        const d = S.dragons[id]; if (!d) return '<p>This egg no longer exists.</p>';
        const cls = G.CLS[d.cls || 'cheap'];
        const h = `<h2>${cls.name} egg</h2><div class="reveal"><div class="hero">${imgEgg(d, 7, d.status === 'incubating' ? (d.ready ? 3 : G.crackStage(d)) : 0)}</div></div>`;
        if (!d.examined) {
          return h + `<p class="center">What sleeps inside is uncertain. The magnifier examines the egg and gives you a riddle.</p><div class="row" style="justify-content:center"><button class="btn" type="button" data-act="examine" data-id="${d.id}">${icon('lupe')} Examine (${G.examineCost(d)} G)</button></div>`;
        }
        const r = d.riddle;
        return h + `<h3>${icon('lupe')} Magnifier – uncertain candidates</h3><p class="center">${r.cand.map(e => `33 % ${elTag(e)} (?)`).join(' · ')}</p>
          <h3>The riddle</h3><div class="riddle">${r.hints.map(t => `<i>“${t}”</i>`).join('')}</div>
          <p style="margin-top:18px"><small>Clarity ${r.clarity}/${C.riddle.maxClarity} – higher school reputation makes riddles clearer. The label is only a note and does not change the egg.</small></p>
          <h3>Pick a label</h3><div class="labels">${r.cand.map(e => `<button class="btn ${r.label === e ? 'on' : ''}" type="button" data-act="label" data-id="${d.id}" data-el="${e}">${elTag(e)}${r.label === e ? ' ✔' : ''}</button>`).join('')}</div>`;
      },
      build(b) { b.innerHTML = this.rebuild(); },
    }, true);
  }
  function pickZoneModal(eggId) {
    showModal({
      html: `<h2>Where to incubate?</h2><p>The zone decides whether the dragon reaches its potential: scale value ×(1 + share of the zone's element). At 1000 years the zone imprints it by one step – if it carries the zone's arch-enemy, it turns <b>deep</b> instead.</p>
        <div class="grid" style="gap:8px">${Object.values(S.zones).filter(z => z.unlocked).map(z => {
          const free = z.inc.slice(0, z.slots).filter(x => x == null).length; const open = G.zoneOpen(z);
          return `<button class="btn ${free && open ? '' : 'ghost'}" type="button" data-act="incubate" data-id="${eggId}" data-zone="${z.id}" ${free && open ? '' : 'disabled'}>${swc(G.zoneColor(z))} ${zoneTitle(z)} · ${G.incubatorOf(z).name} · ${free} free</button>`;
        }).join('')}</div>`,
    }, true);
  }
  function pickEggModal(zoneId) {
    const eggs = S.chamber.map(id => S.dragons[id]).filter(Boolean);
    showModal({
      html: `<h2>Add an egg</h2>${eggs.length ? `<div class="grid" style="gap:8px">${eggs.map(d => `<div class="card"><div class="pic">${imgEgg(d, 3)}</div><div class="meta"><b>${G.CLS[d.cls].name} egg</b><small>${d.riddle && d.riddle.label != null ? 'label ' + elTag(d.riddle.label) : d.examined ? 'examined' : 'not examined'}</small></div><button class="btn small go" type="button" data-act="incubate" data-id="${d.id}" data-zone="${zoneId}">Incubate here</button></div>`).join('')}</div>` : '<p>The egg chamber is empty.</p><button class="btn" type="button" data-act="nav" data-id="market">To the Market</button>'}`,
    }, true);
  }

  // hatching: reveal bar by bar
  function hatchReveal(res) {
    if (res.dud) {
      Snd.bad();
      showModal({ html: `<h2>A dud!</h2><div class="reveal"><div class="hero">${im(SP.egg({ shell: '#8c8496', spots: '#5d566a', crack: 3, seed: 3 }, 7), '')}</div>
        <p>The egg was empty. The shell is refunded: <b>+${fmt(res.refund)} G</b> (${pct(G.CLS[res.cls].refund)}).</p>
        <p><small>Dud shells: ${S.market.shells}/${C.market.pityShells}</small></p>${res.pity ? `<p class="epic"><b>Pity rule: a guaranteed ${G.CLS[res.pity.cls].name} egg waits in the egg chamber!</b></p>` : ''}</div>` }, true);
      return;
    }
    const d = res.dragon;
    const mode = animMode(!!(d.mat || G.isPure(d.v) || res.impossible || mutated(d)));
    const m = {
      busy: true,
      build(b) {
        const els = G.present(d.v).sort((x, y) => d.v[y] - d.v[x]);
        b.innerHTML = `<h2>Hatched!</h2><div class="reveal"><div class="hero ${d.mat ? 'mat' : ''}" id="hx" style="visibility:hidden">${imgDragon(d, 7)}</div><div class="big" id="hn">…</div>
          <div class="vecrows" style="width:100%">${els.map(e => `<div class="vecrow" data-e="${e}" style="visibility:hidden"><span>${elTag(e)}</span><div class="bar"><i style="width:0;background:${EL[e].color}"></i></div><b>${d.v[e] * 5} %</b></div>`).join('')}</div>
          <div id="hextra"></div><button class="btn small ghost" type="button" data-act="skip">Skip</button></div>`;
        (async () => {
          const step = mode === 'full' ? 500 : 140;
          Snd.tone(330, 0.3, 'triangle', 0.08);
          await wait(step);
          $('#hx').style.visibility = 'visible'; Snd.hatch();
          for (const row of b.querySelectorAll('.vecrow')) { row.style.visibility = 'visible'; const e = +row.dataset.e; row.querySelector('i').style.width = d.v[e] * 5 + '%'; Snd.egg(d.v[e] / 2); await wait(step); }
          const ex = [];
          if (d.mat) { ex.push(`<div class="fanfare">${matName(d.mat).toUpperCase()} DRAGON!</div><div><small>tier ${d.mat} of 20 · chance 1 : ${Math.round(1 / G.materialChance(d.mat))}</small></div>`); Snd.epic(); flash(); }
          if (G.isPure(d.v)) ex.push('<div class="fanfare">Purebred!</div>');
          if (res.impossible) ex.push('<div class="epic"><b>An impossible dragon – it carries arch-enemy elements!</b></div>');
          if (mutated(d)) { ex.push(`<div class="epic"><b>Mutation! New element: ${elTag(d.mutated)}</b></div>`); flash(); }
          if (res.hit === true) { ex.push(`<div class="good"><b>Guessed right! School reputation rises${S.streak > 1 ? ' (streak ' + S.streak + ')' : ''}.</b></div>`); Snd.coin(); }
          if (res.hit === false) ex.push('<div class="bad"><b>Label missed.</b></div>');
          $('#hn').textContent = d.name;
          $('#hextra').innerHTML = ex.join('');
          m.busy = false;
          const sk = b.querySelector('[data-act="skip"]'); if (sk) sk.outerHTML = '<button class="btn" type="button" data-act="closeModal">Continue</button>';
        })();
      },
    };
    showModal(m, true);
  }

  // clutch animation [FIXED: transparent and thrilling]
  function animMode(special) {
    const a = S.settings.anim;
    if (a === 'full') return 'full';
    if (a === 'short') return 'short';
    return special ? 'full' : 'short';
  }
  function clutchModal(ev) {
    const a = S.dragons[ev.a], b = S.dragons[ev.b];
    const r = ev.roll;
    const mode = animMode(true); // targeted pairings get the full animation in auto mode
    const mix = a && b ? G.mixColor(a.v.map((x, i) => (x + b.v[i]) / 2)) : '#ffd23f';
    const m = {
      busy: true,
      build(body) {
        body.innerHTML = `<h2>A clutch!</h2><div class="clutch"><b>${a ? a.name : '?'} × ${b ? b.name : '?'}</b>
          <div class="nestbowl flicker" id="bowl" style="--glow:${mix}"><div class="slots">${Array.from({ length: 12 }, (_, i) => `<div class="shadow-egg off" data-i="${i}"></div>`).join('')}</div></div>
          <div class="counter" id="ctr">…</div><div class="rolls" id="rolls"></div><div id="cmsg"></div>
          <button class="btn small ghost" type="button" data-act="skip">Skip</button></div>`;
        run(body);
      },
    };
    const T = mode === 'full' ? 1 : 0.22;
    async function spin(el, lo, hi, final, ms) {
      const steps = Math.max(4, Math.round(ms / 70));
      for (let i = 0; i < steps && !ui.skip; i++) {
        el.textContent = lo + Math.floor(Math.random() * (hi - lo + 1)); el.classList.add('spin'); Snd.tick();
        await wait(40 + (i / steps) * (i / steps) * 220 * T);
      }
      if (!ui.skip && mode === 'full' && hi > lo) { el.textContent = final === hi ? hi - 1 : final + 1; await wait(380); } // hesitate
      el.textContent = final; el.classList.remove('spin');
    }
    async function run(body) {
      const ctr = body.querySelector('#ctr'), rolls = body.querySelector('#rolls'), bowl = body.querySelector('#bowl'), msg = body.querySelector('#cmsg');
      const shadows = [...body.querySelectorAll('.shadow-egg')];
      const addRoll = t => { rolls.insertAdjacentHTML('beforeend', `<span>${t}</span>`); };
      await spin(ctr, 0, C.breed.gateMax, r.a, 1400 * T);
      addRoll('gate ' + r.a + ' / 0–' + C.breed.gateMax);
      bowl.classList.remove('flicker');
      if (r.a === 0) { bowl.classList.add('dim', 'smoke'); msg.innerHTML = '<p class="bad"><b>The nest goes dark. An empty clutch.</b></p>'; Snd.bad(); return done(); }
      Snd.tone(220, 0.4, 'sawtooth', 0.05);
      await wait(300 * T);
      await spin(ctr, 1, C.breed.xMax, r.x, 1600 * T);
      addRoll('x = ' + r.x + ' / 1–12');
      for (let i = 0; i < r.x; i++) shadows[i].classList.remove('off');
      await wait(400 * T);
      await spin(ctr, 1, r.x, r.y, 1500 * T);
      addRoll('y = ' + r.y + ' / 1–' + r.x);
      for (let i = r.x - 1; i >= r.y; i--) { shadows[i].classList.add('off'); await wait(140 * T); }
      await wait(300 * T);
      await spin(ctr, 1, r.y, r.z, 1700 * T);
      addRoll('z = ' + r.z + ' / 1–' + r.y);
      for (let i = r.y - 1; i >= r.z; i--) { shadows[i].classList.add('off'); await wait(160 * T); }
      for (let i = 0; i < r.z; i++) {
        if (i === r.z - 1 && r.z > 1) await wait(700 * T); // the last step lingers
        const egg = S.dragons[ev.eggs[i]];
        shadows[i].classList.add('real'); shadows[i].innerHTML = imgEgg(egg || { seed: i, shell: mix }, 3);
        Snd.egg(i); await wait(220 * T);
      }
      ctr.textContent = r.z + (r.z === 1 ? ' EGG' : ' EGGS');
      if (r.z >= C.breed.bigClutch) { document.body.insertAdjacentHTML('beforeend', '<div class="beam"></div>'); setTimeout(() => { const bm = document.querySelector('.beam'); if (bm) bm.remove(); }, 1700); Snd.epic(); flash(); msg.innerHTML = '<p class="fanfare">A GIANT CLUTCH!</p>'; }
      else Snd.fanfare();
      done();
    }
    function done() {
      const body = $('#modal-body');
      if (ui.skip) {
        const ctr = body.querySelector('#ctr'); if (ctr) ctr.textContent = r.a ? r.z + (r.z === 1 ? ' EGG' : ' EGGS') : '0';
        const rolls = body.querySelector('#rolls'); if (rolls) rolls.innerHTML = `<span>gate ${r.a}</span>${r.a ? `<span>x = ${r.x}</span><span>y = ${r.y}</span><span>z = ${r.z}</span>` : ''}`;
        body.querySelectorAll('.shadow-egg').forEach((s, i) => { if (i < r.z) { s.className = 'shadow-egg real'; s.innerHTML = imgEgg(S.dragons[ev.eggs[i]] || { seed: i, shell: mix }, 3); } else s.classList.add('off'); });
      }
      m.busy = false;
      const sk = body.querySelector('[data-act="skip"]');
      if (sk) sk.outerHTML = `<div class="row" style="justify-content:center"><button class="btn" type="button" data-act="closeModal">${r.z ? 'Into the egg chamber' : 'Too bad'}</button>${r.z ? '<button class="btn ghost" type="button" data-act="goChamber">Open egg chamber</button>' : ''}</div>`;
    }
    showModal(m);
  }

  function graduateModal(ev) {
    const d = S.dragons[ev.id]; if (!d) return;
    const fac = ev.faction;
    showModal({
      html: `<h2>Grown up: ${d.name}</h2><div class="reveal"><div class="hero ${d.mat ? 'mat' : ''}">${imgDragon(d, 6)}</div>
        <h3>Imprinting – ${zoneTitle(S.zones[ev.zone])}</h3>
        <div style="width:100%;display:grid;gap:4px"><small>before</small>${vecBar(ev.before)}<small>after</small>${vecBar(ev.after)}</div>
        ${ev.deep ? '<p class="epic"><b>It carries the zone\'s arch-enemy and turns deep: darker tint, no imprint, no zone bonus.</b></p>' : ev.shifted ? '<p>The zone shifts it one step towards its element.</p>' : '<p><small>No shift possible.</small></p>'}
        ${ev.becamePure ? '<p class="fanfare">20/20 – imprinted purebred!</p>' : ''}
        <h3>It chooses its faction</h3><p>${ev.probs.map(p => `${elTag(p.el)} ${pct(p.p)}`).join(' · ')}</p>
        <p class="big">→ ${elTag(fac)}</p>
        ${ev.firstAccess ? `<p class="fanfare">Access to ${elName(fac)}!</p><p><b>Reputation: Friendly</b> · ${C.rep.unlocks.friendly}</p>` : ''}
        <p><small>It leaves school, now flies in the sky and belongs to its faction. Its scales fall in the ${zoneTitle(S.zones[ev.zone])}.</small></p></div>`,
    });
    if (ev.becamePure || ev.firstAccess) Snd.fanfare(); else Snd.hatch();
  }
  function warResultModal(w) {
    Snd.drum();
    showModal({
      html: `<h2>The war is over</h2><div class="reveal"><p>${elTag(w.attacker)} <b>${w.pa.toFixed(1)}</b> power vs ${elTag(w.defender)} <b>${w.pd.toFixed(1)}</b> power <small>(allies count half)</small></p>
        <p>Attacker's chance: <b>${pct(w.chance)}</b> · roll: <b>${w.roll.toFixed(3)}</b> ${w.attackerWins ? '&lt;' : '≥'} ${w.chance.toFixed(3)}</p>
        <div class="burst"><span class="fanfare">${elName(w.winner).toUpperCase()} WINS!</span></div>${w.newRuler ? `<p class="big">${elName(w.winner)} now rules the sky.</p>` : ''}
        <p><small>The losers' king falls. About ${pct(C.war.loserDie)} fall, ${pct(C.war.loserDefect)} defect or flee, the rest stay. Everyone involved is war-marked.</small></p>
        ${w.fates.length ? '<h3>Dragons you raised</h3>' + w.fates.map(x => `<div class="row">${im(SP.dragon({ id: 'f' + x.id, v: x.v, mat: x.mat, seed: x.seed, deep: false }, 2), '')} ${x.name}: ${fateText(x.fate)}</div>`).join('') : ''}</div>`,
    });
  }

  // ------------------------------------------------------------ events from the game logic
  function handleEvents() {
    for (const e of G.drain()) {
      switch (e.type) {
        case 'clutch': clutchModal(e); break;
        case 'graduate': graduateModal(e); break;
        case 'eggReady': toast('An egg in the ' + zoneTitle(S.zones[e.zone]) + ' is ready to hatch!', 'good'); Snd.tone(880, 0.1, 'triangle', 0.06); break;
        case 'mature': { const d = S.dragons[e.id]; if (d) toast(d.name + ' is now mature (300 yrs).'); break; }
        case 'repLevel':
          if (e.up) { Snd.fanfare(); const unl = C.rep.unlocks[G.REPL[e.to].id]; showModal({ html: `<div class="reveal"><div class="burst"><span class="fanfare">${G.REPL[e.to].name.toUpperCase()}!</span></div><p>${elTag(e.f)} now regards you as <b>${G.REPL[e.to].name}</b>.</p>${unl ? '<p class="good"><b>Unlocked: ' + unl + '</b></p>' : ''}<button class="btn" type="button" data-act="closeModal">Continue</button></div>` }); }
          else toast(elTag(e.f) + ': reputation drops to ' + G.REPL[e.to].name, 'bad');
          break;
        case 'warAnnounce': toast(elName(e.attacker) + ' challenges ' + elName(e.defender) + '! The sky darkens.', 'war'); Snd.drum(); break;
        case 'warFight': toast('The war begins!', 'war'); break;
        case 'warResult': warResultModal(e); break;
        case 'coronation': { const k = S.dragons[e.king]; const l = G.lawOf(e.f) || C.lawPlaceholder; toast(`♛ Coronation: ${k ? k.name : '?'} (${elName(e.f)}) – ${l.name}: ${l.text}`, 'epic'); Snd.epic(); break; }
        case 'portal': { const z = S.zones[e.zone]; Snd.epic(); flash(); showModal({ html: `<div class="reveal"><div class="hero">${im(SP.portal(z.els.map(x => EL[x].color), 0, false, 5), '')}</div><div class="fanfare">A PORTAL OPENS!</div><p>The <b>${zoneTitle(z)}</b> can now be reached (${e.how}).</p><button class="btn" type="button" data-act="zone" data-id="${z.id}">Step through</button></div>` }); break; }
        case 'speech': toast(e.text, 'war'); break;
        case 'toast': toast(e.text); break;
        default: break;
      }
    }
  }

  // ------------------------------------------------------------ actions
  function result(r, okText) { if (!r) return; if (!r.ok) { if (r.msg) { toast(r.msg, 'bad'); Snd.bad(); } } else if (okText) toast(okText, 'good'); render(true); }
  const ACT = {
    nav: d => { closeAllModals(); ui.screen = d.id; render(true); window.scrollTo(0, 0); },
    zone: d => { closeAllModals(); ui.screen = 'zone'; ui.zone = d.id; render(true); window.scrollTo(0, 0); },
    tab: d => { ui.tabs[d.group] = d.id; render(true); },
    closeModal: () => closeModal(),
    skip: () => { ui.skip = true; },
    goChamber: () => { closeModal(); ui.screen = 'school'; ui.tabs.school = 'chamber'; render(true); },
    dragon: d => dragonModal(+d.id),
    eggInfo: d => eggModal(+d.id),
    examine: d => { const r = G.examine(+d.id); if (!r.ok) return result(r); Snd.coin(); if (ui.modal && ui.modal.rebuild) refreshModal(); else eggModal(+d.id); render(true); },
    riddle: d => eggModal(+d.id),
    label: d => { G.setLabel(+d.id, +d.el); Snd.tick(); refreshModal(); render(true); },
    pickZone: d => pickZoneModal(+d.id),
    pickEgg: d => pickEggModal(d.id),
    incubate: d => { const r = G.incubate(+d.id, d.zone); if (r.ok) { closeModal(); Snd.tone(392, 0.2, 'triangle', 0.07); toast('The egg now rests in the ' + zoneTitle(S.zones[d.zone]) + '.', 'good'); } result(r); },
    hatch: d => { const r = G.hatch(+d.id); if (!r.ok) return result(r); hatchReveal(r); render(true); },
    sellEgg: d => { const r = G.sellEgg(+d.id); if (r.ok) { Snd.coin(); toast('Egg sold: +' + r.price + ' G', 'good'); } result(r); },
    buySlot: d => { const r = G.buySlot(d.id); if (r.ok) Snd.coin(); result(r, r.ok ? 'New brood slot!' : null); },
    buyPortal: d => result(G.buyPortal(d.id)),
    backdoor: d => { if (!confirm('Build a backdoor device for ' + fmt(C.portals.backdoorPrice) + ' gold? It costs ' + C.portals.backdoorUpkeepPerMinute + ' gold per minute, and your reputation keeps falling while it runs.')) return; result(G.buyBackdoor(d.id), 'The device hums. The portal stays open.'); },
    toggleBackdoor: d => { G.toggleBackdoor(d.id); render(true); },
    buyEgg: d => {
      const n = +d.n || 1; let r;
      for (let i = 0; i < n; i++) { r = G.buyEgg(d.cls, d.offer != null ? +d.offer : null); if (!r.ok) break; }
      if (r && r.ok) { Snd.coin(); toast((n > 1 ? n + ' eggs' : 'Egg') + ' bought – waiting in the egg chamber.', 'good'); }
      result(r);
    },
    wonder: () => { const r = G.claimWonder(); if (r.ok) { Snd.epic(); toast('Wonder egg: a ' + G.CLS[r.egg.cls].name + ' egg!', 'epic'); } result(r); },
    sellStack: d => { const r = G.sellScales(d.kind, d.key, d.n ? +d.n : null); if (r.ok) { Snd.coin(); toast(r.count + ' scales: +' + fmt(r.total) + ' G', 'good'); } result(r); },
    sellAll: () => { const r = G.sellAllScales(); if (r.ok) { Snd.coin(); toast(r.count + ' scales sold: +' + fmt(r.total) + ' G', 'good'); } result(r); },
    pair: d => { const i = +d.id; const sel = ui.nestSel[i] || {}; if (!sel.a || !sel.b) return toast('Choose two dragons.', 'bad'); const r = G.setPair(i, +sel.a, +sel.b); if (r.ok) { delete ui.nestSel[i]; Snd.fanfare(); } result(r, r.ok ? 'The pair moves into the nest.' : null); },
    unpair: d => { G.clearPair(+d.id); render(true); },
    activity: d => { const r = G.doActivity(+d.f, +d.i); if (r.ok) { Snd.coin(); toast(C.speech.thanks.replace('{f}', elName(+d.f)) + ' ' + r.msg, 'good'); } result(r); },
    help: () => helpModal(),
    reset: () => { if (confirm('Really delete your save and start over?')) { localStorage.removeItem(C.saveKey); location.reload(); } },
  };
  function closeAllModals() { ui.queue = ui.queue.filter(m => m.keep); if (ui.modal && !ui.modal.busy) nextModal(); }

  document.addEventListener('click', e => {
    Snd.init();
    const el = e.target.closest('[data-act]'); if (!el) { if (e.target.id === 'modal') closeModal(); return; }
    e.preventDefault();
    const fn = ACT[el.dataset.act]; if (fn) fn(el.dataset, el, e);
  });
  // scales: pointerdown, so no click is lost to a re-render
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-pdown="collect"]'); if (!el) return;
    Snd.init(); e.preventDefault();
    const r = G.collect(el.dataset.zone, +el.dataset.id);
    const ground = $('#ground');
    if (!r.ok) { if (r.msg) toast(r.msg, 'bad'); Snd.bad(); return; }
    const t = performance.now();
    ui.combo.n = t - ui.combo.t < C.scales.comboWindowMs ? ui.combo.n + 1 : 1; ui.combo.t = t;
    Snd.collect(ui.combo.n);
    if (ground) {
      const gr = ground.getBoundingClientRect();
      const p = document.createElement('div'); p.className = 'pop';
      p.style.left = (e.clientX - gr.left) + 'px'; p.style.top = (e.clientY - gr.top) + 'px';
      p.textContent = '+' + G.scaleSalePrice(r.scale) + ' G' + (r.scale.mat ? ' ✦' : '');
      ground.appendChild(p); setTimeout(() => p.remove(), 900);
      let cb = ground.querySelector('.combo');
      if (ui.combo.n >= 3) { if (!cb) { cb = document.createElement('div'); cb.className = 'combo'; ground.appendChild(cb); } cb.textContent = 'COMBO ×' + ui.combo.n + '!'; }
    }
    el.remove();
    ui.last = ''; // next render rebuilds the ground
  });
  document.addEventListener('change', e => {
    const s = e.target.closest('select[data-nest]'); if (!s) return;
    const i = +s.dataset.nest; ui.nestSel[i] = ui.nestSel[i] || {}; ui.nestSel[i][s.dataset.which] = s.value; s.blur(); render(true);
  });
  document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => ACT.nav({ id: b.dataset.nav })));
  $('#btn-sound').addEventListener('click', () => { S.settings.sound = !S.settings.sound; Snd.init(); updateTop(); });
  $('#btn-anim').addEventListener('click', () => { const o = ['auto', 'full', 'short']; S.settings.anim = o[(o.indexOf(S.settings.anim) + 1) % 3]; toast('Animations: ' + ({ auto: 'automatic', full: 'full', short: 'short' })[S.settings.anim]); updateTop(); });
  $('#btn-help').addEventListener('click', () => helpModal());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.modal) closeModal(); });

  function helpModal() {
    showModal({
      html: `<h2>How to play Dragonle</h2>
      <p><b>1 game year = 1 second.</b> Things only happen while you play. Offline, only adult dragons keep ageing.</p>
      <p><b>Eggs</b> come from the Market. Cheap eggs are random mixes and the only source of metal and gem dragons. Every bought egg can be a dud – then the shell is refunded.</p>
      <p><b>Examine:</b> at the School the magnifier shows three uncertain candidates and a vague riddle. Pick a label. A hit after hatching earns school reputation, which makes riddles clearer. The riddle language is consistent – learn it.</p>
      <p><b>Incubate</b> in a zone (${C.incubation.seconds} s). You trigger the last crack yourself. In the zone of its own element a dragon reaches its potential: scale value ×(1 + share).</p>
      <p><b>Dragon School:</b> a level every 10 years, mature at 300, adult at 1000 (≈ 17 min). Then the zone imprints it, it picks its own faction and takes to the sky.</p>
      <p><b>Nest:</b> pairs of 300+ years breed on average every 50 years. Four open rolls decide the clutch (gate 0–6, then x, y, z). Two purebred parents of the same element always breed purebred.</p>
      <p><b>Scales</b> fall from adult dragons onto the ground of their zone. You may collect them once you are Friendly with their faction (rarer qualities need more reputation).</p>
      <p><b>Factions</b> have relations, alliances, needs and wars. The eldest dragon of the ruling faction is king. Court them with activities – helping some angers others.</p>
      <p><small>Placeholders (still open): brood time, hatcheries other than lava pool and ember oven, worldviews other than Fire, faction voices, tutorial, music, alliance names, the boost from 1000 years.</small></p>
      <div class="row"><span class="spacer"></span><button class="btn small danger" type="button" data-act="reset">Delete save</button></div>`,
    }, true);
  }

  // ------------------------------------------------------------ sky
  const sky = $('#sky'); const sctx = sky.getContext('2d');
  const PX = 3;
  let stars = [];
  function resizeSky() {
    const w = Math.max(80, Math.floor(sky.clientWidth / PX)), h = Math.max(30, Math.floor(sky.clientHeight / PX));
    if (sky.width !== w || sky.height !== h) {
      sky.width = w; sky.height = h;
      let s = 1234; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      stars = Array.from({ length: Math.floor(w * h / 55) }, () => [Math.floor(r() * w), Math.floor(r() * h * 0.7), r()]);
    }
  }
  window.addEventListener('resize', resizeSky);
  function drawSky(t) {
    resizeSky();
    const w = sky.width, h = sky.height, c = sctx;
    const war = S.war; const tension = war ? (war.phase === 'announce' ? war.t / C.war.announceSeconds : 1) : 0;
    const bands = ['#120c34', '#1d1450', '#2a1c66', '#3b2577', '#552f86', '#7a3f8e', '#a3528f'];
    const warBands = ['#1a0610', '#2a0a14', '#3a0e18', '#561418', '#701c18', '#8a2a18', '#a63a18'];
    const bh = h / bands.length;
    for (let i = 0; i < bands.length; i++) { c.fillStyle = tension > 0 ? SP.mix(bands[i], warBands[i], tension) : bands[i]; c.fillRect(0, Math.floor(i * bh), w, Math.ceil(bh) + 1); }
    const time = t / 1000;
    stars.forEach(s => { if ((Math.sin(time * 2 + s[2] * 40) + 1) / 2 > 0.3 + tension * 0.5) { c.fillStyle = s[2] > 0.92 ? '#ffffff' : s[2] > 0.8 ? '#ffd23f' : '#b9a8f0'; c.fillRect(s[0], s[1], 1, 1); if (s[2] > 0.97) { c.fillRect(s[0] - 1, s[1], 3, 1); c.fillRect(s[0], s[1] - 1, 1, 3); } } });
    // moon with ink outline
    const mx = w - 30, my = 6;
    c.fillStyle = SP.INK; c.fillRect(mx + 1, my - 1, 10, 14); c.fillRect(mx - 1, my + 1, 14, 10); c.fillRect(mx, my, 12, 12);
    c.fillStyle = tension > 0.5 ? '#ff9a7a' : '#fff3c4'; c.fillRect(mx + 2, my, 8, 12); c.fillRect(mx, my + 2, 12, 8); c.fillRect(mx + 1, my + 1, 10, 10);
    c.fillStyle = tension > 0.5 ? '#e07a5a' : '#e8d9a0'; c.fillRect(mx + 3, my + 3, 2, 2); c.fillRect(mx + 7, my + 6, 2, 2); c.fillRect(mx + 4, my + 8, 1, 1);
    // dragons in their faction colours
    const adults = [];
    for (let f = 0; f < NE; f++) G.adultsOf(f).forEach(d => adults.push(d));
    adults.sort((a, b) => a.id - b.id);
    adults.slice(-70).forEach((d, i) => {
      const sd = d.seed;
      const speed = 4 + (sd % 100) / 12;
      const dir = sd % 2 ? 1 : -1;
      const span = w + 60;
      let x = ((time * speed + (sd % 997)) % span); if (dir < 0) x = span - x; x -= 30;
      const y = 1 + ((sd >>> 3) % Math.max(1, h - 24)) + Math.sin(time * 1.3 + sd) * 2;
      const frame = Math.floor(time * 3 + sd) % 2;
      let col = EL[d.faction].color;
      if (war && war.phase === 'fight' && (d.faction === war.attacker || d.faction === war.defender) && Math.floor(time * 6 + i) % 7 === 0) col = '#ffffff';
      c.drawImage(SP.skyDragon(col, frame, dir < 0, d.role === 'king', d.mat), Math.round(x), Math.round(y));
    });
    // hills
    c.fillStyle = tension > 0 ? '#16060c' : '#120a26';
    for (let x = 0; x < w; x++) { const hh = 6 + Math.round(Math.abs(Math.sin(x * 0.07) * 6 + Math.sin(x * 0.023 + 1) * 5)); c.fillRect(x, h - hh, 1, hh); }
    c.fillStyle = '#000';
    for (let x = 0; x < w; x++) { const hh = 6 + Math.round(Math.abs(Math.sin(x * 0.07) * 6 + Math.sin(x * 0.023 + 1) * 5)); c.fillRect(x, h - hh - 1, 1, 1); }
    const info = $('#sky-info');
    const txt = `${adults.length} dragons in the sky${S.king && S.dragons[S.king] ? ' · ♛ ' + S.dragons[S.king].name + ' (' + elName(S.ruler) + ')' : ''}`;
    if (info.textContent !== txt) info.textContent = txt;
    const tn = $('#tension');
    if (war) { tn.hidden = false; tn.querySelector('.tension-label').textContent = (war.phase === 'announce' ? 'WAR THREAT: ' : 'WAR: ') + elName(war.attacker).toUpperCase() + ' vs ' + elName(war.defender).toUpperCase(); tn.querySelector('i').style.width = (war.phase === 'announce' ? tension * 100 : 100 - war.t / (war.fight || C.war.fightSeconds) * 100) + '%'; }
    else tn.hidden = true;
    document.querySelector('.sky-wrap').classList.toggle('war', !!(war && war.phase === 'fight'));
  }

  // ------------------------------------------------------------ main loop
  let last = performance.now(), renderT = 0, saveT = 0;
  function frame(t) {
    const real = Math.min(1, (t - last) / 1000); last = t;
    if (!document.hidden) {
      let dt = real * SPEED;
      if (SPEED > 1) S.worldOffset += real * (SPEED - 1);
      const step = Math.max(C.time.maxTickSeconds, dt / 40);
      while (dt > 1e-6) { const s = Math.min(step, dt); G.tick(s); dt -= s; }
      handleEvents();
    }
    renderT += real; if (renderT >= 0.25) { renderT = 0; render(); updateTop(); if (ui.modal) applyLive($('#modal-body')); }
    drawSky(t);
    saveT += real; if (saveT >= C.time.autosaveSeconds) { saveT = 0; save(); }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); last = performance.now(); });
  window.addEventListener('beforeunload', save);

  document.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon, +el.dataset.scale || 2); });
  $('#btn-help').innerHTML = icon('help', 2);
  boot();
  render(true); updateTop();
  if (ui.first) showModal({ html: `<h2>Welcome to Dragonle!</h2><div class="reveal"><div class="hero">${im(SP.egg({ shell: '#F2CF5B', spots: '#B8902A', seed: 5, crack: 1 }, 8), '')}</div></div><p>A dragon world of twelve elements. It's all about <b>eggs and young dragons</b> – the grown-ups only show up as shapes in the sky, wearing their faction's colours.</p><p>Buy an egg at the <b>Market</b>, hatch it in a <b>zone</b> and raise the dragon at the <b>School</b>.</p><div class="row" style="justify-content:center"><button class="btn" type="button" data-act="nav" data-id="market">${icon('market')} To the Market</button><button class="btn ghost" type="button" data-act="help">How to play</button></div>` });
  requestAnimationFrame(frame);
  window.DragonleUI = { ui, render };
})();
