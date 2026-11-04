/*
 * Dragonle – retro pixel art. Everything is drawn at runtime onto canvases.
 * A dragon's scales are pure colours in the ratio of its element vector (dithering).
 */
(function (root) {
  'use strict';
  const G = root.Dragonle;
  const INK = '#1b1024';

  // ------------------------------------------------------------ helpers
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbHex(c) { return '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
  function shade(h, f) { const c = hexRgb(h); return rgbHex(f >= 1 ? c.map(x => x + (255 - x) * (f - 1)) : c.map(x => x * f)); }
  function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((x, i) => x + (B[i] - x) * t)); }

  // A grid of colours (null = transparent) -> canvas, optionally auto-outlined in ink.
  function grid(w, h) { return { w, h, c: Array.from({ length: h }, () => new Array(w).fill(null)) }; }
  function set(g, x, y, col) { if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.c[y][x] = col; }
  function get(g, x, y) { return (x >= 0 && y >= 0 && x < g.w && y < g.h) ? g.c[y][x] : null; }
  function outline(g, col) {
    const add = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.c[y][x]) continue;
      if (get(g, x - 1, y) || get(g, x + 1, y) || get(g, x, y - 1) || get(g, x, y + 1)) add.push([x, y]);
    }
    add.forEach(p => { g.c[p[1]][p[0]] = col || INK; });
    return g;
  }
  function fromRows(rows, pal) {
    const g = grid(Math.max(...rows.map(r => r.length)), rows.length);
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const p = pal[r[x]]; if (p) set(g, x, y, typeof p === 'function' ? p(x, y) : p); } });
    return g;
  }
  function toCanvas(g, scale) {
    const cv = document.createElement('canvas'); cv.width = g.w * scale; cv.height = g.h * scale;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.c[y][x]; if (c) { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); } }
    return cv;
  }
  const cache = new Map();
  function cached(key, make) {
    let v = cache.get(key); if (v) return v;
    v = make(); if (cache.size > 2000) cache.clear(); cache.set(key, v); return v;
  }
  const url = (key, make, scale) => cached(key, () => { const g = make(); return { src: toCanvas(g, scale).toDataURL(), w: g.w * scale, h: g.h * scale }; });

  // ------------------------------------------------------------ dragon (retro side view)
  // o outline (dark shade) · S scale · s scale shade · W wing membrane · w wing bone
  // B belly · b belly shade · E eye · H horn · h horn shade · T claw/teeth · N nostril · m mouth
  // Four body types, picked per dragon from its seed.
  const BODIES = [
    { name: 'Long-neck drake', rows: [
      '..............................',
      '......................oo......',
      '.....................oHo..oo..',
      '..........oo........oHo..oHo..',
      '.........oWWo......oSSoooHo...',
      '........oWwWWo....oSSSSSSSo...',
      '.......oWwwwWWo..oSSSSSESSSo..',
      '......oWwwwwwWWooSSSSSSSSSSo..',
      '.....oWwwwwwwwWoSSSSoooSSSSSo.',
      '....oWwwwwwwwwWoSSSo...ossssNo',
      '...oWwwwwwwwwWoSSSo.....oTTo..',
      '...oWWWWWWWWWoSSSSo...........',
      '....oooooooooSSSSSo...........',
      '..........ooSSSSSSSoo.........',
      '....oo...oSSSBBBSSSSSo........',
      '...oSSo.oSSSBBBBBSSSSo........',
      '...oSsooSSSBBBBBBSSSSo........',
      '....oSSSSSSBBBBBSSSSso........',
      '.....ossSSSSBBBSSSssso........',
      '......oooSSooooSSoooo.........',
      '........oSTo..oSTo............',
      '.........oo....oo.............',
    ] },
    { name: 'Bat-wing dragon', rows: [
      '................................',
      '..o.....................oo......',
      '..oo...................oHo..oo..',
      '..owo.................oHo..oHo..',
      '..oWwo...............oSSoooHo...',
      '..oWWwoo............oSSSSSSSo...',
      '..oWWWwwoo.........oSSSSSESSSo..',
      '..oWwWWWwwoo.......oSSSSSSSSSSo.',
      '..oWwWWwWWwwo.....oSSSoSSSSSSSNo',
      '..oWwWWwWWWWwo...oSSSo.oommmmoo.',
      '...oWwWWwWWWWwo.oSSSo..oTTo.....',
      '...oWoWWoWWWWWwoSSSo............',
      '....o.oo.ooWWWwSSSo.............',
      '..........oSSwSSSo..............',
      '.........oSSSSSSSSo.............',
      '...ooo..oSSSSBBBSSSo............',
      '..oSSso.oSSSBBBBBSSSo...........',
      '..oSo.ooSSSSBBBBBSSso...........',
      '...oSSSSSSSSSBBBSSsso...........',
      '....oosSSSSSSSSSsssoo...........',
      '......oossooooossooo............',
      '.......oTTo...oTTo..............',
    ] },
    { name: 'Wyrm', rows: [
      '................................',
      '........................oo.oo...',
      '.......................oHooHo...',
      '......................oSSSSSo...',
      '.....................oSSSESSSo..',
      '.....................oSSSSSSSNo.',
      '..........oooo......oSSSoommmo..',
      '........ooSSSSoo...oSSSo.oTTo...',
      '.......oSSSSSSSSo.oSSSo.........',
      '......oSSSBBBBSSSoSSSSo.........',
      '.....oSSSBooooBSSSSSSo..........',
      '....oSSSBo....oBBSSSo...........',
      '...oSSSBo......ooooo............',
      '..oSSSBo........................',
      '..oSSBBo...........ooo..........',
      '...oSSSBoooo....ooSSSSo.........',
      '....oSSSSSSSooooSSSSBBo.........',
      '.....ooSSSSSSSSSSSBBBo..........',
      '.......ooooSSSSSSBBoo...........',
      '...........ooooooo..............',
    ] },
    { name: 'Wyvern', rows: [
      '................................',
      '......o.........o...............',
      '.....owo.......owo......oo.oo...',
      '....oWwo......oWwo.....oHooHo...',
      '...oWWwo.....oWWwo....oSSSSSSo..',
      '..oWWWwo....oWWWwo...oSSSSESSSo.',
      '..oWWwWo...oWWwWWo...oSSSSSSSSNo',
      '.oWWwWWo..oWWwWWWo..oSSSoommmmo.',
      '.oWwWWWwooWwWWWWwo.oSSSo.oTTo...',
      '..ooWWWWwwWWWWWwwooSSSo.........',
      '....oooWWWWWWwwoSSSSSo..........',
      '.......ooooooSSSSSSSo...........',
      '..........oSSSSBBBSSSo..........',
      '...ooo...oSSSSBBBBBSSo..........',
      '..oSSso.oSSSSBBBBBSSSo..........',
      '..oSo.ooSSSSSSBBBSSSso..........',
      '...oSSSSSSSSSSSSSSssso..........',
      '....ooossSSSSSSsssooo...........',
      '.......oossoooossoo.............',
      '........oTTo..oTTo..............',
    ] },
  ];
  BODIES.forEach(bd => { bd.w = Math.max(...bd.rows.map(r => r.length)); });
  function bodyOf(d) { const n = typeof d.seed === 'number' ? d.seed : 0; return BODIES[((n >>> 4) % BODIES.length + BODIES.length) % BODIES.length]; }
  function variantName(d) { return bodyOf(d).name; }
  function scaleColours(d, count) {
    const EL = G.EL; const v = d.v; const r = rng(d.seed);
    if (d.mat) {
      const m = G.C.material.tiers[d.mat - 1].color;
      return Array.from({ length: count }, () => { const q = r(); return q < 0.07 ? '#FFFFFF' : q < 0.55 ? m : shade(m, q < 0.8 ? 0.8 : 1.2); });
    }
    const cols = []; let left = count;
    const els = G.present(v).sort((a, b) => v[b] - v[a]);
    els.forEach((e, i) => { const n = i === els.length - 1 ? left : Math.round(count * v[e] / G.STEPS); for (let k = 0; k < n && left > 0; k++, left--) cols.push(EL[e].color); });
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = cols[i]; cols[i] = cols[j]; cols[j] = t; }
    const frac = G.isPure(v) ? EL[els[0]].deep : G.mixColor(v);
    for (let i = 0; i < cols.length; i++) if (r() < 0.05) cols[i] = frac; // rare fractal scales in the mixed colour
    if (d.deep) for (let i = 0; i < cols.length; i++) cols[i] = shade(cols[i], 0.6);
    return cols;
  }
  function dragonGrid(d, flip) {
    const cells = [];
    const body = bodyOf(d); const ROWS = body.rows; const DW = body.w;
    ROWS.forEach((row, y) => { for (let x = 0; x < row.length; x++) if ('SsWw'.includes(row[x])) cells.push([x, y, row[x]]); });
    const cols = scaleColours(d, cells.length);
    const base = d.mat ? G.C.material.tiers[d.mat - 1].color : G.mixColor(d.v);
    const lum = hexRgb(base).reduce((a, b) => a + b, 0) / 3;
    const line = lum < 60 ? '#06040a' : shade(base, 0.3);
    const belly = mix(base, '#f4e6c0', 0.55);
    const g = grid(DW, 22);
    const yOff = 22 - ROWS.length;
    const X = x => (flip ? DW - 1 - x : x);
    ROWS.forEach((row, y0) => {
      const y = y0 + yOff;
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]; let c = null;
        if (ch === 'o' || ch === 'm') c = line;
        else if (ch === 'B') c = belly;
        else if (ch === 'b') c = shade(belly, 0.82);
        else if (ch === 'E') c = '#FFE066';
        else if (ch === 'H') c = '#E8DCC0';
        else if (ch === 'h') c = '#A8946E';
        else if (ch === 'T') c = '#F4F0E6';
        else if (ch === 'N') c = line;
        if (c) set(g, X(x), y, c);
      }
    });
    cells.forEach((p, i) => {
      let c = cols[i];
      if (p[2] === 's') c = shade(c, 0.7);
      else if (p[2] === 'W') c = mix(shade(c, 0.9), '#f4e6c0', 0.25);
      else if (p[2] === 'w') c = shade(c, 0.6);
      set(g, X(p[0]), p[1] + yOff, c);
    });
    return g;
  }
  function dragon(d, scale, flip) {
    scale = scale || 3;
    return url('d|' + d.id + '|' + d.v.join('') + '|' + d.mat + '|' + (d.deep ? 1 : 0) + '|' + scale + '|' + (flip ? 1 : 0), () => dragonGrid(d, flip), scale);
  }

  // ------------------------------------------------------------ egg (procedural)
  function eggGrid(o) {
    const w = 14, h = 17; const g = grid(w, h); const r = rng(o.seed || 1);
    const shell = o.shell || '#E6DCC0', spots = o.spots || shade(shell, 0.7);
    const cx = 6.5, cy = 9.2;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const ry = 7.6, t = (y - 1) / (h - 2);
      const rx = 4.2 + 1.6 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62);
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        let c = shell;
        if (dx > 0.35 || dy > 0.55) c = shade(shell, 0.8);
        if (dx < -0.3 && dy < -0.1) c = shade(shell, 1.25);
        set(g, x, y, c);
      }
    }
    // spots
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const x = 3 + Math.floor(r() * 8), y = 4 + Math.floor(r() * 10);
      if (get(g, x, y) && get(g, x + 1, y)) { set(g, x, y, spots); if (r() < 0.5) set(g, x + 1, y, spots); if (r() < 0.4 && get(g, x, y + 1)) set(g, x, y + 1, spots); }
    }
    if (!o.plain) { set(g, 4, 4, '#FFFFFF'); set(g, 4, 5, '#FFFFFF'); set(g, 5, 4, '#FFFFFF'); set(g, 3, 7, shade(shell, 1.5)); }
    if (o.glow) { set(g, 7, 9, o.glow); set(g, 8, 10, o.glow); set(g, 6, 11, o.glow); }
    outline(g, o.line || INK);
    // cracks (zig-zag from the top)
    const crack = o.crack || 0;
    const path = [[7, 2], [6, 3], [7, 4], [8, 5], [7, 6], [6, 7], [5, 8], [6, 9], [7, 10], [8, 11], [9, 12], [8, 13]];
    const branch = [[9, 6], [10, 7], [4, 9], [3, 10], [10, 12]];
    const len = [0, 4, 8, 12][crack] || 0;
    for (let i = 0; i < len; i++) set(g, path[i][0], path[i][1], INK);
    if (crack >= 3) branch.forEach(p => set(g, p[0], p[1], INK));
    return g;
  }
  function egg(o, scale) {
    scale = scale || 3;
    return url('e|' + [o.shell, o.spots, o.crack || 0, o.seed || 0, o.glow || '', o.plain ? 1 : 0, o.line || '', scale].join('|'), () => eggGrid(o), scale);
  }

  // ------------------------------------------------------------ scale (leaf shield)
  const SCALE = ['..SSS..', '.SSlSS.', 'SSlSSSS', 'SSlSSSs', 'SSSSSss', '.SSSss.', '.SSss..', '..Ss...', '...s...'];
  function scaleGrid(color, q, fractal, mat) {
    const g = fromRows(SCALE, {
      S: (x, y) => (fractal && (x + y) % 2 ? shade(color, 1.3) : color),
      s: () => shade(color, 0.72),
      l: () => (mat ? '#FFFFFF' : shade(color, 1.45)),
    });
    outline(g, q === 'common' ? INK : G.C.scales.quality[q].color);
    if (q !== 'common') outline(g, INK);
    return g;
  }
  function scaleSprite(color, q, fractal, mat, scale) {
    scale = scale || 3;
    return url('s|' + [color, q, fractal ? 1 : 0, mat, scale].join('|'), () => scaleGrid(color, q, fractal, mat), scale);
  }
  function scaleColor(s) {
    if (s.mat) return G.C.material.tiers[s.mat - 1].color;
    if (s.fractal) return G.isPure(s.v) ? G.EL[G.dominant(s.v)].deep : G.mixColor(s.v);
    return G.EL[s.el].color;
  }

  // ------------------------------------------------------------ portal (stone arch + swirl)
  function portalGrid(cols, frame, locked) {
    const w = 26, h = 30; const g = grid(w, h); const cx = 12.5;
    const inArch = (x, y, R, top) => { if (y >= top + R) return Math.abs(x - cx) <= R; const dy = top + R - y; return (x - cx) * (x - cx) + dy * dy <= R * R; };
    const r = rng(7);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inArch(x, y, 11.5, 1) || y > h - 2) continue;
      if (inArch(x, y, 7.5, 6)) {
        if (locked) { set(g, x, y, (x + y) % 2 ? '#2a2140' : '#1f1832'); continue; }
        const dx = x - cx, dy = y - 16; const a = Math.atan2(dy, dx), rad = Math.sqrt(dx * dx + dy * dy);
        const k = Math.sin(a * 2 + rad * 0.9 - frame * 2.1);
        const base = cols[(Math.floor((a + Math.PI) / Math.PI * cols.length)) % cols.length];
        set(g, x, y, rad < 1.5 ? '#FFFFFF' : k > 0.55 ? shade(base, 1.45) : k < -0.45 ? shade(base, 0.6) : base);
      } else {
        const brick = ((Math.floor(y / 3) % 2 ? x + 2 : x) % 5 === 0) || y % 3 === 0;
        set(g, x, y, brick ? '#6d6386' : (r() < 0.2 ? '#a79fc0' : '#8d84a8'));
      }
    }
    for (let x = 0; x < w; x++) { set(g, x, h - 1, '#4a4060'); }
    if (locked) {
      // padlock
      const L = ['.ooo.', 'o...o', 'o...o', 'ooooo', 'oyyyo', 'oykyo', 'oyyyo', 'ooooo'];
      L.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; set(g, 10 + x, 14 + y, ch === 'o' ? INK : ch === 'y' ? '#FFD23F' : INK); } });
    }
    outline(g);
    return g;
  }
  function portal(cols, frame, locked, scale) {
    scale = scale || 4;
    return url('p|' + cols.join(',') + '|' + frame + '|' + (locked ? 1 : 0) + '|' + scale, () => portalGrid(cols, frame, locked), scale);
  }

  // ------------------------------------------------------------ hatcheries
  function hatcheryGrid(style, cols, frame) {
    const w = 34, h = 16; const g = grid(w, h); const r = rng(11 + frame);
    const cx = 16.5;
    const inBowl = (x, y, rx, ry, top) => { const dx = (x - cx) / rx, dy = (y - top) / ry; return y >= top && dx * dx + dy * dy <= 1; };
    if (style === 'oven') {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x - cx) / 15, dy = (y - 15) / 15;
        if (dx * dx + dy * dy > 1) continue;
        const brick = (y % 3 === 0) || ((Math.floor(y / 3) % 2 ? x + 3 : x) % 6 === 0);
        let c = brick ? '#6b2a1a' : '#b5482a';
        const mx = (x - cx) / 6, my = (y - 15) / 7;
        if (mx * mx + my * my <= 1) { const q = r(); c = my > -0.35 && q < 0.5 ? '#FFD23F' : q < 0.75 ? '#FF8C1A' : '#E8341C'; if (my < -0.75) c = '#2a0d06'; }
        set(g, x, y, c);
      }
    } else {
      for (let y = 4; y < h; y++) for (let x = 0; x < w; x++) {
        if (!inBowl(x, y, 16, 11, 4)) continue;
        let c;
        if (style === 'lava') {
          const rim = !inBowl(x, y, 13, 8, 4) || y < 6;
          const q = r();
          c = rim ? (q < 0.3 ? '#4a4256' : q < 0.6 ? '#6a6078' : '#5a5168') : (q < 0.15 ? '#FFF27A' : q < 0.55 ? '#FFB01A' : q < 0.85 ? '#FF7A10' : '#E8341C');
        } else if (style === 'mix') {
          c = x < cx ? cols[0] : cols[1 % cols.length];
          if (y < 6) c = shade(c, 1.3);
          if (!inBowl(x, y, 14, 9, 4)) c = '#7a5530';
        } else {
          const twig = (x * 3 + y * 5 + frame) % 7 < 3;
          c = twig ? '#8a6438' : '#6b4a2a';
          if (y < 7 && inBowl(x, y, 12, 7, 4)) c = (x + y) % 3 ? shade(cols[0], 0.85) : shade(cols[0], 1.2);
          if (y === 4 || y === 5) c = (x % 3 === 0) ? '#a8824e' : c;
        }
        set(g, x, y, c);
      }
    }
    outline(g);
    return g;
  }
  function hatchery(style, cols, frame, scale) {
    scale = scale || 4;
    return url('h|' + style + '|' + cols.join(',') + '|' + frame + '|' + scale, () => hatcheryGrid(style, cols, frame), scale);
  }


  // ------------------------------------------------------------ clutch nest (big twig bowl, dithered glow)
  function nestGrid(glow, dim) {
    const w = 76, h = 34; const g = grid(w, h); const r = rng(42);
    const cx = 37.5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ox = (x - cx) / 37, oy = (y - 15) / 18;
      if (ox * ox + oy * oy > 1 || y < 2) continue;
      const ix = (x - cx) / 31, iy = (y - 12) / 10;
      const inside = ix * ix + iy * iy <= 1 && y < 21;
      let c;
      if (inside) {
        const dd = Math.sqrt(ix * ix + iy * iy);
        c = (y + x) % 2 ? '#3a2414' : '#2e1c10';
        if (!dim && glow && r() < (1 - dd) * 0.9) c = r() < 0.35 ? shade(glow, 1.25) : shade(glow, 0.8);
      } else {
        const twig = ((x * 2 + y * 3) % 7 < 3) !== (y % 4 < 2);
        c = twig ? '#8a6438' : '#6b4a2a';
        if (r() < 0.08) c = '#c49a5c';
        if (r() < 0.05) c = '#4a3018';
        if (y > 26) c = shade(c, 0.8);
      }
      set(g, x, y, c);
    }
    // straws sticking out
    for (let i = 0; i < 14; i++) { const x = 2 + Math.floor(r() * (w - 4)); const y = 18 + Math.floor(r() * 10); if (get(g, x, y)) { set(g, x - 1, y - 1, '#c49a5c'); set(g, x - 2, y - 2, '#c49a5c'); } }
    outline(g);
    return g;
  }
  function nest(glow, dim, scale) {
    scale = scale || 4;
    return url('n|' + glow + '|' + (dim ? 1 : 0) + '|' + scale, () => nestGrid(glow, dim), scale);
  }

  // ------------------------------------------------------------ pixel starburst (2 frames)
  function burstGrid(cols, frame, size) {
    const n = size || 44; const g = grid(n, n); const c = (n - 1) / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x - c, dy = y - c; const a = Math.atan2(dy, dx) + frame * Math.PI / 8; const rr = Math.sqrt(dx * dx + dy * dy);
      const edge = c * (0.62 + 0.38 * Math.pow(Math.abs(Math.cos(a * 4)), 3));
      if (rr > edge - 1) continue;
      const band = Math.floor(rr / (c / 3));
      set(g, x, y, cols[Math.min(cols.length - 1, band)]);
    }
    outline(g);
    return g;
  }
  function burst(cols, frame, scale, size) {
    scale = scale || 4;
    return url('b|' + cols.join(',') + '|' + frame + '|' + scale + '|' + (size || 44), () => burstGrid(cols, frame, size), scale);
  }

  // ------------------------------------------------------------ icons (12×12 pixel art)
  const PAL = { k: INK, w: '#FFFFFF', y: '#FFD23F', o: '#FF9A2E', r: '#FF4D3D', R: '#B02A20', b: '#3A86FF', B: '#1F4FA8', g: '#4CC864', G: '#2A8A3E', p: '#9B5DE5', P: '#5E2E9E', n: '#9B6A3C', N: '#5E3A1C', s: '#C9C3D9', S: '#7D7596', t: '#F5DDB0', c: '#7FE7F2', m: '#FF6FAE', d: '#2C2140' };
  const ICONS = {
    world: ['...kkkkkk...', '..kSSSSSSk..', '.kSccccccSk.', '.kScwcccpSk.', 'kSccppcpppSk', 'kScpcppcpcSk', 'kScppwcppcSk', 'kScccppcccSk', 'kSccpcccpcSk', 'kSccccccccSk', 'kSSSSSSSSSSk', 'kkkkkkkkkkkk'],
    school: ['.....kk.....', '....kyyk....', '...kyyyyk...', '..kkkkkkkk..', '.krrrrrrrrk.', 'kkkkkkkkkkkk', '.ktttttttt k', '.ktkkttkktk.', '.ktkbttkbtk.', '.ktttkkttt k', '.kttnkkntt k', 'kkkkkkkkkkkk'],
    nest: ['....kkkk....', '...kttwtk...', '..kttwtttk..', '..ktttttok..', '..kttttook..', '.knkttook nk', 'knNnkkkknNnk', 'kNnNnNnNnNnk', '.knNnNnNnNk.', '..kkNnNnkk..', '....kkkk....', '............'],
    market: ['kkkkkkkkkkkk', 'krwrwrwrwrwk', 'krwrwrwrwrwk', 'kkkkkkkkkkkk', '.ktttttttttk', '.ktkkktyyytk', '.ktkbktyyytk', '.ktkbktkkktk', '.ktkkktttt k', '.knnnnnnnnnk', '.kkkkkkkkkk.', '............'],
    factions: ['kk..........', 'kSkkkkkkkk..', 'kSkrrrrrrrk.', 'kSkrryyrrrk.', 'kSkryyyyrrk.', 'kSkrryyrrk..', 'kSkrrrrrk...', 'kSkkkkkkk...', 'kSk.........', 'kSk.........', 'kSk.........', 'kkk.........'],
    bag: ['....kkkk....', '...kNnnNk...', '....kkkk....', '..kknnnnkk..', '.knnnnnnnnk.', 'knnnyyyynnnk', 'knnnykkynnnk', 'knnnyyyynnnk', 'knnnnnnnnnnk', 'kNnnnnnnnnNk', '.kNNNNNNNNk.', '..kkkkkkkk..'],
    log: ['.kkkkkkkkkk.', 'ktttttttttsk', '.kttttttttk.', '.ktkkkkkktk.', '.ktttttttt k', '.ktkkkkktt k', '.ktttttttt k', '.ktkkkkkktk.', '.kttttttttk.', 'ktttttttttsk', '.kkkkkkkkkk.', '............'],
    coin: ['....kkkk....', '..kkyyyykk..', '.kywwyyyyok.', '.kwwyyyyyok.', 'kyyyykkyyyok', 'kyyyk.kyyyok', 'kyyyk.kyyyok', 'kyyyykkyyyok', '.kyyyyyyyok.', '.koyyyyyook.', '..kkooookk..', '....kkkk....'],
    cap: ['............', '.....kk.....', '...kkddkk...', '.kkddddddkk.', 'kddddwdddddk', '.kkddddddkky', '...kkddkk.ky', '...kddddk.ky', '...kddddk.yy', '....kkkk..y.', '............', '............'],
    crown: ['............', 'k....kk....k', 'kyk.kyyk.kyk', 'kyykyyyykyyk', 'kyyyyryyyyyk', 'kyyyrrryyyyk', 'kyyyyryyyyyk', 'kooooooooook', 'kybyyryyybyk', 'kkkkkkkkkkkk', '............', '............'],
    hourglass: ['kkkkkkkkkkkk', '.knnnnnnnnk.', '..kcccccck..', '..kyyyyyyk..', '...kyyyyk...', '....kyyk....', '....kcyk....', '...kccyck...', '..kcccyyck..', '..kcyyyyyk..', '.knnnnnnnnk.', 'kkkkkkkkkkkk'],
    sound: ['......kk....', '.....kSk..k.', '....kSSk.k.k', 'kkkkSSSk..k.', 'kSSSSSSk.k.k', 'kSwSSSSk.k.k', 'kSSSSSSk.k.k', 'kkkkSSSk..k.', '....kSSk.k.k', '.....kSk..k.', '......kk....', '............'],
    mute: ['......kk....', '.....kSk....', '....kSSk....', 'kkkkSSSk.r.r', 'kSSSSSSk..r.', 'kSwSSSSk.r.r', 'kSSSSSSk....', 'kkkkSSSk....', '....kSSk....', '.....kSk....', '......kk....', '............'],
    play: ['kk..........', 'kgk.........', 'kggk........', 'kgggk.......', 'kggggk......', 'kgggggk.....', 'kgggggk.....', 'kggggk......', 'kgggk.......', 'kggk........', 'kgk.........', 'kk..........'],
    help: ['...kkkkkk...', '..kbbbbbbk..', '.kbbwwwwbbk.', '.kbwbbbbwbk.', '.kbbbbbwwbk.', '.kbbbbwwbbk.', '.kbbbbwbbbk.', '.kbbbbbbbbk.', '..kbbwbbbk..', '...kbbbbk...', '....kkkk....', '............'],
    egg: ['....kkkk....', '...kwtttk...', '..kwttttdk..', '..ktttnttk..', '.kttttttttk.', '.ktnttttntk.', '.kttttttttk.', '.ktttttnttk.', '.kttttttttk.', '..kttttttk..', '...kkkkkk...', '............'],
    lupe: ['..kkkk......', '.kccwck.....', 'kccwcccK....', 'kcwccccck...', 'kccccccck...', 'kccccccck...', '.kcccccck...', '..kkkkkkkk..', '.......knNk.', '........knNk', '.........knk', '..........k.'],
    sword: ['..........kk', '.........kwk', '........kwsk', '.......kwsk.', '......kwsk..', '.k...kwsk...', '.kk.kwsk....', '..kkkskk....', '...knkk.....', '..knkkk.....', '.knk..k.....', '.kk.........'],
    heart: ['............', '.kkk...kkk..', 'krrrk.krrrk.', 'krwrrkrrrrk.', 'krrrrrrrrrk.', '.krrrrrrrk..', '..krrrrrk...', '...krrrk....', '....krk.....', '.....k......', '............', '............'],
    lock: ['...kkkkk....', '..kSSSSSk...', '..kS...Sk...', '..kS...Sk...', '.kkkkkkkkk..', '.kyyyyyyyk..', '.kyyykyyyk..', '.kyyykyyyk..', '.kyyyyyyyk..', '.kooooooook.', '.kkkkkkkkk..', '............'],
    star: ['.....kk.....', '.....ky.....', '....kyyk....', 'kkkkkyykkkkk', '.kyyyyyyyyk.', '..kyywyyyk..', '...kyyyyk...', '..kyykkyyk..', '..kyk..kyk..', '.kk.....kk..', '............', '............'],
    scroll: ['.kkkkkkkkk..', 'ktttttttttk.', 'kkttttttttk.', '.kttkkktttk.', '.kttttttttk.', '.kttkkkkttk.', '.kttttttttk.', '.kttkkttttk.', '.kttttttttkk', '.kttttttttttk', '..kkkkkkkkkk', '............'],
    peace: ['............', '...kkkkkk...', '..kgggggGk..', '.kgggwggggk.', '.kggggggggk.', '..kGggggGk..', '...kGggGk...', '....kGGk....', '.....kk.....', '....knNk....', '....kkkk....', '............'],
  };
  function icon(name, scale) {
    scale = scale || 2;
    const rows = ICONS[name] || ICONS.star;
    return url('i|' + name + '|' + scale, () => fromRows(rows.map(r => r.replace(/ /g, '.')), PAL), scale);
  }
  function iconImg(name, scale, cls) { const i = icon(name, scale || 2); return `<img class="ico ${cls || ''}" src="${i.src}" width="${i.w}" height="${i.h}" alt="">`; }

  // ------------------------------------------------------------ sky dragons in faction colours
  const SIL = [
    ['..........FF...........', '.........FFF...........', '........FFFF...........', '.......FFFFF...........', '......FFFFFF.......FF..', 'FF...FFFFFFFFFFFFFFFEF.', '.FFFFFFFFFFFFFFFFFFFFFF', '...FFFFFFFFFFFFFbb.....', '.......FF....FF........', '.......................', '.......................'],
    ['.......................', '.......................', '.......................', '.......................', '...................FF..', 'FF...FFFFFFFFFFFFFFFEF.', '.FFFFFFFFFFFFFFFFFFFFFF', '...FFFFFFFFFFFFFbb.....', '.....FFFFFFFF.FF.......', '......FFFFF............', '.......FF..............'],
  ];
  function skyDragon(color, frame, flip, king, mat, gov) {
    return cached('sky|' + color + '|' + frame + '|' + (flip ? 1 : 0) + '|' + (king ? 1 : 0) + '|' + (mat || 0) + '|' + (gov ? 1 : 0), () => {
      const rows = SIL[frame];
      const g = grid(25, 14);
      const lum = hexRgb(color).reduce((a, b) => a + b, 0) / 3; if (lum < 50) color = shade(color, 1.45);
      rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; const xx = 1 + (flip ? 22 - x : x); const c = ch === 'E' ? '#FFFFFF' : ch === 'b' ? shade(color, 1.35) : (y < 4 ? shade(color, 1.18) : y > 6 ? shade(color, 0.72) : color); set(g, xx, y + 1, c); } });
      if (mat) { set(g, flip ? 12 : 12, 5, '#FFFFFF'); }
      if (gov) { for (let x = 9; x <= 12; x++) set(g, 1 + (flip ? 22 - x : x), 7, '#FFD23F'); }
      if (king) { const kx = flip ? 3 : 21; set(g, kx - 1, 1, '#FFD23F'); set(g, kx, 0, '#FFD23F'); set(g, kx + 1, 1, '#FFD23F'); set(g, kx, 1, '#FFD23F'); }
      outline(g);
      return toCanvas(g, 1);
    });
  }

  root.Sprites = { dragon, variantName, egg, nest, burst, scaleSprite, scaleColor, portal, hatchery, icon, iconImg, skyDragon, shade, mix, INK };
})(window);
