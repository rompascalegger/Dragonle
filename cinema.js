/*
 * Dragonle – war cutscenes in the style of an anime showdown, drawn in pixels.
 * Focus lines, champion face-off, VS slam, beam struggle, the decisive roll, victory.
 * Everything is skippable; the real outcome comes from core.js (the roll is shown as it was).
 */
(function (root) {
  'use strict';
  const G = root.Dragonle, SP = root.Sprites, EL = G.EL;
  const PX = 4; // one canvas pixel = 4 screen pixels
  const SKY = { fire: 'BURNING', water: 'DROWNED', light: 'BLINDING', dark: 'STARLESS', lightning: 'THUNDERING', sand: 'SHIFTING', wind: 'HOWLING', stone: 'SHATTERED', ice: 'FROZEN', magma: 'MOLTEN', nature: 'WILD', poison: 'POISONED' };
  const shade = SP.shade;

  let el = null, cv = null, ctx = null, raf = 0, skip = false, scene = null;
  function wait(ms) { return new Promise(res => { if (skip) return res(); const t0 = performance.now(); const id = setInterval(() => { if (skip || performance.now() - t0 >= ms) { clearInterval(id); res(); } }, 16); }); }
  function build() {
    el = document.createElement('div'); el.className = 'cine'; el.innerHTML = `
      <canvas class="cine-bg"></canvas>
      <div class="cine-bar top"></div><div class="cine-bar bottom"></div>
      <div class="cine-title"></div>
      <div class="cine-power"><i class="pa"></i><i class="pd"></i><span class="la"></span><span class="ld"></span></div>
      <div class="cine-champ left"><img alt=""><div class="plate"></div></div>
      <div class="cine-champ right"><img alt=""><div class="plate"></div></div>
      <div class="cine-say left"></div><div class="cine-say right"></div>
      <div class="cine-vs">VS</div>
      <div class="cine-roll"></div>
      <div class="cine-banner"></div>
      <div class="cine-skip">click to skip ▶▶</div>`;
    document.body.appendChild(el);
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d');
    el.addEventListener('click', () => { skip = true; });
  }
  function size() {
    const w = Math.ceil(innerWidth / PX), h = Math.ceil(innerHeight / PX);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  const q = s => el.querySelector(s);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------ canvas effects
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
  function line(x0, y0, x1, y1, c, t) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); ctx.fillStyle = c;
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), t || 1, t || 1);
  }
  function focusLines(cx, cy, cols, n, inner) {
    const W = cv.width, H = cv.height, R = Math.hypot(W, H);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r0 = R * rnd(inner || 0.35, 0.75);
      line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * R, cy + Math.sin(a) * R, cols[i % cols.length], Math.random() < 0.3 ? 2 : 1);
    }
  }
  function speedLines(x0, x1, cols, n, dir) {
    const H = cv.height;
    for (let i = 0; i < n; i++) {
      const y = Math.floor(Math.random() * H), len = rnd(8, 40), x = x0 + Math.random() * (x1 - x0);
      px(dir > 0 ? x : x - len, y, len, Math.random() < 0.2 ? 2 : 1, cols[i % cols.length]);
    }
  }
  function beam(x0, x1, y, col, dir, t) {
    const h = 9 + Math.round(Math.sin(t * 0.03) * 2);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      const wob = Math.round(Math.sin(x * 0.4 + t * 0.05 * dir) * 1.5);
      px(x, y - h + wob, 1, h * 2, shade(col, 0.55));
      px(x, y - h + 2 + wob, 1, h * 2 - 4, col);
      px(x, y - 3 + wob, 1, 6, shade(col, 1.6));
      px(x, y - 1 + wob, 1, 2, '#ffffff');
    }
  }
  function sparks(cx, cy, cols, n, r) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * r; px(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.random() < 0.3 ? 2 : 1, Math.random() < 0.3 ? 2 : 1, cols[i % cols.length]); }
    for (let rr = 6; rr > 0; rr--) { const c = rr > 4 ? cols[0] : rr > 2 ? '#fff6b0' : '#ffffff'; for (let a = 0; a < 24; a++) { const ang = a / 24 * Math.PI * 2; px(cx + Math.cos(ang) * rr * rnd(0.8, 1.3), cy + Math.sin(ang) * rr * rnd(0.8, 1.3), 1, 1, c); } }
  }
  function loop(t) {
    if (!el) return;
    size();
    const W = cv.width, H = cv.height, sc = scene;
    ctx.fillStyle = sc.bg || '#0b0716'; ctx.fillRect(0, 0, W, H);
    if (sc.invert) { ctx.fillStyle = sc.invert; ctx.fillRect(0, 0, W, H); }
    else {
      if (sc.mode === 'focus') focusLines(W / 2, H / 2, sc.cols, 90);
      if (sc.mode === 'split') {
        ctx.fillStyle = shade(sc.ca, 0.25); ctx.fillRect(0, 0, W / 2, H);
        ctx.fillStyle = shade(sc.cd, 0.25); ctx.fillRect(W / 2, 0, W / 2, H);
        speedLines(0, W / 2, [sc.ca, shade(sc.ca, 1.5), '#ffffff'], sc.leftOn ? 70 : 0, 1);
        speedLines(W / 2, W, [sc.cd, shade(sc.cd, 1.5), '#ffffff'], sc.rightOn ? 70 : 0, -1);
        for (let y = 0; y < H; y += 2) px(W / 2 + Math.round(Math.sin(y * 0.3 + t * 0.01) * 2), y, 2, 2, '#ffffff');
      }
      if (sc.mode === 'clash') {
        ctx.fillStyle = shade(sc.ca, 0.18); ctx.fillRect(0, 0, W * sc.cx, H);
        ctx.fillStyle = shade(sc.cd, 0.18); ctx.fillRect(W * sc.cx, 0, W, H);
        focusLines((sc.xl || W * 0.2) + ((sc.xr || W * 0.8) - (sc.xl || W * 0.2)) * sc.cx, sc.by || H * 0.48, [shade(sc.ca, 1.3), shade(sc.cd, 1.3), '#ffffff'], 50, 0.25);
        const xl = sc.xl || Math.round(W * 0.2), xr = sc.xr || Math.round(W * 0.8);
        const y = sc.by || Math.round(H * 0.48), mx = Math.round(xl + (xr - xl) * sc.cx);
        beam(xl, mx, y, sc.ca, 1, t);
        beam(mx, xr, y, sc.cd, -1, t);
        sparks(mx, y, [sc.cx < 0.5 ? sc.cd : sc.ca, '#fff6b0', '#ffffff'], 60, 22);
      }
      if (sc.mode === 'victory') {
        ctx.fillStyle = shade(sc.cw, 0.3); ctx.fillRect(0, 0, W, H);
        focusLines(sc.side < 0 ? W * 0.25 : W * 0.75, H * 0.5, [sc.cw, shade(sc.cw, 1.6), '#ffffff', '#ffd23f'], 120, 0.2);
      }
    }
    if (sc.shake) { el.style.transform = `translate(${Math.round(rnd(-1, 1)) * PX * 2}px, ${Math.round(rnd(-1, 1)) * PX * 2}px)`; } else el.style.transform = '';
    raf = requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ text helpers
  async function type(node, text, cps) {
    node.textContent = ''; node.classList.add('on');
    if (skip) { node.textContent = text; return; }
    for (let i = 1; i <= text.length; i++) { if (skip) { node.textContent = text; return; } node.textContent = text.slice(0, i); await wait(1000 / (cps || 45)); }
  }
  function champSprite(c, f, flip) {
    const d = c || { id: 'cine' + f, v: (() => { const v = new Array(G.NE).fill(0); v[f] = 20; return v; })(), mat: 0, seed: f * 77 + 5, deep: false };
    return SP.dragon({ id: 'cine' + d.id, v: d.v, mat: d.mat, seed: d.seed, deep: d.deep }, 8, flip);
  }

  // ------------------------------------------------------------ the war climax
  async function war(w, opt) {
    opt = opt || {};
    const snd = opt.snd || { tone() {}, drum() {}, epic() {}, bad() {} };
    const T = opt.mode === 'short' ? 0.4 : 1;
    if (el) finish();
    skip = false; build();
    const A = w.attacker, D = w.defender;
    const ca = EL[A].color, cd = EL[D].color;
    const sideName = side => side.map(f => EL[f].name.toUpperCase()).join(' + ');
    const sa = w.sa || [A], sd = w.sd || [D];
    scene = { mode: 'focus', cols: [ca, cd, '#ffffff', '#ffd23f'], ca, cd, cx: 0.5 };
    raf = requestAnimationFrame(loop);
    el.classList.add('on');
    // 1 – title card
    snd.drum();
    q('.cine-title').innerHTML = `<small>THE BATTLE OF THE</small><b>${SKY[EL[D].id]} SKIES</b><em>${sideName(sa)} <i>vs</i> ${sideName(sd)}</em>`;
    q('.cine-title').classList.add('on');
    await wait(1900 * T);
    q('.cine-title').classList.remove('on');
    // 2 – the champions step forward
    scene = Object.assign(scene, { mode: 'split', leftOn: true, rightOn: false });
    const L = q('.cine-champ.left'), Rr = q('.cine-champ.right');
    const ia = champSprite(w.ca, A, false), id = champSprite(w.cd, D, true);
    L.querySelector('img').src = ia.src; L.querySelector('img').width = ia.w; L.querySelector('img').height = ia.h;
    Rr.querySelector('img').src = id.src; Rr.querySelector('img').width = id.w; Rr.querySelector('img').height = id.h;
    L.querySelector('.plate').innerHTML = `<small>CHAMPION OF ${EL[A].name.toUpperCase()}</small><b>${w.ca ? w.ca.name : '???'}</b><span>power ${w.pa.toFixed(1)}</span>`;
    Rr.querySelector('.plate').innerHTML = `<small>CHAMPION OF ${EL[D].name.toUpperCase()}</small><b>${w.cd ? w.cd.name : '???'}</b><span>power ${w.pd.toFixed(1)}</span>`;
    L.style.setProperty('--c', ca); Rr.style.setProperty('--c', cd);
    const ink = (node, c) => { const n = parseInt(c.slice(1), 16); const lum = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; if (lum > 165) { node.style.color = '#1b1024'; node.style.textShadow = 'none'; } };
    ink(L.querySelector('.plate'), ca); ink(Rr.querySelector('.plate'), cd);
    L.classList.add('on'); snd.tone(220, 0.25, 'sawtooth', 0.06);
    await type(q('.cine-say.left'), (root.Court ? root.Court.cry(A) : 'FOR ' + EL[A].name.toUpperCase() + '!'), 40 / T);
    await wait(700 * T);
    scene.rightOn = true; Rr.classList.add('on'); snd.tone(196, 0.25, 'sawtooth', 0.06);
    await type(q('.cine-say.right'), (root.Court ? root.Court.cry(D) : 'FOR ' + EL[D].name.toUpperCase() + '!'), 40 / T);
    await wait(700 * T);
    // 3 – VS slam
    q('.cine-say.left').classList.remove('on'); q('.cine-say.right').classList.remove('on');
    scene.invert = opt.flash === false ? '#3a0a10' : '#ffffff'; scene.shake = true; snd.drum();
    q('.cine-vs').classList.add('on');
    await wait(90); scene.invert = '#000000'; await wait(90); scene.invert = null;
    await wait(650 * T); scene.shake = false;
    q('.cine-vs').classList.remove('on');
    // 4 – beam struggle (sways with the real power ratio)
    // beams leave the champions' mouths
    const rl = L.querySelector('img').getBoundingClientRect(), rr = Rr.querySelector('img').getBoundingClientRect();
    scene.xl = Math.round((rl.left + rl.width * 0.9) / PX); scene.xr = Math.round((rr.left + rr.width * 0.1) / PX);
    scene.by = Math.round((rl.top + rl.height * 0.42) / PX);
    scene.mode = 'clash'; L.classList.add('fire'); Rr.classList.add('fire');
    const pw = q('.cine-power'); pw.style.setProperty('--ca', ca); pw.style.setProperty('--cd', cd); pw.classList.add('on');
    pw.querySelector('.la').textContent = sideName(sa) + ' ' + w.pa.toFixed(1); pw.querySelector('.ld').textContent = w.pd.toFixed(1) + ' ' + sideName(sd);
    const share = w.pa / Math.max(0.001, w.pa + w.pd);
    const t0 = performance.now(), dur = 3400 * T;
    snd.tone(110, 3.2 * T, 'sawtooth', 0.04);
    while (!skip && performance.now() - t0 < dur) {
      const k = (performance.now() - t0) / dur;
      // the attackers push the clash point right, the defenders left; anime swings at 1/3 and 2/3
      const swing = Math.sin(k * Math.PI * 5) * 0.12 * (1 - k * 0.6);
      scene.cx = 0.5 + (share - 0.5) * 0.5 + swing;
      scene.shake = Math.abs(swing) > 0.09;
      pw.querySelector('.pa').style.width = (scene.cx * 100) + '%';
      pw.querySelector('.pd').style.width = ((1 - scene.cx) * 100) + '%';
      if (Math.abs(swing) > 0.11 && Math.random() < 0.08) snd.tone(rnd(300, 600), 0.06, 'square', 0.03);
      await wait(33);
    }
    scene.shake = false;
    // 5 – the decisive roll, shown openly
    const roll = q('.cine-roll'); roll.classList.add('on');
    for (let i = 0; i < 14 && !skip; i++) { roll.innerHTML = `<small>THE SKY DECIDES</small><b>${Math.random().toFixed(3)}</b>`; snd.tone(1200, 0.02, 'square', 0.02); await wait((40 + i * 12) * T); }
    roll.innerHTML = `<small>ROLL &lt; ${w.chance.toFixed(3)} = ${sideName(sa)} WIN</small><b>${w.roll.toFixed(3)}</b><em>${w.attackerWins ? '&lt;' : '≥'} ${w.chance.toFixed(3)}</em>`;
    await wait(1300 * T);
    roll.classList.remove('on');
    // 6 – overwhelm
    const aw = w.attackerWins;
    const tgt = aw ? 0.97 : 0.03; const from = scene.cx;
    for (let i = 1; i <= 12 && !skip; i++) { scene.cx = from + (tgt - from) * i / 12; pw.querySelector('.pa').style.width = (scene.cx * 100) + '%'; pw.querySelector('.pd').style.width = ((1 - scene.cx) * 100) + '%'; await wait(40 * T); }
    scene.invert = opt.flash === false ? '#3a0a10' : '#ffffff'; scene.shake = true; snd.epic();
    await wait(120); scene.invert = null;
    (aw ? Rr : L).classList.add('down');
    pw.classList.remove('on'); L.classList.remove('fire'); Rr.classList.remove('fire');
    await wait(350 * T); scene.shake = false;
    // 7 – victory
    const wf = aw ? A : D;
    scene = Object.assign(scene, { mode: 'victory', cw: EL[wf].color, side: aw ? -1 : 1 });
    const ban = q('.cine-banner'); ban.style.setProperty('--c', EL[wf].color);
    const champ = aw ? w.ca : w.cd, lost = aw ? w.cd : w.ca;
    ban.innerHTML = `<b>VICTORY!</b><span>${sideName(w.wside || [wf])}</span>${lost && lost.fallen ? `<small>${lost.name} has fallen.</small>` : ''}${w.newRuler ? `<em>${EL[wf].name.toUpperCase()} NOW RULES THE SKY</em>` : ''}`;
    ban.classList.add('on');
    await type(q(aw ? '.cine-say.left' : '.cine-say.right'), root.Court ? root.Court.victoryLine(wf) : 'VICTORY!', 40 / T);
    await wait(1900 * T);
    if (champ) { /* the winning champion stands */ }
    finish();
    if (opt.done) opt.done();
  }
  function finish() {
    cancelAnimationFrame(raf); raf = 0;
    if (el) { el.remove(); el = null; }
  }
  root.Cinema = { war, active: () => !!el };
})(window);
