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

  const ui = { screen: 'world', zone: null, tabs: { school: 'chamber', factions: 'court', bag: 'scales', log: 'breed' }, dfilter: { who: 'all', f: '', sort: 'old', limit: 120 }, last: '', queue: [], modal: null, combo: { n: 0, t: 0 }, nestSel: {}, envoy: { type: 'alliance', a: '', b: '' }, skip: false };
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
  function fmtTime(s) { return 'Y ' + fmt(C.time.startYear + Math.floor(s)); } // the dragon calendar: 1 second = 1 year
  const elName = e => EL[e].name;
  const sw = (e, title) => `<span class="sw" style="background:${EL[e].color}" title="${title || EL[e].name}"></span>`;
  const swc = (c, title) => `<span class="sw" style="background:${c}" title="${title || ''}"></span>`;
  const elTag = e => `${sw(e)} ${elName(e)}`;
  const matName = k => C.material.tiers[k - 1].name;
  const isNum = x => typeof x === 'number';
  const zoneTitle = z => G.zoneName(z) + ' Zone';
  const sideOf = (w, k) => (w[k === 'a' ? 'sa' : 'sd'] || [w[k === 'a' ? 'attacker' : 'defender']]);
  const sideTxt = side => side.map(f => elName(f)).join(' + ');
  const sideTags = side => side.map(f => elTag(f)).join(' + ');
  const fallen = f => !!(S.factions[f] && S.factions[f].ended);

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
  function hero(inner, mat, id, hidden) {
    const cols = mat ? ['#FFFFFF', '#7FE7F2', '#E8609E', '#FFD23F'] : ['#FFF6B0', '#FFD23F', '#F08A2A'];
    return `<div class="hero ${mat ? 'mat' : ''}">${im(SP.burst(cols, 0, 4), '', 'bst')}${im(SP.burst(cols, 1, 4), '', 'bst f1')}<span class="fg" ${id ? `id="${id}"` : ''} ${hidden ? 'style="visibility:hidden"' : ''}>${inner}</span></div>`;
  }
  function burstBox(text, cols) {
    cols = cols || ['#FF8A5C', '#E04434', '#9E2418'];
    return `<div class="burstbox">${im(SP.burst(cols, 0, 4, 40), '')}${im(SP.burst(cols, 1, 4, 40), '', 'f1')}<span class="fanfare${text.length > 12 ? ' long' : ''}">${text}</span></div>`;
  }
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
    const el = document.createElement('div'); el.className = 'toast bubble ' + (kind || ''); el.innerHTML = text;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 4200);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }
  function flash() { if (!S.settings.flash) return; const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

  // ------------------------------------------------------------ the royal herald (speeches at the bottom)
  const herald = { q: [], busy: false, hurry: false };
  function sayCourt(sp, inOrder) {
    if (!sp || !sp.lines || !sp.lines.length) return;
    const dp = G.dip();
    dp.court.unshift({ t: Math.round(S.played), f: sp.f, kind: sp.kind, name: sp.name, role: sp.role, text: sp.lines.join(' ') });
    if (dp.court.length > 80) dp.court.length = 80;
    // royal words jump the queue, chatter waits
    if (sp.kind === 'minister' || inOrder) herald.q.push(sp); else herald.q.unshift(sp);
    if (herald.q.length > (inOrder ? 6 : 3)) herald.q.length = inOrder ? 6 : 3;
    if (!herald.busy) heraldNext();
  }
  const hwait = ms => new Promise(res => { const t0 = performance.now(); const id = setInterval(() => { if (herald.hurry || performance.now() - t0 >= ms) { clearInterval(id); res(); } }, 30); });
  function heraldLayout() {
    const h = $('#herald'); const min = !!S.settings.heraldMin;
    h.classList.toggle('min', min);
    document.body.classList.toggle('has-herald', !h.hidden);
    document.body.classList.toggle('herald-min', min);
    $('#herald-min').textContent = min ? '+' : '–';
  }
  async function heraldNext() {
    const sp = herald.q.shift(); const h = $('#herald');
    if (!sp) { herald.busy = false; h.classList.add('idle'); return; }
    herald.busy = true; h.hidden = false;
    h.className = 'herald ' + sp.kind;
    heraldLayout();
    h.style.setProperty('--c', EL[sp.f].color);
    const fsz = innerWidth < 700 ? 1 : 2; const crowned = sp.kind === 'king';
    const shut = sp.who ? SP.face(sp.who, false, fsz, crowned) : null, open = sp.who ? SP.face(sp.who, true, fsz, crowned) : null;
    const img = $('#herald-img');
    if (shut) { img.src = shut.src; img.width = shut.w; img.height = shut.h; }
    $('#herald-name').innerHTML = `${sp.name} <small>${sp.role}</small>`;
    const tx = $('#herald-text');
    if (sp.kind === 'king') Snd.seq([392, 523, 659, 784], 0.09, 'triangle', 0.045);
    else if (sp.kind === 'war') Snd.drum();
    for (const line of sp.lines) {
      herald.hurry = false; tx.textContent = '';
      for (let i = 1; i <= line.length; i++) {
        if (herald.hurry) { tx.textContent = line; break; }
        tx.textContent = line.slice(0, i);
        if (shut && i % 3 === 0) img.src = (Math.floor(i / 3) % 2 ? open : shut).src;
        if (sp.kind !== 'minister' && i % 4 === 0) Snd.tone(sp.kind === 'war' ? 160 : 220 + (i % 12) * 6, 0.02, 'square', 0.012);
        await new Promise(r => setTimeout(r, 26));
      }
      herald.hurry = false;
      if (shut) img.src = shut.src;
      await hwait(Math.min(4500, 1300 + line.length * 32));
    }
    herald.hurry = false;
    heraldNext();
  }
  function showModal(m, front) { if (front) ui.queue.unshift(m); else ui.queue.push(m); if (!ui.modal) nextModal(); }
  function nextModal() {
    const m = ui.queue.shift();
    const box = $('#modal');
    if (!m) { ui.modal = null; box.hidden = true; return; }
    ui.modal = m; ui.skip = false; box.hidden = false;
    box.querySelector('.modal-box').classList.toggle('wide', !!m.wide);
    const body = $('#modal-body');
    if (m.build) m.build(body); else body.innerHTML = m.html;
    applyLive(body);
  }
  function closeModal() { if (ui.modal && ui.modal.busy) { ui.skip = true; ui.modal.closeWhenDone = true; return; } const m = ui.modal; if (m && m.onClose) m.onClose(); nextModal(); render(true); }
  function settle(m) { m.busy = false; if (m.closeWhenDone && ui.modal === m) closeModal(); }
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
      case 'actrefresh': { const l = Math.max(0, Math.ceil(C.activities.refreshSeconds - (S.played - S.offersAt))); return Math.floor(l / 60) + ':' + String(l % 60).padStart(2, '0'); }
      case 'wonder': return G.wonderAvailable() ? 'ready!' : 'back tomorrow';
      case 'decree': { const d = G.dip().decree; return d && d.until > S.played ? Math.ceil(d.until - S.played) + ' s left' : ''; }
      case 'favour': { const u = G.dip().favourUntil; return u > S.played ? 'Royal favour: scales +' + Math.round(C.diplomacy.favourScaleBonus * 100) + ' % · ' + Math.ceil(u - S.played) + ' s' : 'No royal favour'; }
      case 'envoycd': { const l = Math.ceil(C.diplomacy.envoyCooldown - (S.played - G.dip().envoyAt)); return l > 0 ? 'envoys travelling · ' + l + ' s' : 'envoys ready'; }
      case 'warleft': { const W = S.war; if (!W) return ''; if (W.phase === 'argument') return 'argument before the throne · round ' + Math.min(C.war.argument.rounds, W.arg.round + 1) + ' · ' + W.arg.score[0] + '–' + W.arg.score[1] + ' (King–' + elName(W.attacker) + ')'; return W.phase === 'announce' ? 'war breaks out in ' + Math.ceil(C.war.announceSeconds - W.t) + ' s' : 'battle rages · ' + Math.ceil((W.fight || C.war.fightSeconds) - W.t) + ' s'; }
      case 'nextspeech': return Math.max(0, Math.ceil(C.diplomacy.speechEvery - G.dip().speechT)) + ' yrs';
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
      <div class="meta"><div class="nm">${d.name} ${tags(d)}</div><small>${SP.variantName(d)}</small>${vecBar(d.v)}
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
    const every = Math.round(1 / (C.breed.chancePerYear * ((G.law() && G.law().breedMult) || 1)));
    const minY = C.breed.minYears;
    const who = d => (d.status === 'adult' ? elName(d.faction) : 'pupil') + ' · ' + SP.variantName(d);
    const nests = S.nests.map((n, i) => {
      if (n) {
        const a = S.dragons[n.a], b = S.dragons[n.b];
        const glow = G.mixColor(a.v.map((x, k) => (x + b.v[k]) / 2));
        return `<div class="panel nest-card" data-live-cls="${i}">
          <div class="nhead"><b>Nest ${i + 1}</b><span class="nstate" data-live="nest:${i}"></span></div>
          <div class="nscene">${im(SP.nest(glow, false, 3), '', 'nbowl')}
            <span class="nd l" data-act="dragon" data-id="${a.id}" title="${a.name}">${imgDragon(a, 3)}</span>
            <span class="nheart">${icon('heart', 3)}</span>
            <span class="nd r" data-act="dragon" data-id="${b.id}" title="${b.name}">${imgDragon(b, 3, true)}</span>
          </div>
          <div class="nnames"><span><b>${a.name}</b><small>${who(a)}</small></span><span class="r"><b>${b.name}</b><small>${who(b)}</small></span></div>
          ${previewHtml(G.inheritPreview(a, b))}
          <div class="nfoot"><small>At least ${minY} years per clutch, then about ${every} more on average.</small><button class="btn small danger" type="button" data-act="unpair" data-id="${i}">Separate</button></div>
        </div>`;
      }
      const used = new Set(); S.nests.forEach(x => { if (x) { used.add(x.a); used.add(x.b); } });
      const sel = ui.nestSel[i] || {};
      const free = cands.filter(d => !used.has(d.id));
      const opts = which => `<option value="">– choose ${which === 'a' ? 'the first' : 'the second'} dragon –</option>` + free.map(d => `<option value="${d.id}" ${+sel[which] === d.id ? 'selected' : ''}>${d.name} · ${d.status === 'adult' ? elName(d.faction) + ' (adult)' : 'pupil'} · ${G.vecText(d.v)}</option>`).join('');
      const da = sel.a && S.dragons[sel.a], db = sel.b && S.dragons[sel.b];
      let pv = '';
      if (da && db) {
        const v = G.pairValid(+sel.a, +sel.b);
        pv = v.ok ? previewHtml(G.inheritPreview(da, db)) : `<div class="nwarn">${v.msg}</div>`;
      }
      const shadowDragon = { id: 'shadow', name: 'empty perch', v: [0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0], mat: 0, seed: 16, deep: true };
      const perch = (d, side) => d ? `<span class="nd ${side}">${imgDragon(d, 3, side === 'r')}</span>` : `<span class="nd ${side} ghost">${imgDragon(shadowDragon, 3, side === 'r')}</span>`;
      return `<div class="panel nest-card empty">
        <div class="nhead"><b>Nest ${i + 1}</b><span class="nstate idle">empty</span></div>
        <div class="nscene">${im(SP.nest('#888888', !(da && db), 3), '', 'nbowl')}${perch(da, 'l')}<span class="nheart dim">${icon('heart', 3)}</span>${perch(db, 'r')}</div>
        ${free.length < 2 ? '<p class="center"><small>Not enough free dragons that can breed.</small></p>' : `<select data-nest="${i}" data-which="a" aria-label="First dragon">${opts('a')}</select><select data-nest="${i}" data-which="b" aria-label="Second dragon">${opts('b')}</select>`}
        ${pv}
        <div class="nfoot"><button class="btn small wide" type="button" data-act="pair" data-id="${i}" ${da && db ? '' : 'disabled'}>${icon('heart')} Pair them</button></div>
      </div>`;
    }).join('');
    return `<div class="screen-head"><h2>Nesting Ground</h2><span class="sub">Pairs from 300 years: pupils, or adults of factions where you are Friendly. Arch-enemies never mate.</span></div>
      ${cands.length ? '' : '<div class="panel empty" style="margin-bottom:14px">No dragons can breed yet. Pupils mature at 300 years (5 minutes).</div>'}
      <div class="nests">${nests}</div>`;
  };
  function previewHtml(pv) {
    if (pv.pure) return `<div class="preview"><b>${icon('star')} Guaranteed purebred: ${elTag(pv.el)}</b></div>`;
    return `<div class="preview"><small>${icon('lupe')} Possible results</small>${pv.ranges.map(r => `<div class="rng"><span class="rl">${sw(r.el)} ${elName(r.el)}</span><span class="rngbar"><i style="left:${r.min * 5}%;width:${Math.max(3, (r.max - r.min) * 5)}%;background:${EL[r.el].color}"></i></span><span class="rv">${r.min * 5}–${r.max * 5}%</span></div>`).join('')}<small>+ ${pct(pv.mutation)} mutation chance</small></div>`;
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
    const tabs = tabBar('factions', [['court', 'Court & diplomacy'], ['board', 'Activity board'], ['overview', 'Overview'], ['matrix', 'Relations'], ['net', 'Network'], ['wars', 'Wars']]);
    const king = S.king && S.dragons[S.king];
    const l = G.law();
    const al = G.alliances();
    const war = S.war ? `<div class="bad">${icon('sword')} <b>${S.war.phase === 'argument' ? 'Challenge to the throne' : S.war.phase === 'announce' ? 'War threat' : 'War'}: ${sideTxt(sideOf(S.war, 'a'))} vs ${sideTxt(sideOf(S.war, 'd'))}</b></div>` : `<div>${icon('peace')} Peace in the sky.</div>`;
    const head = `<div class="panel grid cols-2">
      <div class="kingbox">${king ? `<div class="pic" data-act="dragon" data-id="${king.id}">${imgDragon(king, 3)}</div>` : ''}<div>${icon('crown')} <b>${king ? king.name : '–'}</b><br><small>Dragon King · ${elTag(S.ruler)}${king ? ' · <span data-live="age:' + king.id + '"></span>' : ''}</small></div></div>
      <div>${icon('scroll')} <b>${l ? l.name : C.lawPlaceholder.name}</b><br><small>${l ? l.text : C.lawPlaceholder.text}</small></div>
      <div><small>Government:</small> ${S.gov.map(id => S.dragons[id]).filter(Boolean).map(d => `<a href="#" data-act="dragon" data-id="${d.id}">${d.name}</a>`).join(', ') || '–'}</div>
      <div>${war}</div>
      <div><small>Alliances:</small> ${al.length ? al.map(a => `<span class="tag" style="background:${a.color}">${a.name}</span>`).join(' ') : '<small>none</small>'}</div>
    </div>`;
    let body = '';
    if (tab === 'court') body = courtHtml();
    else if (tab === 'board') body = boardHtml();
    else if (tab === 'overview') body = `<div class="grid cols-2">${EL.map((e, f) => factionCard(f)).join('')}</div>`;
    else if (tab === 'matrix') body = matrixHtml();
    else if (tab === 'net') body = netHtml();
    else body = S.logs.wars.length ? `<div class="log">${S.logs.wars.map(w => `<div class="li war"><span class="t">${fmtTime(w.t)}</span><span>${sideTags(sideOf(w, 'a'))} (power ${w.pa.toFixed(1)}) vs ${sideTags(sideOf(w, 'd'))} (power ${w.pd.toFixed(1)}) · chance ${pct(w.chance)} · roll ${w.roll.toFixed(3)} → <b>${sideTxt(w.wside || [w.winner])} win</b>${w.newRuler ? ' · new ruler' : ''}${(w.collapsed || []).length ? ' · <b class="bad">' + sideTxt(w.collapsed) + ' fell</b>' : ''}${w.fates.length ? '<br>' + w.fates.map(x => x.name + ': ' + fateText(x.fate)).join(' · ') : ''}</span></div>`).join('')}</div>` : '<div class="empty panel">No war yet.</div>';
    return `<div class="screen-head"><h2>The Factions</h2><span class="sub">Twelve elements fight over the sky.</span></div>${head}<div style="height:16px"></div>${tabs}${body}`;
  };
  const livingF = () => EL.map((e, f) => f).filter(f => !S.factions[f].ended && G.adultsOf(f).length);
  const ENVOY = {
    alliance: { name: 'Forge an alliance', two: true, desc: 'Persuade two factions to stand together. Success: +' + C.diplomacy.envoy.alliance.success + ' relation both ways – maybe a new named alliance. Failure annoys both.' },
    pact: { name: 'Pact of peace', two: true, desc: 'Neither may declare war on the other for ' + Math.round(C.diplomacy.envoy.pact.seconds / 60) + ' minutes.' },
    wedding: { name: 'Royal wedding', two: true, desc: 'Wed the eldest of two houses. Always succeeds: +' + C.diplomacy.envoy.wedding.rel + ' relation, reputation with both.' },
    tribute: { name: 'Send tribute', two: false, desc: 'A chest of gold for one faction: +' + C.diplomacy.envoy.tribute.rep + ' reputation, tribute need rises.' },
  };
  function courtHtml() {
    const k = S.king && S.dragons[S.king]; const v = Court.voice(S.ruler); const dc = G.decree(); const dp = G.dip(); const DC = C.diplomacy;
    const aChance = Math.max(0.05, Math.min(0.95, DC.audienceBase + DC.audiencePerLevel * (G.repLevel(S.ruler) - G.REPI.neutral)));
    const l = G.law() || C.lawPlaceholder;
    const throne = `<div class="panel throne">
      <div class="seat">${k ? imgDragon(k, 5) : ''}<span class="crown">${icon('crown', 4)}</span></div>
      <div><div class="epithet">${v.title.toUpperCase()}</div><h3>${k ? '♛ ' + k.name + ' ' + v.epithet : 'The throne stands empty'}</h3>
        <p>Dragon King of ${elTag(S.ruler)}${k ? ' · <span data-live="age:' + k.id + '"></span>' : ''} · next speech in <b data-live="nextspeech"></b></p>
        <p>${icon('scroll')} <b>${l.name}</b> – ${l.text}</p>
        ${dc ? `<div class="decree">📜 <b>Royal decree: ${dc.name}</b> – ${dc.text} <small>(<span data-live="decree"></span>)</small></div>` : '<p><small>No decree is in force. Every ' + (DC.decreeEvery === 2 ? 'second' : DC.decreeEvery + 'th') + ' royal speech brings one.</small></p>'}
        <p><small data-live="favour"></small></p>
        <div class="row"><button class="btn" type="button" data-act="audience" ${k ? '' : 'disabled'}>${icon('crown')} Request an audience · ${DC.audienceCost} G</button><small>chance the king is pleased: <b>${pct(aChance)}</b> → +${DC.audienceRep} reputation and royal favour</small></div>
      </div></div>`;
    const ministers = S.gov.map(id => S.dragons[id]).filter(Boolean).map((d, i) => {
      const off = DRAGONLE_VOICES.MINISTERS[(Math.max(0, S.gov.indexOf(d.id)) + d.seed) % DRAGONLE_VOICES.MINISTERS.length];
      const said = dp.court.find(c => c.name === d.name);
      return `<div class="panel minister"><div class="pic" data-act="dragon" data-id="${d.id}">${imgDragon(d, 2)}</div><div><div class="office">${off.office.toUpperCase()}</div><b>${d.name}</b> <small>of ${elName(d.faction)}</small>${said ? `<q>${said.text}</q>` : '<q>…has not spoken yet.</q>'}</div></div>`;
    }).join('');
    let warroom = '';
    if (S.war) {
      const W = S.war; const sa = sideOf(W, 'a'), sd = sideOf(W, 'd');
      const pChance = G.envoyChance('peace');
      warroom = `<div class="section"><h3>${icon('sword')} War room</h3><small data-live="warleft"></small></div>
      <div class="panel warroom"><div class="sides"><div>${sideTags(sa)}<br><small>attackers</small></div><div class="vs">VS</div><div>${sideTags(sd)}<br><small>defenders</small></div></div>
        <div class="row" style="justify-content:center;margin-top:10px">
          ${W.phase === 'argument' ? `<button class="btn" type="button" data-act="watchArgument">${icon('crown')} Watch the argument</button>${W.arg.whisper ? '<b>You whispered for ' + (W.arg.whisper === 'king' ? 'the King' : elName(W.attacker)) + '.</b>' : `<button class="btn" type="button" data-act="whisper" data-side="king">Whisper for the King · ${C.war.argument.whisperCost} G</button><button class="btn ember" type="button" data-act="whisper" data-side="chal">Whisper for ${elName(W.attacker)} · ${C.war.argument.whisperCost} G</button>`}` : ''}
          ${W.pledge ? `<b>Your war chest backs the ${W.pledge === 'a' ? 'attackers' : 'defenders'} (+${pct(DC.pledgePower)} power).</b>` : `<button class="btn ember" type="button" data-act="pledge" data-side="a">Pledge to the attackers · ${DC.pledgeCost} G</button><button class="btn ember" type="button" data-act="pledge" data-side="d">Pledge to the defenders · ${DC.pledgeCost} G</button>`}
          ${W.phase === 'announce' ? `<button class="btn go" type="button" data-act="peace">${icon('peace')} Broker peace · ${DC.envoy.peace.cost} G · ${pct(pChance)}</button>` : ''}
        </div>
        <p class="center"><small>A pledged side fights ${pct(DC.pledgePower)} harder. If it wins: +${DC.pledgeRep} reputation with every winner and ${DC.pledgeSpoils}× your gold back. If it loses, the winners remember (${DC.pledgeLoss}).</small></p></div>`;
    }
    const fs = livingF(); const ev = ui.envoy;
    if (ev.a === '' || !fs.includes(+ev.a)) ev.a = String(fs.find(f => S.access[f]) != null ? fs.find(f => S.access[f]) : (fs[0] != null ? fs[0] : ''));
    if (ev.b === '' || !fs.includes(+ev.b) || +ev.b === +ev.a) ev.b = String(fs.find(f => f !== +ev.a && !G.isEnemy(f, +ev.a)) != null ? fs.find(f => f !== +ev.a && !G.isEnemy(f, +ev.a)) : '');
    const E = ENVOY[ev.type]; const cost = DC.envoy[ev.type].cost;
    const travelling = S.played - dp.envoyAt < DC.envoyCooldown;
    let err = ev.a === '' ? 'No faction can receive envoys.' : G.envoyCheck(ev.type, +ev.a, +ev.b);
    if (err && err.indexOf('travelling') >= 0) err = null; // the live label counts down instead
    const chance = ev.type === 'alliance' || ev.type === 'pact' ? G.envoyChance(ev.type, +ev.a, +ev.b) : 1;
    const fOpt = (sel, skipF) => fs.filter(f => f !== skipF).map(f => `<option value="${f}" ${+sel === f ? 'selected' : ''}>${elName(f)}${S.access[f] ? '' : ' (no access)'}</option>`).join('');
    const envoy = `<div class="panel envoy">
      <div class="pickrow">
        <select data-envoy="type" aria-label="Envoy mission">${Object.keys(ENVOY).map(t => `<option value="${t}" ${ev.type === t ? 'selected' : ''}>${ENVOY[t].name}</option>`).join('')}</select>
        <select data-envoy="a" aria-label="First faction">${fOpt(ev.a)}</select>
        ${E.two ? `<select data-envoy="b" aria-label="Second faction">${fOpt(ev.b, +ev.a)}</select>` : '<span></span>'}
      </div>
      <small>${E.desc}</small>
      ${E.two && ev.b !== '' ? `<small>Relations now: ${elName(+ev.a)} → ${elName(+ev.b)} <b>${Math.round(S.rel[+ev.a][+ev.b])}</b> · ${elName(+ev.b)} → ${elName(+ev.a)} <b>${Math.round(S.rel[+ev.b][+ev.a])}</b>${G.allied(+ev.a, +ev.b) ? ' · allied' : ''}${G.hasPact(+ev.a, +ev.b) ? ' · pact' : ''}</small>` : ''}
      <div class="row"><span class="odds">${err ? '' : (chance < 1 ? pct(chance) + ' chance' : 'certain')}</span><span class="spacer"></span><small data-live="envoycd"></small><button class="btn go" type="button" data-act="envoy" ${err || travelling ? 'disabled' : ''}>${icon('scroll')} Send envoy · ${cost} G</button></div>
      ${err ? `<small class="bad"><b>${err}</b></small>` : ''}
    </div>`;
    const pacts = dp.pacts.filter(x => x.until > S.played);
    const pactHtml = pacts.length ? pacts.map(x => `<span class="tag">${elTag(x.a)} ✦ ${elTag(x.b)} · ${Math.ceil((x.until - S.played) / 60)} min</span>`).join(' ') : '<small>No pacts in force.</small>';
    const record = dp.court.slice(0, 6).map(c => `<div class="cl" style="--c:${EL[c.f].color}"><b>${c.name}</b> <small>${c.role}</small><br>${c.text}</div>`).join('') || '<div class="empty">The court has not spoken yet.</div>';
    return `${throne}
      ${ministers ? `<div class="section"><h3>The government</h3><small>the King's ministers – often mixed dragons, for diplomacy</small></div><div class="grid cols-2">${ministers}</div>` : ''}
      ${warroom}
      <div class="section"><h3>${icon('scroll')} The envoy desk</h3><small>diplomacy is rolled openly – see the Log</small></div>${envoy}
      <div class="section"><h3>Pacts of peace</h3></div><div class="panel">${pactHtml}</div>
      <div class="section"><h3>Court record</h3><button class="btn small ghost" type="button" data-act="courtLog">Full record</button></div><div class="courtlog">${record}</div>`;
  }
  // ------------------------------------------------------------ the Chronicle of the Skies (story button)
  const yearOf = t => C.time.startYear + Math.floor(t);
  function reignHtml(e, asKing) {
    const now = e.to == null; const len = (now ? S.played : e.to) - e.from;
    const pic = SP.face(e, false, 2, asKing);
    const v = Court.voice(e.f);
    return `<div class="reign" style="--c:${EL[e.f].color}">
      <div class="portrait" ${S.dragons[e.id] ? `data-act="dragon" data-id="${e.id}"` : ''}>${im(pic, e.name)}<small>${elTag(e.f)}</small></div>
      <div><h4>${asKing ? '♛ ' : ''}${e.name}${asKing ? ' ' + v.epithet : ''}</h4>
        <div class="years ${now ? 'now' : ''}">Year ${fmt(yearOf(e.from))} – ${now ? 'today' : 'Year ' + fmt(yearOf(e.to))} · reigned ${fmt(len)} year${Math.round(len) === 1 ? '' : 's'}${now ? ' and counting' : ''}</div>
        <p>${Court.bio(e, asKing)}</p></div></div>`;
  }
  function storyModal() {
    ui.storyTab = ui.storyTab == null ? 'kings' : ui.storyTab;
    showModal({
      wide: true,
      rebuild() {
        const ch = G.chronicle(); const tab = ui.storyTab;
        const tabs = `<div class="chron-tabs"><button class="btn ${tab === 'kings' ? 'on' : ''}" type="button" data-act="storyTab" data-id="kings">${icon('crown')} Dragon Kings</button>${EL.map((e, f) => `<button class="btn ${String(tab) === String(f) ? 'on' : ''}" type="button" data-act="storyTab" data-id="${f}">${sw(f)} ${e.name}</button>`).join('')}</div>`;
        let body = '';
        if (tab === 'kings') {
          const K = ch.kings.slice().reverse();
          const longest = ch.kings.reduce((m, e) => { const l = (e.to == null ? S.played : e.to) - e.from; return l > m.l ? { l, e } : m; }, { l: 0, e: null });
          body = `<div class="chron-head" style="background:var(--dither-light),#3a2a10"><div>${icon('crown', 5)}</div><div><h3>The Dragon Kings</h3>
            <div class="stats"><span>Kings so far: <b>${ch.kings.length}</b></span><span>Ruling faction: <b>${elName(S.ruler)}</b></span>${longest.e ? `<span>Longest reign: <b>${longest.e.name}</b> (${fmt(longest.l)} years)</span>` : ''}</div>
            <small>The eldest dragon of the ruling faction is always king. Every king's story is written here.</small></div></div>
            ${K.map(e => reignHtml(e, true)).join('') || '<div class="empty panel">No king has been crowned yet.</div>'}`;
        } else {
          const f = +tab; const F = S.factions[f]; const v = Court.voice(f);
          const wv = C.factions.worldviews[EL[f].id] || C.factions.worldviewPlaceholder;
          const L = ch.lords[f].slice().reverse();
          const kings = ch.kings.filter(e => e.f === f).length;
          const status = F.ended ? '<b class="bad">has fallen</b>' : f === S.ruler ? '<b>rules the sky</b>' : 'flies free';
          body = `<div class="chron-head" style="background:var(--dither-light),${EL[f].color}${f === 3 ? '' : ''}"><div>${L[0] && S.dragons[L[0].id] ? im(SP.face(L[0], false, 3, f === S.ruler), '') : icon('factions', 5)}</div>
            <div><h3>${EL[f].name} · ${v.title}</h3>
            <div class="stats"><span>Status: ${status}</span><span>Dragons: <b>${G.adultsOf(f).length}</b></span><span>Wars won/lost: <b>${F.wins || 0}/${F.losses || 0}</b></span><span>Falls: <b>${F.falls || 0}</b> · rebirths: <b>${F.reforms || 0}</b></span><span>Dragon Kings: <b>${kings}</b></span><span>Allies: <b>${G.allies(f).map(a => elName(a)).join(', ') || 'none'}</b></span></div>
            <small>${wv.text} · Arch-enemy: ${elName(G.enemyOf(f))}</small></div></div>
            <h3 style="color:#fff;text-shadow:2px 2px 0 #000;margin:8px 0">The lords of ${EL[f].name}</h3>
            ${L.map(e => reignHtml(e, false)).join('') || '<div class="empty panel">No lord has led this faction yet.</div>'}`;
        }
        return `<h2>${icon('scroll', 3)} The Chronicle of the Skies</h2>${tabs}${body}`;
      },
      build(b) { b.innerHTML = this.rebuild(); },
    }, true);
  }
  function courtLogModal() {
    const dp = G.dip();
    showModal({ wide: true, html: `<h2>${icon('scroll', 3)} The Court Record</h2><div class="courtlog">${dp.court.map(c => `<div class="cl" style="--c:${EL[c.f].color}"><b>${c.name}</b> <small>${c.role} · ${fmtTime(c.t)}</small><br>${c.text}</div>`).join('') || '<div class="empty">The court has not spoken yet.</div>'}</div>` }, true);
  }
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
      <div class="fac-head" style="background:${EL[f].color}${dark ? ';background-image:var(--dots-light);background-size:7px 7px' : ''}">${f === S.ruler ? icon('crown') : ''}<h3>${elName(f)}</h3>${fallen(f) ? '<span class="tag war">fallen</span>' : ''}<span class="tag">${S.access[f] ? lvl.name : 'no access'}</span></div>${fallen(f) ? `<p class="bad"><small><b>This faction has fallen.</b> Its exiles (${G.list(d => d.status === 'exile' && d.exileOf === f).length}) may gather to re-form it after ${Math.round(C.factions.reformSeconds / 60)} min, or a grown dragon may choose it and raise its banner again.</small></p>` : ''}
      <div class="repbar"><div class="bar gold"><i data-livew="repbar:${f}"></i></div><small><span data-live="rep:${f}"></span></small></div>
      <div class="row" style="font-size:14px"><span>Dragons <b>${N}</b>/${C.factions.capacity}</span><span>Power <b data-live="power:${f}"></b></span><span>War risk <b data-live="risk:${f}"></b></span><span>Nest ${F.nest.length} · young ${young}</span><span>Arch-enemy ${sw(G.enemyOf(f))}</span></div>
      <div class="needs ${risk > 0.35 ? 'alarm' : ''}">${needs.map(n => `<div>${n[1]}<div class="bar ${n[0] === 'raum' ? '' : 'gold'}"><i data-livew="need:${f}:${n[0]}"></i></div></div>`).join('')}</div>
      <small class="${wv.placeholder ? 'mute' : ''}">Worldview: ${wv.text} (compromise ${pct(wv.k)})</small>
      <div class="acts">${acts}</div>
    </div>`;
  }
  // the activity board: every faction's current offers in one place
  const GROUPS = [
    ['neutral', 'Neutral', 'Only the faction itself reacts.'],
    ['war', 'War', 'Strong for one faction – everyone else is annoyed.'],
    ['counter', 'Counter', 'Hurts the target – its enemies are pleased.'],
    ['group', 'Group', 'Helps several factions at once.'],
  ];
  function actEffect(o, f) {
    const RP = C.activities.rep; const a = G.ACTI[o.id]; const t = o.target != null ? elName(o.target) : '';
    switch (a.group) {
      case 'neutral': return `+${RP.neutral} ${elName(f)}`;
      case 'war': return `+${RP.war} ${elName(f)} · ${RP.warOthers} all others`;
      case 'counter': return `${RP.counter} ${t || 'target'} · its enemies pleased`;
      default: return o.id === 'fractalGift' ? `+${RP.group} split by the scale's shares` : `+${RP.group / 2} ${elName(f)}${t ? ' · +' + RP.group / 2 + ' ' + t : ''}`;
    }
  }
  function boardHtml() {
    const left = Math.max(0, Math.ceil(C.activities.refreshSeconds - (S.played - S.offersAt)));
    const open = [], locked = [];
    for (let f = 0; f < NE; f++) (S.access[f] && !fallen(f) ? open : locked).push(f);
    const cards = g => {
      const items = [];
      open.forEach(f => (S.offers[f] || []).forEach((o, i) => { if (G.ACTI[o.id].group === g) items.push({ f, o, i }); }));
      if (!items.length) return '<p class="mute center"><small>Nothing posted right now.</small></p>';
      return items.map(({ f, o, i }) => {
        const a = G.ACTI[o.id];
        return `<div class="note ${o.done ? 'done' : ''}" style="--fc:${EL[f].color}">
          <div class="note-pin"></div>
          <div class="note-head">${sw(f)} <b>${elName(f)}</b>${o.target != null ? ` <span class="note-tgt">→ ${sw(o.target)} ${elName(o.target)}</span>` : ''}</div>
          <div class="note-title">${a.name}</div>
          <small>${a.desc}</small>
          <div class="note-meta"><span>${actCost(o.id).replace(' · cost: ', '') || 'free'}</span><span class="note-eff">${actEffect(o, f)}</span></div>
          <button class="btn small ${o.done ? 'ghost' : ''}" type="button" data-act="activity" data-f="${f}" data-i="${i}" ${o.done ? 'disabled' : ''}>${o.done ? '✔ done' : 'Do it'}</button>
        </div>`;
      }).join('');
    };
    return `<div class="panel board-top"><div><b>${icon('scroll')} Activity board</b><br><small>Each faction you know posts ${C.activities.perFaction} requests. Helping one faction spreads reputation through the relationship matrix – its friends like it, its enemies don't.</small></div>
        <div class="board-timer"><small>new requests in</small><b data-live="actrefresh"></b></div></div>
      ${open.length ? '' : '<div class="panel empty" style="margin-top:14px">No faction talks to you yet. Raise a dragon to 1000 years – the faction it joins will start posting requests here.</div>'}
      ${open.length ? GROUPS.map(g => `<div class="section"><h3>${g[1]}</h3><small>${g[2]}</small></div><div class="board">${cards(g[0])}</div>`).join('') : ''}
      ${locked.length ? `<div class="section"><h3>Not yet talking to you</h3><small>raise a dragon that joins them</small></div><div class="panel row">${locked.map(f => `<span class="tag">${sw(f)} ${elName(f)}${fallen(f) ? ' (fallen)' : ''}</span>`).join('')}</div>` : ''}`;
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
      if (al) lines += `<text x="${(pos[a][0] + pos[b][0]) / 2}" y="${(pos[a][1] + pos[b][1]) / 2 - 8}" fill="${col}" font-size="18" text-anchor="middle" font-family="Nunito" font-weight="800" stroke="#1b1024" stroke-width="4" paint-order="stroke" letter-spacing="1">${G.allianceName(a, b)}</text>`;
    }
    const nodes = EL.map((e, i) => `<g><rect x="${pos[i][0] - 14}" y="${pos[i][1] - 14}" width="28" height="28" rx="4" fill="${e.color}" stroke="${i === S.ruler ? '#ffd23f' : '#1b1024'}" stroke-width="${i === S.ruler ? 5 : 3}"/><text x="${pos[i][0]}" y="${pos[i][1] + (pos[i][1] > cy ? 34 : -22)}" fill="#1b1024" font-size="17" text-anchor="middle" font-family="Nunito" font-weight="800" letter-spacing="1">${e.name}</text></g>`).join('');
    return `<div class="panel"><svg class="net" viewBox="0 0 400 380" role="img" aria-label="Faction relationship network">${lines}${nodes}</svg>
      <div class="legend"><span><span class="sw" style="background:#3fb85a"></span> strong liking</span><span><span class="sw" style="background:#ff4d3d"></span> strong dislike</span><span>thick = alliance with its own colour and name</span></div></div>`;
  }
  const fateText = f => ({ fallen: '<b class="bad">fallen</b>', defect: '<b class="good">defected to the victor</b>', fled: '<span class="mute">fled into exile</span>', stay: 'stays as a subject' })[f];

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

  // every living dragon in one list, with live ages
  SCREENS.dragons = function () {
    const F = ui.dfilter;
    const all = G.list(d => d.status === 'school' || d.status === 'adult' || d.status === 'wild' || d.status === 'exile');
    const groups = { all: () => true, pupils: d => d.status === 'school', adults: d => d.status === 'adult', mine: d => d.status === 'school' || d.raised, wild: d => d.status === 'wild', exile: d => d.status === 'exile' };
    let rows = all.filter(groups[F.who] || groups.all);
    if (F.f !== '') rows = rows.filter(d => (d.status === 'exile' ? d.exileOf : d.faction) === +F.f);
    const age = d => G.ageOf(d);
    const sorts = { old: (a, b) => age(b) - age(a) || a.id - b.id, young: (a, b) => age(a) - age(b) || a.id - b.id, name: (a, b) => a.name.localeCompare(b.name), strong: (a, b) => (b.status === 'adult' ? G.strength(b) : 0) - (a.status === 'adult' ? G.strength(a) : 0) || a.id - b.id };
    rows.sort(sorts[F.sort] || sorts.old);
    const count = k => all.filter(groups[k]).length;
    const whoTabs = [['all', 'All'], ['pupils', 'Pupils'], ['adults', 'Adults'], ['mine', 'Raised by you'], ['wild', 'Wild young'], ['exile', 'In exile']]
      .map(t => `<button class="btn small ${F.who === t[0] ? 'on' : ''}" type="button" data-act="dfilter" data-k="who" data-v="${t[0]}">${t[1]} (${count(t[0])})</button>`).join('');
    const sortTabs = [['old', 'Oldest'], ['young', 'Youngest'], ['strong', 'Strongest'], ['name', 'Name']]
      .map(t => `<button class="btn small ${F.sort === t[0] ? 'on' : ''}" type="button" data-act="dfilter" data-k="sort" data-v="${t[0]}">${t[1]}</button>`).join('');
    const facSel = `<select data-dfilter="f" aria-label="Faction filter"><option value="">All factions</option>${EL.map((e, f) => `<option value="${f}" ${F.f === String(f) ? 'selected' : ''}>${e.name} (${G.adultsOf(f).length})</option>`).join('')}</select>`;
    const status = d => d.status === 'school' ? 'Pupil · ' + zoneTitle(S.zones[d.zone]) : d.status === 'wild' ? 'Wild young · ' + elName(d.faction) : d.status === 'exile' ? 'In exile · from ' + elName(d.exileOf) : elName(d.faction) + (d.raised ? ' · raised by you' : '');
    const shown = rows.slice(0, F.limit);
    const list = shown.map(d => `<tr class="drow" data-act="dragon" data-id="${d.id}">
        <td><span class="dpic">${imgDragon(d, 2)}</span></td>
        <td><b>${d.name}</b><br><small>${SP.variantName(d)}</small></td>
        <td>${d.status === 'adult' ? sw(d.faction) + ' ' : ''}${status(d)}<div>${tags(d)}</div></td>
        <td class="dvec">${vecBar(d.v)}</td>
        <td><b data-live="age:${d.id}"></b></td>
        <td data-live="lvl:${d.id}"></td>
        <td>${d.status === 'adult' || d.status === 'exile' ? `<span data-live="str:${d.id}"></span>` : '<span class="mute">–</span>'}</td>
      </tr>`).join('');
    return `<div class="screen-head"><h2>All Dragons</h2><span class="sub">${all.length} living dragons · ${G.list(d => d.status === 'egg' || d.status === 'incubating').length} eggs waiting</span></div>
      <div class="tabs">${whoTabs}</div>
      <div class="row" style="margin-bottom:12px"><div class="tabs" style="margin:0">${sortTabs}</div><span class="spacer"></span><div style="min-width:200px">${facSel}</div></div>
      ${rows.length ? `<div class="panel table-wrap"><table class="list dlist"><tr><th></th><th>Name</th><th>Status</th><th>Elements</th><th>Age</th><th>Lvl</th><th>Strength</th></tr>${list}</table>
        ${rows.length > shown.length ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="btn small" type="button" data-act="dfilter" data-k="limit" data-v="${F.limit + 100}">Show ${Math.min(100, rows.length - shown.length)} more (${rows.length - shown.length} hidden)</button></div>` : ''}</div>`
        : '<div class="empty panel">No dragons match this filter.</div>'}`;
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
    $('#played').textContent = 'Year ' + fmt(C.time.startYear + Math.floor(S.played));
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
    const statusText = { school: 'Pupil in the ' + zoneTitle(S.zones[d.zone]), adult: 'Adult · belongs to ' + elName(d.faction), wild: 'Young wild dragon', exile: 'In exile · fled from ' + (d.exileOf != null ? elName(d.exileOf) : '?') }[d.status] || d.status;
    showModal({ rebuild: () => dragonModalHtml(d, statusText, parents), build(b) { b.innerHTML = this.rebuild(); } }, true);
  }
  function dragonModalHtml(d, statusText, parents) {
    return `<h2>${d.name}</h2><div class="reveal">${hero(imgDragon(d, 5), d.mat)}<div>${tags(d)}</div></div>
      <p class="center"><b>${statusText}</b><br><small>${SP.variantName(d)}</small></p>
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
        const h = `<h2>${cls.name} egg</h2><div class="reveal">${hero(imgEgg(d, 6, d.status === 'incubating' ? (d.ready ? 3 : G.crackStage(d)) : 0))}</div>`;
        if (!d.examined) {
          return h + `<p class="center">What sleeps inside is uncertain. The magnifier examines the egg and gives you a riddle.</p><div class="row" style="justify-content:center"><button class="btn" type="button" data-act="examine" data-id="${d.id}">${icon('lupe')} Examine (${G.examineCost(d)} G)</button></div>`;
        }
        const r = d.riddle;
        return h + `<h3>${icon('lupe')} Magnifier – uncertain candidates</h3><p class="center">${r.cand.map(e => `33 % ${elTag(e)} (?)`).join(' · ')}</p>
          <h3>The riddle</h3><div class="riddle bubble">${r.hints.map(t => `<i>“${t}”</i>`).join('')}</div>
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
      showModal({ html: `<h2>A dud!</h2><div class="reveal">${hero(im(SP.egg({ shell: '#8c8496', spots: '#5d566a', crack: 3, seed: 3 }, 6), ''))}
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
        b.innerHTML = `<h2>Hatched!</h2><div class="reveal">${hero(imgDragon(d, 5), d.mat, 'hx', true)}<div class="big" id="hn">…</div>
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
          settle(m);
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
  // clutch: a small, quiet info box at the side – the four rolls are still shown openly
  // the corner: every notice lands here as a small card – nothing blocks the screen, nothing needs a skip
  function cornerWrap() {
    let wrap = $('#clutches');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'clutches'; wrap.className = 'clutches'; document.body.appendChild(wrap); }
    const tb = document.querySelector('.topbar'); wrap.style.top = ((tb ? tb.getBoundingClientRect().bottom : 60) + 10) + 'px'; // top-right corner, clear of the herald
    return wrap;
  }
  function corner(html, o) {
    o = o || {};
    const wrap = cornerWrap();
    const el = document.createElement('div');
    el.className = 'cbox ' + (o.cls || '');
    if (o.act) { el.dataset.act = o.act; if (o.id != null) el.dataset.id = o.id; }
    el.title = o.title || 'Click for details';
    el.innerHTML = html;
    wrap.prepend(el);
    while (wrap.children.length > 4) wrap.lastChild.remove();
    setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 400); }, o.life || 9000);
    return el;
  }
  function clutchBox(ev) {
    const wrap = cornerWrap();
    const a = S.dragons[ev.a], b = S.dragons[ev.b];
    const r = ev.roll;
    const mix = a && b ? G.mixColor(a.v.map((x, i) => (x + b.v[i]) / 2)) : '#ffd23f';
    const el = document.createElement('div');
    el.className = 'cbox' + (r.z >= C.breed.bigClutch ? ' big' : '') + (r.a === 0 ? ' empty' : '');
    el.dataset.act = 'goChamber';
    el.title = 'Open the egg chamber';
    el.innerHTML = `<div class="chead"><span>${icon('nest')} Nest ${ev.slot + 1}</span><small>${a ? a.name : '?'} × ${b ? b.name : '?'}</small></div>
      <div class="crolls"><span data-k="a">gate <b>·</b></span><span data-k="x">x <b>·</b></span><span data-k="y">y <b>·</b></span><span data-k="z">z <b>·</b></span></div>
      <div class="ceggs"></div><div class="cres">…</div>`;
    wrap.prepend(el);
    while (wrap.children.length > 4) wrap.lastChild.remove();
    const quick = S.settings.anim === 'short';
    const set = (k, v, lo, hi) => new Promise(res => {
      const span = el.querySelector(`[data-k="${k}"] b`); if (!span) return res();
      let n = 0; const steps = quick ? 2 : 6;
      const id = setInterval(() => {
        if (n++ >= steps) { clearInterval(id); span.textContent = v; span.parentNode.classList.add('on'); return res(); }
        span.textContent = lo + Math.floor(Math.random() * (hi - lo + 1));
      }, 55);
    });
    (async () => {
      await set('a', r.a, 0, C.breed.gateMax);
      if (r.a === 0) {
        el.querySelectorAll('[data-k="x"],[data-k="y"],[data-k="z"]').forEach(s => s.classList.add('off'));
        el.querySelector('.cres').innerHTML = '<span class="bad">The nest goes dark – no eggs.</span>';
      } else {
        await set('x', r.x, 1, C.breed.xMax);
        await set('y', r.y, 1, r.x);
        await set('z', r.z, 1, r.y);
        el.querySelector('.ceggs').innerHTML = ev.eggs.map((id, i) => imgEgg(S.dragons[id] || { seed: i, shell: mix }, 2)).join('');
        el.querySelector('.cres').innerHTML = `<b>${r.z} egg${r.z === 1 ? '' : 's'}</b> in the egg chamber${r.z >= C.breed.bigClutch ? ' – <span class="goldt">a giant clutch!</span>' : ''}`;
        Snd.tone(660, 0.12, 'triangle', 0.03); // one soft chime
      }
      setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 400); }, 9000);
    })();
  }

  function graduateModal(ev) {
    const d = S.dragons[ev.id]; if (!d) return;
    const fac = ev.faction;
    const notes = [];
    if (ev.firstAccess) notes.push('<b class="goldt">Access to ' + elName(fac) + ' – reputation Friendly!</b>');
    if (ev.becamePure) notes.push('<b class="goldt">Imprinted purebred (20/20)!</b>');
    else if (ev.deep) notes.push('<span class="epic">Turned deep (carries the zone\'s arch-enemy)</span>');
    else if (ev.shifted) notes.push('<small>Imprinted one step toward the zone</small>');
    corner(`<div class="chead"><span>${icon('star')} Grown up</span><small>${zoneTitle(S.zones[ev.zone])}</small></div>
      <div class="crow"><span class="cpic">${imgDragon(d, 2)}</span><div><b>${d.name}</b> joins ${elTag(fac)}<br><small>${ev.probs.map(p => elName(p.el) + ' ' + pct(p.p)).join(' · ')}</small></div></div>
      ${notes.length ? `<div>${notes.join('<br>')}</div>` : ''}`, { cls: ev.firstAccess || ev.becamePure ? 'big' : '', act: 'dragon', id: d.id, life: 10000, title: 'Open the dragon card' });
    if (ev.becamePure || ev.firstAccess) Snd.fanfare(); else Snd.tone(784, 0.1, 'triangle', 0.03);
  }
  function warCard(w) {
    const lost = Object.values(w.losses || {}).reduce((n, l) => n + l.fallen, 0);
    corner(`<div class="chead"><span>${icon('sword')} The war is over</span></div>
      <div><b>${sideTxt(w.wside || [w.winner])} win</b> against ${sideTxt(w.lside || [w.loser])}<br><small>roll ${w.roll.toFixed(3)} ${w.attackerWins ? '&lt;' : '≥'} ${w.chance.toFixed(3)} · ${lost} fallen${w.newRuler ? ' · new ruler: ' + elName(w.winner) : ''}</small></div>
      ${(w.collapsed || []).length ? `<small class="bad"><b>${sideTxt(w.collapsed)} fell from the sky</b></small>` : ''}
      ${w.pledge ? `<small class="${w.pledge.won ? 'good' : 'bad'}"><b>${w.pledge.won ? 'Your pledge paid +' + w.pledge.spoils + ' G' : 'Your pledged side lost'}</b></small>` : ''}
      ${w.fates.length ? `<small>${w.fates.length} of your dragons fought – click for their fates</small>` : '<small>Click for the full report</small>'}`, { cls: 'big', act: 'warDetails', life: 14000, title: 'Full war report' });
  }
  function warResultModal(w) {
    Snd.drum();
    const sa = sideOf(w, 'a'), sd = sideOf(w, 'd');
    const lossRows = Object.keys(w.losses || {}).map(f => { const l = w.losses[f]; return `<tr><td>${elTag(+f)}</td><td>${l.fallen}</td><td>${l.defect}</td><td>${l.fled}</td></tr>`; }).join('');
    showModal({
      html: `<h2>The war is over</h2><div class="reveal">
        ${w.ca && w.cd ? `<p>Champions: <b>${w.ca.name}</b> of ${elName(w.attacker)}${w.ca.fallen ? ' <b class="bad">(fallen)</b>' : ''} vs <b>${w.cd.name}</b> of ${elName(w.defender)}${w.cd.fallen ? ' <b class="bad">(fallen)</b>' : ''}</p>` : ''}
        ${w.pledge ? `<p class="${w.pledge.won ? 'good' : 'bad'}"><b>${w.pledge.won ? 'Your pledge paid off: +' + w.pledge.spoils + ' G and the winners\' gratitude.' : 'Your pledged side lost. The winners will remember.'}</b></p>` : ''}
        <p>${sideTags(sa)} <b>${w.pa.toFixed(1)}</b> power<br>vs<br>${sideTags(sd)} <b>${w.pd.toFixed(1)}</b> power<br><small>Alliances fight side by side at full strength.</small></p>
        <p>Attackers' chance: <b>${pct(w.chance)}</b> · roll: <b>${w.roll.toFixed(3)}</b> ${w.attackerWins ? '&lt;' : '≥'} ${w.chance.toFixed(3)}</p>
        ${burstBox(sideTxt(w.wside || [w.winner]).toUpperCase() + ' WIN!')}${w.newRuler ? `<p class="big">${elName(w.winner)} now rules the sky.</p>` : ''}
        ${lossRows ? `<table class="list" style="max-width:380px"><tr><th>Losing side</th><th>fallen</th><th>defected</th><th>fled</th></tr>${lossRows}</table>` : ''}
        ${(w.collapsed || []).length ? `<p class="bad"><b>${sideTxt(w.collapsed)} ${w.collapsed.length > 1 ? 'have' : 'has'} fallen</b> – the survivors scatter or go into exile.</p>` : ''}
        <p><small>The losing leader's king falls. Winners grow closer, the losers' alliances strain. Fled dragons return after ${Math.round(C.war.exileReturnSeconds / 60)} min.</small></p>
        ${w.fates.length ? '<h3>Dragons you raised</h3>' + w.fates.map(x => `<div class="row">${im(SP.dragon({ id: 'f' + x.id, v: x.v, mat: x.mat, seed: x.seed, deep: false }, 2), '')} ${x.name}: ${fateText(x.fate)}</div>`).join('') : ''}</div>`,
    });
  }

  // ------------------------------------------------------------ events from the game logic
  function handleEvents() {
    for (const e of G.drain()) {
      switch (e.type) {
        case 'clutch': clutchBox(e); break;
        case 'graduate': graduateModal(e); break;
        case 'eggReady': toast('An egg in the ' + zoneTitle(S.zones[e.zone]) + ' is ready to hatch!', 'good'); Snd.tone(880, 0.1, 'triangle', 0.06); break;
        case 'mature': { const d = S.dragons[e.id]; if (d) toast(d.name + ' is now mature (300 yrs).'); break; }
        case 'repLevel':
          if (e.up) { Snd.fanfare(); const unl = C.rep.unlocks[G.REPL[e.to].id]; corner(`<div class="chead"><span>${icon('star')} Reputation</span><small>${elName(e.f)}</small></div><div><b class="goldt">${G.REPL[e.to].name}!</b> ${elTag(e.f)} now regards you as ${G.REPL[e.to].name}.</div>${unl ? '<small class="good"><b>Unlocked: ' + unl + '</b></small>' : ''}`, { cls: 'big', act: 'nav', id: 'factions', life: 10000 }); }
          else toast(elTag(e.f) + ': reputation drops to ' + G.REPL[e.to].name, 'bad');
          break;
        case 'royalSpeech': sayCourt(Court.kingSpeech(e)); if (e.decree) { const d = C.decrees.find(x => x.id === e.decree); toast(`📜 Royal decree: <b>${d.name}</b> – ${d.text}`, 'epic'); } break;
        case 'ministerSpeech': sayCourt(Court.ministerSpeech(e)); break;
        case 'argumentStart':
          sayCourt(Court.challenge(e));
          toast(`${icon('crown')} <b>${elName(e.attacker)} challenges the Dragon King!</b> If the King loses the argument, it means war.`, 'war');
          if (window.Cinema && S.settings.cinema !== false) Cinema.arenaOpen(e, { cost: C.war.argument.whisperCost, snd: Snd, chance: t => G.argueChance(t), onWhisper: side => { const r = G.whisper(side); if (!r.ok) toast(r.msg, 'bad'); else { Snd.coin(); toast('Your whisper reaches ' + (side === 'king' ? 'the King' : elName(e.attacker)) + '.', 'good'); } render(true); return r; } });
          break;
        case 'argumentRound': if (window.Cinema && Cinema.arenaOpenNow()) Cinema.arenaRound(e); else toast(`Round ${e.i} (${Court.TOPIC[e.topic]}): ${e.kingWon ? 'the King prevails' : elName(e.attacker) + ' strikes'} – roll ${e.roll.toFixed(3)} ${e.kingWon ? '&lt;' : '≥'} ${e.p.toFixed(2)}`, e.kingWon ? 'epic' : 'war'); break;
        case 'argumentEnd':
          if (window.Cinema && Cinema.arenaOpenNow()) Cinema.arenaEnd(e);
          sayCourt(Court.verdict(e));
          toast(e.kingWon ? `${icon('crown')} <b>The King's word holds.</b> ${elName(e.attacker)} backs down.` : `${icon('sword')} <b>The King is silenced. WAR!</b>`, e.kingWon ? 'epic' : 'war');
          break;
        case 'peace': sayCourt(Court.peace(e)); Snd.fanfare(); toast(`${icon('peace')} Peace! ${elName(e.a)} and ${elName(e.b)} lower their claws.`, 'epic'); break;
        case 'warAnnounce': sayCourt(Court.declaration(e), true); toast(sideTxt(e.sa || [e.attacker]) + ' challenge ' + sideTxt(e.sd || [e.defender]) + '! The sky darkens.', 'war'); Snd.drum(); break;
        case 'factionFallen': sayCourt(Court.lament(e)); toast(`${elTag(e.f)} <b>has fallen</b> (${e.why}). Its survivors scatter.`, 'war'); break;
        case 'factionReformed': Snd.fanfare(); toast(`${elTag(e.f)} <b>reforms</b> – ${e.how}.`, 'epic'); break;
        case 'warFight': toast('The war begins! ' + sideTxt(e.sa || []) + ' vs ' + sideTxt(e.sd || []), 'war'); break;
        case 'warResult':
          ui.lastWar = e;
          if (window.Cinema && S.settings.cinema !== false) Cinema.war(e, { mode: S.settings.anim === 'short' ? 'short' : 'full', flash: S.settings.flash, snd: Snd, done: () => warCard(e) });
          else warCard(e);
          break;
        case 'coronation': { sayCourt(Court.coronation(e)); const k = S.dragons[e.king]; const l = G.lawOf(e.f) || C.lawPlaceholder; toast(`♛ Coronation: ${k ? k.name : '?'} (${elName(e.f)}) – ${l.name}: ${l.text}`, 'epic'); Snd.epic(); break; }
        case 'portal': { const z = S.zones[e.zone]; Snd.epic(); corner(`<div class="chead"><span>${icon('world')} A portal opens!</span></div><div class="crow"><span class="cpic">${im(SP.portal(z.els.map(x => EL[x].color), 0, false, 1), '')}</span><div>The <b>${zoneTitle(z)}</b> can now be reached (${e.how}).</div></div>`, { cls: 'big', act: 'zone', id: z.id, life: 12000, title: 'Step through' }); break; }
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
    dfilter: d => { ui.dfilter[d.k] = d.k === 'limit' ? +d.v : d.v; if (d.k !== 'limit') ui.dfilter.limit = 120; render(true); },
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
    help: () => { closeModal(); helpModal(0); },
    book: d => { ui.bookPage = +d.id; refreshModal(); const mb = document.querySelector('.modal-box'); if (mb) mb.scrollTop = 0; },
    audience: () => {
      const r = G.audience(); if (!r.ok) return result(r);
      sayCourt(Court.audienceReply(r));
      if (r.pleased) { Snd.epic(); toast(`The King is pleased (roll ${r.roll.toFixed(3)} &lt; ${r.chance.toFixed(2)}). Royal favour: scales +${Math.round(C.diplomacy.favourScaleBonus * 100)} %!`, 'epic'); }
      else { Snd.bad(); toast(`The King is unimpressed (roll ${r.roll.toFixed(3)} ≥ ${r.chance.toFixed(2)}).`, 'bad'); }
      render(true);
    },
    envoy: () => {
      const ev = ui.envoy; const r = G.envoy(ev.type, +ev.a, +ev.b); if (!r.ok) return result(r);
      const rolled = ev.type === 'alliance' || ev.type === 'pact' ? ` (roll ${r.roll.toFixed(3)} ${r.success ? '&lt;' : '≥'} ${r.chance.toFixed(2)})` : '';
      const txt = { alliance: r.success ? `The envoy returns triumphant: ${elName(r.a)} and ${elName(r.b)} draw closer${r.forged ? ' – the alliance <b>' + G.allianceName(r.a, r.b) + '</b> is forged!' : '.'}` : `The envoy is turned away by ${elName(r.a)} and ${elName(r.b)}.`,
        pact: r.success ? `${elName(r.a)} and ${elName(r.b)} swear a pact of peace.` : `${elName(r.a)} and ${elName(r.b)} refuse to sign.`,
        wedding: `Bells ring across the sky! ${r.bride} of ${elName(r.a)} weds ${r.groom} of ${elName(r.b)}.${r.forged ? ' A new alliance is born!' : ''}`,
        tribute: `${elName(r.a)} accepts your tribute.` }[ev.type];
      if (r.success) { Snd.fanfare(); if (ev.type === 'wedding') flash(); } else Snd.bad();
      toast(txt + rolled, r.success ? 'epic' : 'bad');
      render(true);
    },
    pledge: d => { const r = G.pledge(d.side); if (r.ok) { Snd.drum(); toast('Your war chest rides with the ' + (d.side === 'a' ? 'attackers' : 'defenders') + '!', 'war'); } result(r); },
    peace: () => {
      const r = G.envoy('peace'); if (!r.ok) return result(r);
      if (!r.success) { Snd.bad(); toast(`Peace talks fail (roll ${r.roll.toFixed(3)} ≥ ${r.chance.toFixed(2)}). ${elName(r.a)} is insulted.`, 'bad'); }
      render(true);
    },
    courtLog: () => courtLogModal(),
    warDetails: () => { if (ui.lastWar) warResultModal(ui.lastWar); },
    watchArgument: () => { if (window.Cinema && Cinema.arenaOpenNow()) Cinema.arenaShow(); else toast('The argument is over.', 'bad'); },
    whisper: d => { const r = G.whisper(d.side); if (r.ok) { Snd.coin(); toast('Your whisper reaches ' + (d.side === 'king' ? 'the King' : elName(S.war.attacker)) + '.', 'good'); } result(r); },
    story: () => storyModal(),
    storyTab: d => { ui.storyTab = d.id; refreshModal(); const mb = document.querySelector('.modal-box'); if (mb) mb.scrollTop = 0; },
    reset: () => { if (confirm('Really delete your save and start over?')) { localStorage.removeItem(C.saveKey); location.reload(); } },
  };
  function closeAllModals() { ui.queue = ui.queue.filter(m => m.keep); if (ui.modal && !ui.modal.busy) nextModal(); }

  document.addEventListener('click', e => {
    Snd.init();
    if (e.target.id === 'modal') { closeModal(); return; }
    const el = e.target.closest('[data-act]'); if (!el) return;
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
    const es = e.target.closest('select[data-envoy]');
    if (es) { ui.envoy[es.dataset.envoy] = es.value; es.blur(); render(true); return; }
    const fs = e.target.closest('select[data-dfilter]');
    if (fs) { ui.dfilter[fs.dataset.dfilter] = fs.value; ui.dfilter.limit = 120; fs.blur(); render(true); return; }
    const s = e.target.closest('select[data-nest]'); if (!s) return;
    const i = +s.dataset.nest; ui.nestSel[i] = ui.nestSel[i] || {}; ui.nestSel[i][s.dataset.which] = s.value; s.blur(); render(true);
  });
  document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => ACT.nav({ id: b.dataset.nav })));
  $('#btn-sound').addEventListener('click', () => { S.settings.sound = !S.settings.sound; Snd.init(); updateTop(); });
  $('#btn-anim').addEventListener('click', () => { const o = ['auto', 'full', 'short']; S.settings.anim = o[(o.indexOf(S.settings.anim) + 1) % 3]; toast('Animations: ' + ({ auto: 'automatic', full: 'full', short: 'short' })[S.settings.anim]); updateTop(); });
  $('#btn-help').addEventListener('click', () => helpModal());
  $('#btn-story').addEventListener('click', () => storyModal());
  $('#herald').addEventListener('click', e => { if (e.target.closest('#herald-log')) { courtLogModal(); return; } if (e.target.closest('#herald-min')) { S.settings.heraldMin = !S.settings.heraldMin; heraldLayout(); return; } herald.hurry = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.modal) closeModal(); });

  // ------------------------------------------------------------ the Keeper's Handbook
  const pd = (v, id, scale, flip) => imgDragon({ id: 'book' + id, v, mat: 0, seed: 1000 + String(id).length * 7 + v.indexOf(Math.max(...v)) * 13, deep: false, name: '' }, scale || 3, flip);
  const pureV = e => { const v = new Array(NE).fill(0); v[e] = 20; return v; };
  const mixV = (a, na, b2, nb) => { const v = new Array(NE).fill(0); v[a] = na; v[b2] = nb; return v; };
  const skyImg = col => { const cv = SP.skyDragon(col, 0, false, false, 0, false); return `<img src="${cv.toDataURL()}" width="${cv.width * 3}" height="${cv.height * 3}" alt="" style="background:#2a1c66">`; };
  const fig = (inner, cap) => `<figure class="fig">${inner}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
  const tip = t => `<div class="tip"><b>KEEPER'S TIP</b> ${t}</div>`;
  const CHAPTERS = [
    { t: 'Welcome, Keeper', i: 'egg', body: () => `
      <p>High above the clouds lies a world that belongs to the dragons. Twelve elements shape it – fire and frost, light and shadow, storm and stone – and twelve factions fight for the right to rule its sky.</p>
      <p>You are a <b>Keeper</b>. Grown dragons do not answer to you. But every dragon was once an egg, and eggs are your business. You buy them, guess what sleeps inside, warm them in the right place and raise the hatchlings at the <b>Dragon School</b>. When they come of age they fly off, choose a faction of their own – and from then on, their shed scales are your living.</p>
      ${fig(im(SP.egg({ shell: '#E6DCC0', spots: '#B8A57E', seed: 3 }, 4), '') + ' → ' + im(SP.egg({ shell: '#E6DCC0', spots: '#B8A57E', seed: 3, crack: 2 }, 4), '') + ' → ' + pd(pureV(1), 'w1', 3) + ' → ' + skyImg(EL[1].color), 'egg · cracking · hatchling · grown dragon in the sky')}
      <h3>Time flows only while you play</h3>
      <p><b>One game year is one real second.</b> Eggs, pupils and wars only move while the game is open. When you leave, the world holds its breath – only the grown dragons keep ageing, because they live by the calendar, not by your clock.</p>
      <table><tr><th>Moment</th><th>Age</th><th>Real time</th></tr><tr><td>Level up</td><td>every 10 years</td><td>10 s</td></tr><tr><td>Mature (can breed)</td><td>300 years</td><td>5 min</td></tr><tr><td>Grown, leaves school</td><td>1000 years</td><td>≈ 17 min</td></tr></table>
      <h3>Finding your way</h3>
      <p>${icon('world')} <b>World</b> – the portals to the zones. ${icon('school')} <b>School</b> – egg chamber, pupils, riddle log. ${icon('nest')} <b>Nest</b> – pair your dragons. ${icon('market')} <b>Market</b> – buy and sell eggs. ${icon('factions')} <b>Factions</b> – politics, reputation, wars. ${icon('bag')} <b>Bag</b> – scales and your collection. ${icon('log')} <b>Log</b> – every roll, every clutch, every event.</p>
      ${tip('A red dot on the bottom bar means something wants your attention: an egg is ready, a nest is restless, or the daily wonder egg is waiting.')}` },
    { t: 'Eggs & the Merchant', i: 'market', body: () => `
      <p>The merchant sells eggs in five classes. The class tells you how the egg was bred – it never tells you the element. That is what the magnifier is for.</p>
      ${fig(C.eggClasses.map((c, i) => im(SP.egg({ shell: c.shell, spots: c.spots, seed: i + 2 }, 4), c.name)).join(''), C.eggClasses.map(c => c.name).join(' · '))}
      <table><tr><th>Class</th><th>Inside</th><th>Price</th><th>Dud</th><th>Refund</th></tr>
      ${C.eggClasses.map(c => `<tr><td><b>${c.name}</b></td><td>${({ cheap: 'random mix', common: 'one element ≥ 50 %', noble: 'one element ≥ 80 %', pure: 'one element, 100 %', rare: 'a deliberate alliance or arch-enemy mix' })[c.id]}</td><td>${fmt(c.price)} G</td><td>${pct(c.dud)}</td><td>${pct(c.refund)}</td></tr>`).join('')}</table>
      <h3>Duds</h3><p>Any bought egg can be empty. When a dud "hatches" you get back part of the shell price – up to every last coin for the finest classes. Keep the shells: after <b>${C.market.pityShells} dud shells</b> the merchant feels sorry for you and gives you a guaranteed egg of a higher class.</p>
      <h3>Offers, the wonder egg and selling</h3><p>Better eggs appear as offers that expire. Once a day a <b>wonder egg</b> can be claimed for free. The merchant buys eggs back at ${pct(C.market.buybackRate)} of their price (examined eggs +${pct(C.market.examinedBonus)}), but pays less the more eggs of one element you dump on him; his appetite returns slowly.</p>
      ${tip('Cheap eggs are the <b>only</b> way to find metal and gem dragons. A steady trickle of Cheap eggs is never wasted.')}` },
    { t: 'The Magnifier & Riddles', i: 'lupe', body: () => `
      <p>An egg's shell hides its element vector. At the School you can <b>examine</b> an egg for a little gold. The magnifier then names three uncertain candidates – one of them is the egg's strongest element – and the egg whispers a <b>riddle</b>.</p>
      <div class="riddle bubble"><i>“${C.riddle.phrases[3].t}”</i><i>“${C.riddle.phrases[19].t}”</i></div>
      <p>The riddle language never lies about its own meaning: a phrase always points at the same pair of elements. A cool shell always means water or ice. But at first some hints are noise. Pick one of the three candidates as your <b>label</b>.</p>
      <h3>Why guess?</h3><p>The label is only a note – it does not change the egg. But when the dragon hatches, a correct guess earns <b>school reputation</b>, and hits in a row earn more. Higher school reputation makes every later riddle clearer: more hints, less noise (clarity ${G.schoolClarity()}/${C.riddle.maxClarity} right now).</p>
      <p>Rarely a riddle mentions a <b>glitter</b> beneath the shell. Often that means metal. Sometimes it means nothing at all.</p>
      ${tip('Keep your own dictionary. The School\'s <b>riddle log</b> lists every riddle, your label and the dragon that actually hatched – the language reveals itself there.')}` },
    { t: 'Hatching & the Zones', i: 'world', body: () => `
      <p>Each portal leads to an elemental zone with its own hatchery. The magma zone warms eggs in a lava pool, the fire zone in an ember oven.</p>
      ${fig(im(SP.hatchery('lava', ['#FF8C1A'], 0, 3), '') + im(SP.hatchery('oven', ['#E8341C'], 0, 3), '') + im(SP.hatchery('nest', ['#3FA34D'], 0, 3), ''), 'lava pool · ember oven · hatchery (other zones: still a placeholder)')}
      <p>Place an egg in a free brood slot. Over ${C.incubation.seconds} seconds cracks spread across the shell – but the <b>last crack is yours</b>. Click the egg when it shakes.</p>
      <h3>The right zone matters</h3>
      <p>Which dragon hatches is pure chance. Where it grows up decides whether it reaches its potential. Its scales are worth <b>×(1 + share of the zone's element)</b>:</p>
      <table><tr><th>Dragon</th><th>Raised in</th><th>Scale value</th></tr><tr><td>100 % Water</td><td>Water Zone</td><td><b>×2.0</b></td></tr><tr><td>60 % Water, 40 % Light</td><td>Water Zone</td><td>×1.6</td></tr><tr><td>60 % Water, 40 % Light</td><td>Fire Zone</td><td>×1.0</td></tr></table>
      <p>At 1000 years the zone <b>imprints</b> the dragon: one step of its strongest foreign element moves to the zone's element. Reaching 20/20 that way makes it purebred. But a dragon that carries the zone's <b>arch-enemy</b> turns <b>deep</b> instead – a darker tint, no imprint, no bonus. A dragon raised in the zone of its own strongest element becomes <b>shimmering</b>.</p>
      ${fig(pd(mixV(0, 8, 4, 12), 'z1', 3) + pd(mixV(0, 8, 4, 12), 'z2', 3).replace('<img', '<img style="filter:brightness(.6)"'), 'normal · deep')}` },
    { t: 'Dragon School', i: 'school', body: () => `
      <p>Every hatchling joins the School in its zone. School life is passive – the young ones grow while you play. Every 10 years they gain a level; at <b>300</b> they are mature and may breed; at <b>1000</b> they are grown.</p>
      <h3>Coming of age</h3>
      <p>A grown dragon leaves the School, is imprinted by its zone and <b>chooses its own faction</b>. The choice follows its element shares, nudged by politics: the ruling faction attracts, the ruler's arch-enemy repels. The roll is shown openly.</p>
      ${fig(pd(mixV(4, 8, 0, 12), 'g1', 4), 'a 60 % Fire / 40 % Lightning dragon joins Fire about 60 % of the time – more if Fire rules')}
      <p>From that moment it belongs to its faction, not to you. It flies in the sky in the faction's colours and drops its scales onto the ground of the zone it grew up in.</p>
      ${tip('The <b>first</b> dragon you raise for a faction opens the door to it: your reputation jumps to Friendly and you may collect its scales.')}` },
    { t: 'The Twelve Elements', i: 'star', body: () => `
      <p>Every dragon is a mix of twelve elements in 5 % steps. Its body is made of pure-coloured scales in exactly that ratio – a 40 % Lightning, 60 % Fire dragon is 40 % yellow and 60 % red scales. Rare <b>fractal scales</b> carry the blended colour.</p>
      ${fig(EL.map((e, i) => `<span style="display:inline-grid;justify-items:center;font-size:12px">${pd(pureV(i), 'e' + i, 2)}${e.name}</span>`).join(''), 'purebred dragons of all twelve elements')}
      <h3>Arch-enemies</h3>
      <table>${[0, 2, 4, 6, 8, 10].map(i => `<tr><td>${elTag(i)}</td><td>✕</td><td>${elTag(i + 1)}</td></tr>`).join('')}</table>
      <p>Arch-enemies never mate and never ally. A dragon with only one element is <b>purebred</b>. A dragon that somehow carries both halves of an enemy pair – usually through a mutation – is an <b>impossible dragon</b>.</p>` },
    { t: 'Breeding & Clutches', i: 'heart', body: () => {
      const ex = expectedClutch();
      return `
      <p>At the Nest you can pair two dragons aged 300+: your pupils, or grown dragons of factions where you are Friendly (same faction or allied). A new clutch takes <b>at least ${C.breed.minYears} years</b>; after that the wait is random, about ${Math.round(1 / C.breed.chancePerYear)} more years on average – and the spread is huge. Shortly before, the nest turns <b>restless</b>.</p>
      <h3>Four open rolls</h3>
      <p>1. The <b>gate roll</b> 0–6: on 0 the nest goes dark. 2. <b>x</b> from 1–12: that many egg shadows appear. 3. <b>y</b> from 1–x: the extra shadows fade. 4. <b>z</b> from 1–y: the last shadows become real eggs.</p>
      ${fig(im(SP.nest('#3A76E0', false, 2), ''), 'the nest glows in the parents\' blended colour')}
      <table><tr><th>Eggs</th>${ex.map((p2, z) => `<th>${z}</th>`).join('')}</tr><tr><td>Chance</td>${ex.map(p2 => `<td>${(p2 * 100).toFixed(p2 < 0.01 ? 2 : 1)}</td>`).join('')}</tr></table>
      <p>On average two eggs; twelve eggs happen once in 2016 clutches.</p>
      <h3>Inheritance</h3>
      <p>Two purebred parents of the same element <b>always</b> breed purebred eggs. Otherwise the egg starts at the parents' average and drifts 0–2 steps; with ${pct(C.breed.mutationChance)} chance a brand-new element appears – a <b>mutation</b>. The Nest previews the possible range before you pair.</p>`; } },
    { t: 'Scales', i: 'bag', body: () => `
      <p>Grown dragons shed a scale every ${C.scales.dropMeanSeconds} seconds or so. Scales fall onto the ground of their zone (up to ${C.zones.groundCapacity}; the oldest crumble when it is full) and must be <b>picked up by hand</b>. Collect quickly to build a combo.</p>
      ${fig(['common', 'shimmer', 'war', 'radiant'].map((q, i) => im(SP.scaleSprite(EL[[0, 8, 4, 2][i]].color, q, false, 0, 5), '')).join('') + im(SP.scaleSprite(G.mixColor(mixV(0, 10, 6, 10)), 'common', true, 0, 5), ''), 'common · shimmering · war-marked · radiant · fractal')}
      <table><tr><th>Quality</th><th>Comes from</th><th>Value</th><th>Needs</th></tr>
      <tr><td>Common</td><td>any dragon</td><td>×1</td><td>Friendly</td></tr>
      <tr><td>Shimmering</td><td>raised in its strongest element's zone</td><td>×${C.scales.quality.shimmer.factor}</td><td>Honored</td></tr>
      <tr><td>War-marked</td><td>fought in a war</td><td>×${C.scales.quality.war.factor}</td><td>Revered</td></tr>
      <tr><td>Radiant</td><td>king or government</td><td>×${C.scales.quality.radiant.factor}</td><td>Exalted</td></tr>
      <tr><td>Fractal</td><td>${pct(C.scales.fractalChance)} of all drops</td><td>×${C.scales.fractalFactor}</td><td>Honored</td></tr></table>
      <h3>Worked example</h3>
      <p>A 4,000-year-old purebred Water dragon raised in the Water Zone drops a common scale: base ${C.scales.baseValue} × level 3 × zone 2.0 = <b>12 G</b>. If it is war-marked: <b>60 G</b>. Older dragons drop bigger scales – the level grows by one each time the age doubles.</p>
      <p>Politics changes prices: the ruler's element sells for ×${C.scales.rulerDemand}, its arch-enemy's for ×${C.scales.rulerEnemyDemand}, and some laws take a levy.</p>` },
    { t: 'Metal & Gem Dragons', i: 'coin', body: () => `
      <p>Once in a while a Cheap egg hatches a dragon made entirely of metal or gemstone. It still belongs to an element and a faction, but every scale is gold, jade or diamond.</p>
      ${fig([1, 6, 13, 18, 20].map(k => imgDragon({ id: 'bm' + k, v: pureV(k % 12), mat: k, seed: k * 31, deep: false, name: '' }, 2)).join(''), 'Copper · Jade · Sapphire · Diamond · Red Diamond')}
      <table><tr><th>Tier</th><th>Material</th><th>Chance</th><th>Scale value</th></tr>${C.material.tiers.map((t, i) => `<tr><td>${i + 1}</td><td>${swc(t.color)} ${t.name}</td><td>1 : ${fmt(Math.round(1 / G.materialChance(i + 1)))}</td><td>×${G.matFactor(i + 1).toFixed(2)}</td></tr>`).join('')}</table>
      <p>All tiers together: roughly one Cheap egg in 17. Every Cheap egg without material raises your <b>luck counter</b> by ${pct(C.material.luckStep)} – it resets when luck strikes. Your Bag keeps a collection of all 20 tiers for every element.</p>` },
    { t: 'Factions & Reputation', i: 'factions', body: () => `
      <p>Each element is a faction with its own population, needs and opinions. Their relations are lopsided – Fire may love Wind while Wind barely tolerates Fire. When both sides like each other enough they form a named <b>alliance</b> with its own colour.</p>
      <table><tr><th>Reputation</th><th>Unlocks</th></tr>${G.REPL.slice(3).map(l => `<tr><td><b>${l.name}</b></td><td>${C.rep.unlocks[l.id] || (l.id === 'neutral' ? 'nothing yet' : '')}</td></tr>`).join('')}</table>
      <p>Below Neutral lie Unfriendly, Hostile and Hated. At Hostile, that faction's portal slams shut.</p>
      <h3>Every favour has a price</h3>
      <p>Reputation spreads through the relationship web: helping Water pleases Water's friends – and angers Fire. You can never be everyone's friend, but you can be friends with enough of them.</p>
      <p>Each faction offers three <b>activities</b>, refreshed every ${C.activities.refreshSeconds / 60} minutes:</p>
      <table><tr><td><span class="tag" style="background:var(--green);color:#fff">neutral</span></td><td>small favours, only the target reacts</td></tr><tr><td><span class="tag" style="background:var(--red);color:#fff">war</span></td><td>a huge boost for one, everyone else is annoyed</td></tr><tr><td><span class="tag" style="background:var(--orange);color:#fff">counter</span></td><td>hurt a faction – its enemies cheer</td></tr><tr><td><span class="tag" style="background:var(--purple);color:#fff">group</span></td><td>help several factions at once</td></tr></table>` },
    { t: 'Kings, Laws & War', i: 'crown', body: () => `
      <p>The <b>eldest</b> dragon of the ruling faction is always the <b>Dragon King</b>. The king appoints a government – often mixed dragons, for diplomacy. Kings and ministers shed <b>radiant</b> scales. In the sky the king wears a crown and ministers a golden sash.</p>
      <p>Age is a double-edged sword: a dragon is strongest at 1000 years and slowly weakens after (90 % strength at 10,000). Old factions are rich but brittle; young factions grow hungry.</p>
      <h3>Laws</h3>
      <table>${Object.keys(C.laws).map(k => `<tr><td>${elTag(G.EI[k])}</td><td><b>${C.laws[k].name}</b></td><td>${C.laws[k].text}</td></tr>`).join('')}</table>
      <h3>War</h3>
      <p>Each faction has four needs: <b>space, brood, honour and tribute</b>. Crowded, unhappy, uncompromising factions risk war. You will see it coming: the needs flash, the faction warns you, and the sky turns red.</p>
      <p>The battle is one open roll: the attacker wins with chance <b>power ÷ (power + defender's power)</b>, allies counting half. The loser's king always falls. About 30 % of the losers fall, 30 % defect or flee, the rest stay as subjects. Everyone who fought is war-marked – and the fate of every dragon you raised is told one by one.</p>
      ${tip('War is the sky\'s brake on overpopulation. A faction bursting at the seams is a faction about to fight.')}` },
    { t: 'The Court & Diplomacy', i: 'crown', body: () => `
      <p>The sky is not ruled by claws alone. Every <b>${C.diplomacy.speechEvery} years</b> the Dragon King addresses the realm – listen at the bottom of the screen. Between speeches the ministers of the government brief you: the Minister of War warns of restless factions, the Spymaster whispers which houses are close to an alliance, the Master of Coin talks prices.</p>
      <h3>Royal decrees</h3>
      <p>Every ${C.diplomacy.decreeEvery === 2 ? 'second' : C.diplomacy.decreeEvery + 'th'} speech carries a decree that really changes the world for ${Math.round(C.diplomacy.decreeSeconds / 60 * 10) / 10} minutes:</p>
      <table>${C.decrees.map(d => `<tr><td><b>${d.name}</b></td><td>${d.text}</td></tr>`).join('')}</table>
      <h3>Audience with the King</h3>
      <p>Bring a gift of ${C.diplomacy.audienceCost} G. If the King is pleased (better odds the more he likes you) you gain reputation and the <b>royal favour</b>: your scales sell for +${Math.round(C.diplomacy.favourScaleBonus * 100)} % for ${C.diplomacy.favourSeconds / 60} minutes. Displease him and he remembers.</p>
      <h3>The envoy desk</h3>
      <table><tr><td><b>Forge an alliance</b></td><td>a rolled chance to bring two factions much closer – maybe into a named alliance</td></tr><tr><td><b>Pact of peace</b></td><td>a rolled chance; the two may not declare war on each other for ${C.diplomacy.envoy.pact.seconds / 60} minutes</td></tr><tr><td><b>Royal wedding</b></td><td>expensive but certain: the eldest of two houses wed</td></tr><tr><td><b>Send tribute</b></td><td>gold for goodwill</td></tr></table>
      <h3>When war is declared</h3>
      <p>Open the <b>war room</b>. While the war is only threatened you may try to <b>broker peace</b> – stubborn attackers are hard to talk down. Or pledge your war chest to one side: it fights ${Math.round(C.diplomacy.pledgePower * 100)} % harder, and if it wins you earn the gratitude of every victor and ${C.diplomacy.pledgeSpoils}× your gold back.</p>
      <p>And when the battle is decided, the sky holds its breath: the champions of both sides – the youngest, strongest dragons – meet in a duel of beams. The duel sways with the real power of both sides, and the decisive roll is shown to you, digit by digit.</p>
      ${tip('A pact between the two biggest rivals is the cheapest way to keep your favourite faction alive.')}` },
    { t: 'Portals', i: 'lock', body: () => `
      <p>Three portals stand open at the start. The others show only a locked arch.</p>
      ${fig(im(SP.portal([EL[8].color], 0, false, 3), '') + im(SP.portal([EL[8].color], 0, true, 3), ''), 'open · locked')}
      <p>A portal opens by itself once you are <b>Honored</b> with its faction or one of that faction's allies. Or you pay a small fortune (${fmt(G.portalPrice())} G right now, more for each extra portal).</p>
      <p>If a faction turns <b>Hostile</b>, its portal closes. An expensive <b>backdoor device</b> (${fmt(C.portals.backdoorPrice)} G) keeps it open – for ${C.portals.backdoorUpkeepPerMinute} G a minute, and the faction notices the smuggling: its opinion of you keeps sinking while the device runs.</p>
      <p>Alliances can even open <b>mixed zones</b> – a brood pool shared by two elements, perfect for balanced dragons.</p>` },
    { t: 'Keeper\'s Tips', i: 'scroll', body: () => `
      <p><b>1.</b> Start with a handful of Cheap eggs. Hatch them in the zone closest to their likely element – examine first if you can afford it.</p>
      <p><b>2.</b> Pair your first pupils as soon as they turn 300. More eggs now means more grown dragons in 17 minutes.</p>
      <p><b>3.</b> Every faction you raise a dragon for opens a new stream of scales. Spread your dragons out.</p>
      <p><b>4.</b> Two purebred parents of one element breed purebred forever – a gold mine, until the merchant gets sick of that element.</p>
      <p><b>5.</b> Watch the sky. A thick band of one colour in the bar at its bottom is a faction that will soon go to war.</p>
      <p><b>6.</b> Everything random is logged. If luck feels cruel, check the <b>Log</b>: the clutch statistics compare every roll with the exact expected odds.</p>
      <p class="mute"><small>Still open in the design (placeholders): brood time, the hatcheries of most zones, worldviews other than Fire, faction voices, music, alliance names, the breeding boost after 1000 years.</small></p>
      <div class="row"><span class="spacer"></span><button class="btn small danger" type="button" data-act="reset">Delete save</button></div>` },
  ];
  function helpModal(page) {
    ui.bookPage = page != null ? page : (ui.bookPage || 0);
    showModal({
      wide: true,
      rebuild() {
        const i = ui.bookPage; const ch = CHAPTERS[i];
        return `<h2>${icon('scroll', 3)} The Keeper's Handbook</h2><div class="book">
          <div class="toc">${CHAPTERS.map((c, k) => `<button class="btn small ${k === i ? 'on' : ''}" type="button" data-act="book" data-id="${k}">${icon(c.i)} ${c.t}</button>`).join('')}</div>
          <div class="page panel alt"><div class="chapno">CHAPTER ${i + 1} OF ${CHAPTERS.length}</div><h2 style="font-size:20px">${ch.t}</h2>${ch.body()}
            <div class="pager">${i > 0 ? `<button class="btn small ghost" type="button" data-act="book" data-id="${i - 1}">◀ ${CHAPTERS[i - 1].t}</button>` : '<span></span>'}${i < CHAPTERS.length - 1 ? `<button class="btn small" type="button" data-act="book" data-id="${i + 1}">${CHAPTERS[i + 1].t} ▶</button>` : ''}</div></div></div>`;
      },
      build(b) { b.innerHTML = this.rebuild(); },
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
    const war = S.war; const tension = war ? (war.phase === 'argument' ? 0.3 : war.phase === 'announce' ? war.t / C.war.announceSeconds : 1) : 0;
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
    // dragons in their faction colours – a proportional sample, government always shown
    const adults = [];
    for (let f = 0; f < NE; f++) G.adultsOf(f).forEach(d => adults.push(d));
    const shown = skySample(adults, 64);
    // war: the two sides fly into formation, everyone else fades into the background
    const B = battleState(war, t);
    const wa = war ? sideOf(war, 'a') : [], wd = war ? sideOf(war, 'd') : [];
    const side = d => (!war ? 0 : wa.includes(d.faction) ? 1 : wd.includes(d.faction) ? 2 : 0);
    const ranks = { 1: [], 2: [] };
    shown.filter(d => d.role).concat(shown.filter(d => !d.role)).forEach(d => { const sd = side(d); if (sd && ranks[sd].length < 20) ranks[sd].push(d.id); });
    const pull = !war || war.phase === 'argument' ? 0 : war.phase === 'announce' ? smooth(Math.min(1, war.t / (C.war.announceSeconds * 0.8))) : 1;
    const pos = {};
    const draw = [];
    shown.forEach(d => {
      const sd = d.seed;
      const vip = d.role === 'king' || d.role === 'gov';
      const speed = vip ? 3 : 4 + (sd % 100) / 12;
      let dir = sd % 2 ? 1 : -1;
      const span = w + 60;
      let x = ((time * speed + (sd % 997)) % span); if (dir < 0) x = span - x; x -= 30;
      let y = 1 + ((sd >>> 3) % Math.max(1, h - 28)) + Math.sin(time * 1.3 + sd) * 2;
      const s0 = side(d); const rk = s0 ? ranks[s0].indexOf(d.id) : -1;
      let dim = !!war && !s0;
      if (rk >= 0) {
        const COLS = w > 300 ? 4 : 3; const col = rk % COLS, row = Math.floor(rk / COLS);
        const fx = s0 === 1 ? w * 0.04 + col * 20 + (row % 2) * 8 : w * 0.96 - 25 - col * 20 - (row % 2) * 8;
        const top = 9, bottom = h - 20, rows = Math.ceil(ranks[s0].length / COLS);
        const gap = Math.min(14, Math.max(7, (bottom - top) / Math.max(1, rows)));
        const fy = top + ((bottom - top) - rows * gap) / 2 + row * gap + Math.sin(time * 2.2 + rk) * 1.5;
        x = x + (fx - x) * pull; y = y + (fy - y) * pull;
        if (pull > 0.5) dir = s0 === 1 ? 1 : -1;
      } else if (s0) dim = true;
      pos[d.id] = { x: x + 12, y: y + 6 };
      draw.push({ d, x, y, dir, dim, front: rk >= 0 });
    });
    draw.sort((a, b) => a.front - b.front);
    draw.forEach(o => {
      const d = o.d;
      const frame = Math.floor(time * (o.front && war && war.phase === 'fight' ? 6 : 3) + d.seed) % 2;
      const hit = B.flash[d.id] && B.flash[d.id] > t;
      const col = hit ? '#ffffff' : EL[d.faction].color;
      c.globalAlpha = o.dim ? 0.35 : 1;
      c.drawImage(SP.skyDragon(col, frame, o.dir < 0, d.role === 'king', d.mat, d.role === 'gov'), Math.round(o.x), Math.round(o.y));
    });
    c.globalAlpha = 1;
    if (war && war.phase === 'fight') drawBattle(c, B, ranks, pos, war, t);
    // hills
    c.fillStyle = tension > 0 ? '#16060c' : '#120a26';
    for (let x = 0; x < w; x++) { const hh = 6 + Math.round(Math.abs(Math.sin(x * 0.07) * 6 + Math.sin(x * 0.023 + 1) * 5)); c.fillRect(x, h - hh, 1, hh); }
    c.fillStyle = '#000';
    for (let x = 0; x < w; x++) { const hh = 6 + Math.round(Math.abs(Math.sin(x * 0.07) * 6 + Math.sin(x * 0.023 + 1) * 5)); c.fillRect(x, h - hh - 1, 1, 1); }
    // population share bar
    const total = adults.length || 1; let bx = 0;
    c.fillStyle = '#000'; c.fillRect(0, h - 4, w, 4);
    for (let f = 0; f < NE; f++) {
      const n = G.adultsOf(f).length; if (!n) continue;
      const bw = Math.max(1, Math.round(n / total * w));
      c.fillStyle = EL[f].color; c.fillRect(bx, h - 3, bw, 3);
      if (f === S.ruler) { c.fillStyle = '#ffd23f'; c.fillRect(bx, h - 4, bw, 1); }
      bx += bw; c.fillStyle = '#000'; c.fillRect(bx - 1, h - 3, 1, 3);
    }
    const info = $('#sky-info');
    const txt = `${adults.length} dragons in the sky${adults.length > shown.length ? ' (' + shown.length + ' shown to scale)' : ''}${S.king && S.dragons[S.king] ? ' · ♛ ' + S.dragons[S.king].name + ' + ' + S.gov.length + ' ministers (' + elName(S.ruler) + ')' : ''}`;
    if (info.textContent !== txt) info.textContent = txt;
    const tn = $('#tension');
    if (war && war.phase === 'argument') { tn.hidden = false; tn.querySelector('.tension-label').textContent = 'CHALLENGE TO THE THRONE: ' + elName(war.attacker).toUpperCase() + ' ' + war.arg.score[1] + ' – ' + war.arg.score[0] + ' KING'; tn.querySelector('i').style.width = (war.t / (C.war.argument.rounds * C.war.argument.roundSeconds) * 100) + '%'; }
    else if (war) { tn.hidden = false; tn.querySelector('.tension-label').textContent = war.phase === 'argument' ? 'CHALLENGE TO THE THRONE: ' + elName(war.attacker).toUpperCase() + ' vs THE KING' : (war.phase === 'announce' ? 'WAR THREAT: ' : 'WAR: ') + sideTxt(wa).toUpperCase() + ' vs ' + sideTxt(wd).toUpperCase(); tn.querySelector('i').style.width = (war.phase === 'argument' ? war.t / (C.war.argument.rounds * C.war.argument.roundSeconds) * 100 : war.phase === 'announce' ? tension * 100 : 100 - war.t / (war.fight || C.war.fightSeconds) * 100) + '%'; }
    else tn.hidden = true;
  }
  const smooth = x => x * x * (3 - 2 * x);
  // pixel battle: fire bolts, blasts and smoke (purely visual, drawn into the sky canvas)
  const battle = { key: '', bolts: [], blasts: [], smoke: [], flash: {}, next: 0 };
  function battleState(war, t) {
    const key = war ? war.attacker + '-' + war.defender : '';
    if (key !== battle.key) { battle.key = key; battle.bolts = []; battle.blasts = []; battle.smoke = []; battle.flash = {}; battle.next = t + 400; }
    return battle;
  }
  function drawBattle(c, B, ranks, pos, war, t) {
    const A = ranks[1].filter(id => pos[id]), D = ranks[2].filter(id => pos[id]);
    if (A.length && D.length && t >= B.next && B.bolts.length < 18) {
      const fromA = Math.random() < 0.5;
      const src = (fromA ? A : D)[Math.floor(Math.random() * (fromA ? A : D).length)];
      const dst = (fromA ? D : A)[Math.floor(Math.random() * (fromA ? D : A).length)];
      B.bolts.push({ src, dst, t0: t, dur: 550 + Math.random() * 350, col: EL[(S.dragons[src] || {}).faction != null ? S.dragons[src].faction : (fromA ? war.attacker : war.defender)].color, arc: (Math.random() - 0.5) * 14 });
      B.next = t + 70 + Math.random() * 170;
    }
    B.bolts = B.bolts.filter(b => {
      const p0 = pos[b.src], p1 = pos[b.dst]; if (!p0 || !p1) return false;
      const k = (t - b.t0) / b.dur;
      if (k >= 1) { B.blasts.push({ x: p1.x, y: p1.y, t0: t }); B.flash[b.dst] = t + 120; return false; }
      const bx = p0.x + (p1.x - p0.x) * k, by = p0.y + (p1.y - p0.y) * k - Math.sin(k * Math.PI) * b.arc;
      const dx = Math.sign(p1.x - p0.x) || 1;
      for (let i = 4; i >= 1; i--) { c.fillStyle = i >= 3 ? SP.shade(b.col, 0.5) : i === 2 ? SP.shade(b.col, 0.8) : b.col; c.fillRect(Math.round(bx - dx * (i * 3 + 1)), Math.round(by) - (i < 3 ? 1 : 0), 3, i < 3 ? 3 : 1); }
      c.fillStyle = SP.INK; c.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 5, 5);
      c.fillStyle = b.col; c.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
      c.fillStyle = '#ffffff'; c.fillRect(Math.round(bx), Math.round(by), 1, 1);
      return true;
    });
    const ring = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    B.blasts = B.blasts.filter(b => {
      const f = Math.floor((t - b.t0) / 70); if (f > 5) { B.smoke.push({ x: b.x, y: b.y, t0: t }); return false; }
      const cols = ['#ffffff', '#fff27a', '#ffd23f', '#ff9a2e', '#e04434', '#7a2a20'];
      const r = 2 + f * 1.5;
      c.fillStyle = cols[f];
      ring.forEach(o => c.fillRect(Math.round(b.x + o[0] * r) - 1, Math.round(b.y + o[1] * r) - 1, f < 3 ? 3 : 2, f < 3 ? 3 : 2));
      if (f < 3) { c.fillStyle = f ? '#fff27a' : '#ffffff'; c.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 5, 5); }
      return true;
    });
    B.smoke = B.smoke.filter(p => {
      const k = (t - p.t0) / 1400; if (k >= 1) return false;
      const y = p.y - k * 10; const gray = k < 0.5 ? '#6a5a70' : '#43384c';
      c.fillStyle = gray;
      [[0, 0], [2, -1], [-2, -1], [1, -3]].forEach((o, i) => { if ((i + Math.floor(k * 8)) % 3 !== 0) c.fillRect(Math.round(p.x + o[0] + k * 3), Math.round(y + o[1]), 2, 2); });
      return true;
    });
    Object.keys(B.flash).forEach(id => { if (B.flash[id] < t) delete B.flash[id]; });
  }

  // largest-remainder sample: each faction keeps its share of the sky; king & government always fly
  function skySample(adults, cap) {
    const by = Array.from({ length: NE }, () => []);
    adults.forEach(d => by[d.faction].push(d));
    const rank = d => (d.role === 'king' ? 0 : d.role === 'gov' ? 1 : 2);
    by.forEach(l => l.sort((a, b) => rank(a) - rank(b) || a.id - b.id));
    let out = [];
    if (adults.length <= cap) out = adults.slice();
    else {
      const q = by.map(l => l.length * cap / adults.length);
      const n = q.map(Math.floor); let left = cap - n.reduce((a, b) => a + b, 0);
      q.map((x, f) => [x - Math.floor(x), f]).sort((a, b) => b[0] - a[0]).forEach(([, f]) => { if (left > 0 && n[f] < by[f].length) { n[f]++; left--; } });
      by.forEach((l, f) => { const vip = l.filter(d => d.role).length; out = out.concat(l.slice(0, Math.max(n[f], vip))); });
    }
    return out.sort((a, b) => rank(b) - rank(a) || a.id - b.id); // VIPs drawn last = in front
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
  $('#btn-story').innerHTML = icon('book', 2);
  boot();
  render(true); updateTop();
  $('#herald-log').innerHTML = icon('scroll', 2);
  if (ui.first) showModal({ html: `<h2>Welcome to Dragonle!</h2><div class="reveal">${hero(im(SP.egg({ shell: '#F2CF5B', spots: '#B8902A', seed: 5, crack: 1 }, 7), ''))}</div><p>A dragon world of twelve elements. It's all about <b>eggs and young dragons</b> – the grown-ups only show up as shapes in the sky, wearing their faction's colours.</p><p>Buy an egg at the <b>Market</b>, hatch it in a <b>zone</b> and raise the dragon at the <b>School</b>.</p><div class="row" style="justify-content:center"><button class="btn" type="button" data-act="nav" data-id="market">${icon('market')} To the Market</button><button class="btn ghost" type="button" data-act="help">How to play</button></div>` });
  requestAnimationFrame(frame);
  window.DragonleUI = { ui, render };
})();
