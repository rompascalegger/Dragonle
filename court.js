/*
 * Dragonle – the royal court: speeches of the Dragon King, briefings of the government,
 * declarations, laments and replies. Builds text from the live state of the realm.
 */
(function (root) {
  'use strict';
  const G = root.Dragonle, VO = root.DRAGONLE_VOICES;
  const EL = G.EL, NE = G.NE;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const fill = (t, m) => t.replace(/\{(\w+)\}/g, (_, k) => (m[k] != null ? m[k] : ''));
  const voice = f => VO.V[EL[f].id];
  const pct = x => Math.round(x * 100) + ' %';
  const S = () => G.S;
  const living = () => { const o = []; for (let f = 0; f < NE; f++) if (!S().factions[f].ended && G.adultsOf(f).length) o.push(f); return o; };
  const snap = d => d && { id: d.id, name: d.name, v: d.v.slice(), mat: d.mat, seed: d.seed, deep: d.deep };

  function worstOf(f) { let w = -1, r = 1e9; living().forEach(g => { if (g !== f && S().rel[f][g] < r) { r = S().rel[f][g]; w = g; } }); return w; }
  function bestOf(f) { let w = -1, r = -1e9; living().forEach(g => { if (g !== f && S().rel[f][g] > r) { r = S().rel[f][g]; w = g; } }); return w; }

  function keeperLine(f, v, m) {
    if (!S().access[f]) return 'There is a Keeper below who raises our kind. They have yet to raise one for us.';
    const lvl = G.repLevel(f);
    if (lvl >= G.REPI.friendly) return fill(pick(v.praise), m);
    if (lvl <= G.REPI.unfriendly) return fill(pick(v.scorn), m);
    return 'Keeper, we are watching what you do with our young.';
  }
  function situation(f, m) {
    const s = S(); const out = [];
    const N = G.adultsOf(f).length, K = G.C.factions.capacity;
    if (s.war) {
      const sa = s.war.sa || [s.war.attacker], sd = s.war.sd || [s.war.defender];
      const ours = sa.includes(f) ? sa : sd.includes(f) ? sd : null;
      if (ours) out.push(fill(pick(voice(f).war), { enemy: EL[ours === sa ? s.war.defender : s.war.attacker].name }));
      else out.push(`${EL[s.war.attacker].name} and ${EL[s.war.defender].name} sharpen their claws. Let them bleed each other – the throne watches.`);
    }
    const lw = s.logs.wars[0];
    if (lw && s.played - lw.t < 90) {
      const won = (lw.wside || [lw.winner]).includes(f), lost = (lw.lside || [lw.loser]).includes(f);
      if (won) out.push(pick(voice(f).victory));
      else if (lost) out.push(pick(voice(f).defeat));
    }
    if (N >= K) out.push(`Our flight numbers ${N}. The sky grows crowded, and crowded skies grow angry.`);
    else if (N <= 2) out.push('We are few. But every one of us is worth a hundred.');
    else out.push(`${N} wings answer to this throne. Count them, rivals, and despair.`);
    const al = G.allies(f);
    if (al.length) out.push(`Our bond with ${al.map(x => EL[x].name).join(' and ')} is forged in iron.`);
    else out.push('We stand alone. Alone, no one can betray us.');
    const n = s.factions[f].needs;
    const low = ['raum', 'brut', 'ehre', 'tribut'].reduce((a, b) => (n[b] < n[a] ? b : a), 'raum');
    if (n[low] < 40) out.push({ raum: 'We need room to fly – and we will take it if we must.', brut: 'Our nests are cold. This cannot last.', ehre: 'Our honour has been bruised. It will be avenged.', tribut: 'Tribute has been thin. The realm remembers who pays.' }[low]);
    const fallen = [];
    for (let g = 0; g < NE; g++) if (s.factions[g].ended) fallen.push(EL[g].name);
    if (fallen.length && Math.random() < 0.5) out.push(`Remember ${fallen.join(' and ')}, who fell from the sky. Let no one here share their fate.`);
    const rival = worstOf(f);
    if (rival >= 0 && Math.random() < 0.6) out.push(`I see ${EL[rival].name} growing bold. Tall trees fall loudest.`);
    // shuffle and keep two
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
    return out.slice(0, 2);
  }

  // ------------------------------------------------------------ the King
  function kingSpeech(e) {
    const s = S(); const k = s.dragons[e.king]; if (!k) return null;
    const f = e.f; const v = voice(f);
    const m = { king: k.name, f: EL[f].name, keeper: 'of the Nests', enemy: worstOf(f) >= 0 ? EL[worstOf(f)].name : 'the sky', ally: bestOf(f) >= 0 ? EL[bestOf(f)].name : '' };
    const lines = [pick(v.open)].concat(situation(f, m));
    if (e.decree) { const d = G.C.decrees.find(x => x.id === e.decree); lines.push(`By royal decree: ${d.name}! ${d.text}`); }
    lines.push(keeperLine(f, v, m), pick(v.close));
    return { kind: 'king', f, who: snap(k), name: `♛ ${k.name} ${v.epithet}`, role: `Dragon King of ${EL[f].name} · ${v.title}`, lines, decree: e.decree };
  }
  // ------------------------------------------------------------ the government
  function ministerSpeech(e) {
    const s = S(); const d = s.dragons[e.id]; if (!d) return null;
    const idx = Math.max(0, s.gov.indexOf(d.id));
    const off = VO.MINISTERS[(idx + d.seed) % VO.MINISTERS.length];
    const f = d.faction; const lines = [];
    const fs = living();
    if (off.topic === 'war') {
      let hot = -1, hr = 0; fs.forEach(g => { const r = G.warRisk(g); if (r > hr) { hr = r; hot = g; } });
      if (hot >= 0 && hr > 0.25) lines.push(`${EL[hot].name} is restless – I put their war risk at ${pct(Math.min(1, hr))}. Someone will bleed soon.`);
      else lines.push('The armies are rested. Too rested. Peace makes dragons soft.');
      const pacts = G.dip().pacts;
      if (pacts.length) lines.push(`${pacts.length} pact${pacts.length > 1 ? 's' : ''} of peace still hold${pacts.length > 1 ? '' : 's'}. Paper claws, if you ask me.`);
      else lines.push('An envoy could buy a pact of peace between rivals – for a price.');
    } else if (off.topic === 'trade') {
      const dc = G.decree();
      if (dc) lines.push(`The decree "${dc.name}" is in force: ${dc.text}`);
      lines.push(`${EL[s.ruler].name} scales fetch a royal price while ${EL[s.ruler].name} rules. Those of ${EL[s.ruler ^ 1].name}… less so.`);
      if (G.dip().favourUntil > s.played) lines.push('You enjoy the royal favour, Keeper. The merchants pay you more. Enjoy it while it lasts.');
      else lines.push('An audience with the King, a fitting gift – and the merchants might pay you better.');
    } else if (off.topic === 'nests') {
      const pupils = G.list(x => x.status === 'school').length;
      lines.push(pupils ? `Your School holds ${pupils} pupil${pupils > 1 ? 's' : ''}, Keeper. Every one a future wing of some banner.` : 'Your School stands empty, Keeper. An empty school raises no armies.');
      const st = s.stats; if (st.clutches) lines.push(`The nests have laid ${st.clutches} clutches since you came. The rolls are kept honestly – check the Log if you doubt me.`);
    } else if (off.topic === 'whispers') {
      let pa = -1, pb = -1, best = -1e9;
      fs.forEach(a => fs.forEach(b => { if (a < b && !G.isEnemy(a, b) && !G.allied(a, b)) { const r = Math.min(s.rel[a][b], s.rel[b][a]); if (r > best) { best = r; pa = a; pb = b; } } }));
      if (pa >= 0 && best > 20) lines.push(`Whispers say ${EL[pa].name} and ${EL[pb].name} are close to an alliance. An envoy could tip the scale.`);
      let wa = -1, wb = -1, worst = 1e9;
      fs.forEach(a => fs.forEach(b => { if (a !== b && !G.isEnemy(a, b) && s.rel[a][b] < worst) { worst = s.rel[a][b]; wa = a; wb = b; } }));
      if (wa >= 0) lines.push(`I hear ${EL[wa].name} speaks of ${EL[wb].name} with poison on its tongue.`);
    } else {
      let total = 0; fs.forEach(g => { total += G.adultsOf(g).length; });
      const top = fs.slice().sort((a, b) => G.adultsOf(b).length - G.adultsOf(a).length)[0];
      if (top != null) lines.push(`${total} dragons wing above us. ${EL[top].name} holds ${pct(G.adultsOf(top).length / Math.max(1, total))} of the sky.`);
      const al = G.alliances(); if (al.length) lines.push(`Banners of alliance fly: ${al.map(a => a.name).join(', ')}.`);
    }
    return { kind: 'minister', f, who: snap(d), name: d.name, role: `${off.office} of ${EL[f].name}`, lines: lines.slice(0, 2) };
  }
  // ------------------------------------------------------------ moments
  function declaration(e) {
    const s = S(); const f = e.attacker; const k = f === s.ruler && s.king ? s.dragons[s.king] : G.eldest(f);
    if (!k) return null; const v = voice(f);
    const enemy = (e.sd || [e.defender]).map(x => EL[x].name).join(' and ');
    return { kind: 'war', f, who: snap(k), name: k.name + ' ' + v.epithet, role: `Warlord of ${EL[f].name} · declaration of war`, lines: [fill(pick(v.war), { enemy }), fill(pick(v.cry), {}), 'Let the sky decide.'] };
  }
  function coronation(e) {
    const s = S(); const k = s.dragons[e.king]; if (!k) return null; const v = voice(e.f);
    const l = G.lawOf(e.f) || G.C.lawPlaceholder;
    return { kind: 'king', f: e.f, who: snap(k), name: `♛ ${k.name} ${v.epithet}`, role: `crowned Dragon King of ${EL[e.f].name}`, lines: [pick(v.open), `From this day the sky answers to ${v.title}.`, `My first law: ${l.name}. ${l.text}`, pick(v.close)] };
  }
  function lament(e) {
    const s = S(); const k = s.king && s.dragons[s.king]; if (!k) return null; const v = voice(s.ruler);
    return { kind: 'king', f: s.ruler, who: snap(k), name: `♛ ${k.name}`, role: 'the throne speaks', lines: [`${EL[e.f].name} has fallen from the sky.`, s.ruler === e.f ? '' : pick(v.victory), 'Mark this day. The sky has fewer colours tonight.'].filter(Boolean) };
  }
  function peace(e) {
    const s = S(); const k = G.eldest(e.a); if (!k) return null; const v = voice(e.a);
    return { kind: 'king', f: e.a, who: snap(k), name: k.name, role: `of ${EL[e.a].name} · after the peace talks`, lines: [`Very well, Keeper. ${EL[e.b].name} may keep its sky – for now.`, pick(v.close)] };
  }
  function audienceReply(r) {
    const s = S(); const k = s.dragons[r.king]; if (!k) return null; const v = voice(r.f);
    const m = { keeper: 'of the Nests' };
    const lines = r.pleased
      ? [fill(pick(v.praise), m), 'You have my favour. The merchants of the sky will know it.']
      : ['…Is that all? The throne has seen finer gifts from hatchlings.', fill(pick(v.scorn), m)];
    return { kind: 'king', f: r.f, who: snap(k), name: `♛ ${k.name}`, role: 'grants you an audience', lines };
  }
  function cry(f) { return pick(voice(f).cry); }
  function victoryLine(f) { return pick(voice(f).victory); }
  function defeatLine(f) { return pick(voice(f).defeat); }
  // ------------------------------------------------------------ the argument before the throne
  const TOPIC = { ehre: 'HONOUR', raum: 'SPACE TO FLY', tribut: 'TRIBUTE', brut: 'THE NESTS' };
  const ARG = {
    ehre: { chal: ['{f} has bled for this sky and is paid in silence! Where is our honour, {king}?', 'You wear a crown we helped forge. Bow to us, for once!', 'Every victory of this throne was won with {f} wings. Name one you won alone!'],
      king: ['Honour is earned beneath my throne, not demanded of it.', 'Your honour is safe – as long as you remember whose sky this is.', 'I have buried braver dragons than you who spoke of honour.'] },
    raum: { chal: ['Our wings scrape against each other! Give us room, or we take it!', 'The sky is wide, yet {f} is crammed into its corners like hatchlings.', 'We cannot breathe beneath your crown, {king}!'],
      king: ['The sky is shared. Greed is not a grievance.', 'Fly higher, then. The clouds are free to all who obey.', 'Room is made by patience. War only makes graves.'] },
    tribut: { chal: ['We pay and pay, and the throne grows fat!', 'Our tribute fills your hoard – what fills our bellies, {king}?', 'Not one more scale for a throne that gives nothing back!'],
      king: ['Tribute is the price of peace. Would you rather pay in blood?', 'Every scale you give keeps the sky from burning.', 'The hoard protects you too, ungrateful one.'] },
    brut: { chal: ['Our nests are cold and our eggs few. The throne does nothing!', 'Our young hatch into a crowded, hungry sky. No more!', 'You promised warm nests. We received ash.'],
      king: ['Nests are warmed by patience, not by war.', 'Lay down your claws, and I will see your nests warmed.', 'Go to war, and there will be no nests left to warm.'] },
  };
  function argueLine(topic, who, f, king) { return fill(pick(ARG[topic][who]), { f: EL[f].name, king }); }
  function challenge(e) {
    const s = S(); const c = s.dragons[e.chal], k = s.dragons[e.king]; if (!c || !k) return null;
    return { kind: 'war', f: e.attacker, who: snap(c), name: c.name, role: `Lord of ${EL[e.attacker].name} · challenges the throne`, lines: [`${k.name}! ${EL[e.attacker].name} challenges you before the throne.`, 'Out-argue me – or answer with your claws.'] };
  }
  function verdict(e) {
    const s = S();
    if (e.kingWon) { const k = s.dragons[e.king]; if (!k) return null; return { kind: 'king', f: e.ruler, who: snap(k), name: '♛ ' + k.name, role: 'wins the argument', lines: [pick(voice(e.ruler).victory), `Go home, ${EL[e.attacker].name}. The sky stays at peace.`] }; }
    const c = s.dragons[e.chal]; if (!c) return null;
    return { kind: 'war', f: e.attacker, who: snap(c), name: c.name, role: `of ${EL[e.attacker].name} · silenced the King`, lines: ['Words have failed. Claws will not.', pick(voice(e.attacker).cry)] };
  }

  // ------------------------------------------------------------ the chronicle: invented biographies
  const LANDS = { fire: 'the Cinder Peaks', water: 'the Sunken Reefs', light: 'the Glass Spires', dark: 'the Hollow Caverns', lightning: 'the Storm Mesas', sand: 'the Endless Dunes', wind: 'the Cloud Cradle', stone: 'the Granite Steps', ice: 'the Frozen Reach', magma: 'the Molten Rift', nature: 'the Elder Grove', poison: 'the Thorn Marsh' };
  const YOUTH = [
    'was the smallest of its clutch and fought for every scrap of warmth',
    'learned to fly before it could crawl, and crashed into every cliff it met',
    'spent its first century guarding a single egg that never hatched',
    'was raised by an old general who had lost every war but one',
    'slept two hundred years on a frozen ledge and woke up hungry for the world',
    'won its first duel at three hundred years against a dragon twice its size',
    'was mocked for its strange colours until it outflew every bully in the nest',
    'grew up on the stories of fallen kings and swore never to become one',
    'was lost for a decade in a great storm and came back changed, and silent',
    'befriended a hatchling of its arch-enemy – a secret it carried for ages',
    'stole a scale from a sleeping king and kept it as a talisman',
    'counted the stars every night until it knew each one by name',
  ];
  const TRAITS = ['patient', 'fierce', 'cunning', 'gentle', 'proud', 'restless', 'silent', 'merciless', 'beloved', 'feared', 'clever', 'stubborn'];
  const yr = n => Math.round(n).toLocaleString('en-US');
  function seeded(seed) { let x = (seed >>> 0) || 1; return n => { x = (x * 1103515245 + 12345) >>> 0; return x % n; }; }
  function origin(e) {
    const z = s => s && G.S.zones[s];
    const zone = z(e.home);
    if (e.raised && zone) return `the ${G.zoneName(zone)} Zone, raised by you at the Dragon School`;
    const el = zone && zone.els.length === 1 ? EL[zone.els[0]].id : EL[e.f].id;
    return `a wild nest in ${LANDS[el]}`;
  }
  function bio(e, asKing) {
    const r = seeded(e.seed); const start = G.C.time.startYear;
    const born = start + e.from - e.ageAt;
    const v = voice(e.f);
    const parts = [];
    parts.push(`${e.name} was born around Year ${yr(born)} in ${origin(e)}.`);
    parts.push(`As a hatchling it ${YOUTH[r(YOUTH.length)]}.`);
    if (e.parents && e.parents.length === 2) parts.push(`It is the child of ${e.parents[0]} and ${e.parents[1]}.`);
    parts.push(`Its scales show ${G.vecText(e.v)}${e.mat ? ', every one of them ' + G.C.material.tiers[e.mat - 1].name.toLowerCase() : ''}.`);
    parts.push(asKing ? `At ${yr(e.ageAt)} years it was crowned Dragon King, ${v.epithet}.` : `It took the lead of ${EL[e.f].name} at the age of ${yr(e.ageAt)} years.`);
    parts.push(`A ${TRAITS[r(TRAITS.length)]} ${asKing ? 'king' : 'lord'}, ` + (e.wars ? `it has led ${e.wars} war${e.wars === 1 ? '' : 's'} and won ${e.wins}.` : (e.to == null ? 'it has not yet led its banners to war.' : 'it never led its banners to war.')));
    if (e.to != null) parts.push(`Its reign ended when it ${e.end}.`);
    return parts.join(' ');
  }
  root.Court = { kingSpeech, ministerSpeech, declaration, coronation, lament, peace, audienceReply, cry, victoryLine, defeatLine, voice, TOPIC, argueLine, challenge, verdict, bio };
})(typeof window !== 'undefined' ? window : globalThis);
