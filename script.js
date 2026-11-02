const $ = (id) => document.getElementById(id);

const rollBtn = $("roll");
const levelEl = $("level");
const scoreEl = $("score");
const goalEl = $("goal");
const rocksEl = $("rocks");
const totalEl = $("total");
const goldEl = $("gold-value");
const goalFill = $("goal-fill");
const hpFill = $("hp-fill");
const hpText = $("hp-text");
const hardnessEl = $("hardness");
const rarityEl = $("rarity");
const rockDepthEl = $("rock-depth");
const pit = $("pit");
const rockCanvas = $("rock");
const messageEl = $("message");
const toastEl = $("toast");
const jokeEl = $("joke");
const depthLabelEl = $("depth-label");
const topLevelEl = $("top-level");
const driftEl = $("drift");
const muteBtn = $("mute");

const VERSION = "1.0.0";

// Ten tiers by the deepest level a run reaches: label, player title, verdict, color
const TIERS = [
  { name: "PEBBLE", title: "Gravel Tourist", verdict: "Still Looking for the Entrance", color: "#9a8fa8" },
  { name: "COPPER", title: "Weekend Digger", verdict: "Owns a Very Clean Pickaxe", color: "#c46a2c" },
  { name: "IRON", title: "Tunnel Rat", verdict: "Smells Faintly of Dust", color: "#a0a8b4" },
  { name: "SILVER", title: "Shift Foreman", verdict: "Knows Which Rocks to Ignore", color: "#d4dae3" },
  { name: "GOLD", title: "Vein Hunter", verdict: "The Canary's Best Friend", color: "#ffcf4a" },
  { name: "EMERALD", title: "Deep Delver", verdict: "Hasn't Seen the Sun in Weeks", color: "#2ee87a" },
  { name: "RUBY", title: "Seam Breaker", verdict: "Rocks Fear the Sound of Boots", color: "#ff2f5b" },
  { name: "DIAMOND", title: "Crystal Baron", verdict: "Pays Rent in Gemstones", color: "#5ff4ff" },
  { name: "OBSIDIAN", title: "Lord of the Underneath", verdict: "Lava Is Just Warm Rock", color: "#b45cff" },
  { name: "LEGENDARY", title: "Core Whisperer", verdict: "Dug Straight Through the Planet", color: "#ff8a1f" },
];
// The deepest level reached picks the tier
const LEVEL_TIERS = [1, 3, 5, 8, 12, 17, 25, 35, 50, 75];
const tierFor = (level) => LEVEL_TIERS.reduce((tier, t, i) => (level >= t ? i : tier), 0);

function paintTier(el, tier) {
  el.style.setProperty("--tc", TIERS[tier].color);
  el.classList.toggle("jackpot", tier === 9);
}

/* ---------- RogueMiner's rules ---------- */

// Stats before any upgrade; a bought level replaces the value with the upgrade's table value
const BASE_STATS = { strength: 1, agility: 1, luck: 1, pickaxe: 1, rockLevel: 1, worldLevel: 1, slowMotion: 100, power: 100 };
const START_ROCKS = 9;
const rocksForLevel = (level) => 6 + level * 3;
// Every level's goal is 15% above the last one's
const goalFor = (level) => Math.floor(400 * Math.pow(1.15, level));
// Holding on the rock swings this often
const SWING_MS = 100;
const RARITY_NAMES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
const RARITY_GROUPS = ["STONES", "MINERALS", "GEMS", "PRECIOUS", "ELEMENTS"];
const RARITY_COLORS = ["#c7c7c7", "#40d959", "#408cff", "#a64df2", "#ffa61a"];
const STAT_LABELS = {
  strength: "Strength",
  agility: "Agility",
  luck: "Luck",
  pickaxe: "Pickaxe",
  rockLevel: "Insight",
  worldLevel: "Dimension",
  slowMotion: "Rock speed %",
  power: "Score power %",
};

const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
// Unity's Random.Range(int, int): max is exclusive, and an empty range returns min
const range = (min, max) => (max <= min ? min : min + Math.floor(Math.random() * (max - min)));
const between = (min, max) => min + Math.random() * (max - min);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function load(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable; values just won't persist
  }
}

// Big numbers stay short: 999,999 then 1.23M, 4.56B, and so on
function fmt(v) {
  v = Math.floor(v);
  if (Math.abs(v) < 1e6) return v.toLocaleString("en-US");
  const units = ["M", "B", "T", "Qa", "Qi"];
  const i = Math.floor(Math.log10(Math.abs(v)) / 3) - 2;
  return i < units.length ? `${(v / Math.pow(1000, i + 2)).toFixed(2)}${units[i]}` : v.toExponential(2);
}

/* ---------- Everything that is kept: finds, gold, upgrades, achievements, the current run ---------- */

const SAVE_KEY = "minele-save";
const blankSave = () => ({
  gold: 0,
  // itemId -> [available, spent]; spent finds never come back, but still count as found
  inv: {},
  upgrades: {},
  ach: {},
  stats: { minedStones: 0, gameStarts: 0, levelHigh: 1, scoreHigh: 0, totalHigh: 0, goldEarned: 0 },
  run: null,
});

let state = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (raw && typeof raw === "object") {
      const base = blankSave();
      return { ...base, ...raw, stats: { ...base.stats, ...raw.stats } };
    }
  } catch {
    // Unreadable save: start fresh
  }
  return blankSave();
})();

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable; this session just won't be kept
  }
}

const upgradeLevel = (id) => state.upgrades[id] || 0;
function stat(name) {
  const u = UPGRADES.find((x) => x.stat === name);
  const level = u ? upgradeLevel(u.id) : 0;
  return level ? u.values[level - 1] : BASE_STATS[name];
}
const available = (id) => (state.inv[id] ? state.inv[id][0] : 0);
const everFound = (id) => (state.inv[id] ? state.inv[id][0] + state.inv[id][1] : 0);

function addItem(id, n = 1) {
  const entry = state.inv[id] || [0, 0];
  entry[0] += n;
  state.inv[id] = entry;
}

function spendItem(id, n) {
  const entry = state.inv[id];
  if (!entry || entry[0] < n) return false;
  entry[0] -= n;
  entry[1] += n;
  return true;
}

function addGold(n) {
  state.gold += n;
  state.stats.goldEarned += n;
  renderGold();
}

/* ---------- The run ---------- */

// idle: no run, mining: the rock is out, busy: between rocks (break, level up, game over)
let phase = "idle";
let run = state.run;
let topLevel = state.stats.levelHigh;
topLevelEl.textContent = topLevel;

// Rotating mine jokes in the footer
const JOKES = [
  "Rock bottom is just the first level down here",
  "This mine is gneiss. Don't take it for granite",
  "Ore you going to hit that?",
  "The canary called in sick again",
  "Hard rocks wiggle slower. Life lessons",
  "Safety helmet sold separately",
  "Shaft depth: yes",
  "A legendary drop: 0.1%. The bragging: 100%",
  "Diamonds are forever. Pebbles are for now",
  "Our pickaxes are unionized. Please tip them",
  "Geologists rock. Miners just roll with it",
  "Quartz of coffee keep the night shift going",
  "Every stone tells a story. Mostly about pressure",
  "No rocks were harmed. Well. Most of them",
];
let jokeIndex = Math.floor(Math.random() * JOKES.length);
function nextJoke() {
  jokeEl.textContent = "⛏ " + JOKES[jokeIndex++ % JOKES.length] + " ⛏";
  jokeEl.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], {
    duration: 400,
    easing: "steps(4)",
  });
}
nextJoke();
setInterval(nextJoke, 7000);

/* ---------- 8-bit sound ---------- */

let muted = load("minele-sound-off") === 1;
muteBtn.classList.toggle("off", muted);

let audioCtx = null;
let master = null;
let reverb = null;

// Lazily creates the audio graph: everything -> compressor (keeps stacked fanfares from
// clipping), with a send into a generated cave reverb for the epic stuff
function audio() {
  if (muted) return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
    master = audioCtx.createDynamicsCompressor();
    master.threshold.value = -18;
    master.ratio.value = 6;
    master.connect(audioCtx.destination);

    // Impulse response: 3s of stereo noise with an exponential tail
    const len = Math.floor(audioCtx.sampleRate * 3);
    const ir = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverb = audioCtx.createConvolver();
    reverb.buffer = ir;
    reverb.connect(master);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function send(node, wet) {
  if (!wet) return;
  const g = audioCtx.createGain();
  g.gain.value = wet;
  node.connect(g).connect(reverb);
}

// Browsers only allow audio after a user gesture, so unlock it on the first one
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => audio(), { once: true });
}

function sfx(freq, dur, { type = "square", vol = 0.04, to = null, delay = 0, attack = 0, wet = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (attack) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  } else {
    gain.gain.setValueAtTime(vol, t);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  send(gain, wet);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// White noise through a filter: snares, cymbals (high-pass) or thumps (lp set: low-pass).
// attack > 0 swells in, which makes a reverse cymbal
function noise(dur, { vol = 0.1, delay = 0, hp = 1000, lp = 0, attack = 0, wet = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = lp ? "lowpass" : "highpass";
  filter.frequency.value = lp || hp;
  const gain = ac.createGain();
  if (attack) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.05));
  } else {
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  src.connect(filter).connect(gain).connect(master);
  send(gain, wet);
  src.start(t);
}

/* ---------- Epic orchestra (all synthesized) ---------- */

const semis = (root, s) => root * Math.pow(2, s / 12);

// Brass: two detuned saws through a low-pass that opens up like a horn blat
function brass(freq, dur, { vol = 0.05, delay = 0, wet = 0.3 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(3200, t + 0.08);
  filter.frequency.exponentialRampToValueAtTime(1100, t + Math.min(dur, 0.6));
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  gain.gain.setValueAtTime(vol, t + dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  filter.connect(gain).connect(master);
  send(gain, wet);
  for (const cents of [-8, 8]) {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

const brassChord = (root, chord, dur, delay, vol = 0.035) =>
  chord.forEach((s) => brass(semis(root, s), dur, { vol, delay }));

// Timpani: a sine that drops onto its pitch, plus a felt-mallet thump, drenched in hall
function timpani(freq, { vol = 0.35, delay = 0 } = {}) {
  sfx(freq * 1.5, 1.4, { type: "sine", vol, to: freq, delay, wet: 0.5 });
  sfx(freq * 2.01, 0.6, { type: "sine", vol: vol * 0.25, to: freq * 2, delay, wet: 0.4 });
  noise(0.12, { vol: vol * 0.5, delay, lp: 600, wet: 0.3 });
}

// Sub boom: a huge low drop you feel more than hear
function boom(delay = 0) {
  sfx(70, 1.8, { type: "sine", vol: 0.6, to: 28, delay, wet: 0.2 });
  noise(0.6, { vol: 0.3, delay, lp: 200, wet: 0.4 });
}

// The mine cart going down: a low rumble that sinks, with clattering rails under it
function cartRumble(dur) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(95, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + dur);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, t);
  filter.frequency.exponentialRampToValueAtTime(220, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.09, t + Math.min(0.25, dur / 3));
  gain.gain.setValueAtTime(0.09, t + dur * 0.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(filter).connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  for (let i = 0; i < dur / 0.16; i++) noise(0.04, { vol: 0.06, delay: i * 0.16, hp: 2500 });
}

// A bright chime with a long ring
function ding(vol = 0.1, delay = 0) {
  sfx(1319, 1.4, { type: "sine", vol, delay, wet: 0.4 });
  sfx(1319 * 2.76, 0.5, { type: "sine", vol: vol * 0.25, delay, wet: 0.4 });
  sfx(1319 * 5.4, 0.18, { type: "sine", vol: vol * 0.12, delay });
}

// Choir: soft detuned triangles fading in, mostly reverb
function choir(root, chord, dur, delay = 0) {
  for (const s of chord) {
    for (const d of [0.996, 1, 1.004]) {
      sfx(semis(root, s) * d, dur, { type: "triangle", vol: 0.018, delay, attack: dur * 0.35, wet: 0.7 });
    }
  }
}

// Victory fanfare: longer and fuller the higher the tier (0-9)
function victory(tier) {
  const root = semis(196, Math.min(tier, 9)); // G3, rising a semitone per tier
  boom(0);
  timpani(semis(root, -12), { delay: 0 });
  // I - IV - V - I, brass stabs on each, timpani under
  const progression = [[0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19], [12, 16, 19, 24]];
  const chords = tier < 3 ? 2 : 4;
  for (let i = 0; i < chords; i++) {
    const at = 0.15 + i * 0.42;
    const last = i === chords - 1;
    brassChord(root, progression[last ? 3 : i], last ? 2.4 : 0.38, at);
    timpani(semis(root, progression[i][0] - 12), { delay: at, vol: 0.25 });
  }
  if (tier >= 3) choir(root, [12, 16, 19, 24], 3.2, 0.5);
  if (tier >= 6) {
    noise(2.6, { vol: 0.16, delay: 0.15 + (chords - 1) * 0.42, hp: 5000, wet: 0.5 });
    [24, 28, 31, 36].forEach((s, i) => brass(semis(root, s), 0.18, { vol: 0.03, delay: 0.1 + i * 0.07 }));
  }
}

const arp = (notes, step, opts) => notes.forEach((f, i) => sfx(f, 0.14, { ...opts, delay: i * step }));
const kick = (delay) => sfx(150, 0.35, { type: "sine", vol: 0.5, to: 40, delay });

const SOUND = {
  // A pickaxe strike: a stony crack plus a clank that rings higher the bigger the crit
  hit: (crit) => {
    noise(0.05, { vol: 0.14, hp: 1400 });
    sfx(160 + crit * 70, 0.07, { type: "triangle", vol: 0.09, to: 70 });
    if (crit >= 3) sfx(700 + crit * 120, 0.12, { vol: 0.03, to: 1400 + crit * 200 });
    if (crit >= 5) kick(0);
  },
  miss: () => sfx(380, 0.06, { type: "sine", vol: 0.02, to: 220 }),
  crumble: () => {
    noise(0.4, { vol: 0.28, lp: 900 });
    noise(0.15, { vol: 0.12, hp: 3000, delay: 0.05 });
    sfx(140, 0.35, { type: "triangle", vol: 0.15, to: 45 });
  },
  // One drop sound per rarity, getting grander
  drop: (r) => {
    if (r === 0) sfx(700, 0.15, { type: "sine", to: 300, vol: 0.06 });
    else if (r === 1) arp([523, 784], 0.07, { type: "triangle", vol: 0.06 });
    else if (r === 2) arp([523, 659, 988], 0.07, { type: "triangle", vol: 0.07, wet: 0.2 });
    else if (r === 3) {
      arp([523, 659, 784, 1047, 1319], 0.06, { vol: 0.05, wet: 0.3 });
      ding(0.07, 0.3);
    } else victory(6);
  },
  coin: () => {
    sfx(988, 0.08, { vol: 0.04 });
    sfx(1319, 0.25, { vol: 0.04, delay: 0.07 });
  },
  combo: () => arp([523, 659, 784, 1047, 1319], 0.06),
  pop: () => sfx(400, 0.12, { to: 1200, vol: 0.05 }),
  blub: () => sfx(700, 0.15, { type: "sine", to: 180, vol: 0.07 }),
  sad: () => arp([392, 330, 262], 0.15, { type: "triangle", vol: 0.06 }),
  trophy: () => arp([659, 784, 988, 1319], 0.08, { type: "triangle", vol: 0.06, wet: 0.4 }),
  deny: () => sfx(140, 0.18, { type: "square", vol: 0.04, to: 90 }),
};

muteBtn.addEventListener("click", () => {
  muted = !muted;
  save("minele-sound-off", muted ? 1 : 0);
  muteBtn.classList.toggle("off", muted);
  SOUND.pop();
});

/* ---------- The rock ---------- */

// Drawn at 50x50 pixels and shown at 150px, so every pixel is a chunky 3x3 block
const ROCK_GRID = 50;
const ROCK_PX = 150;
// A tap this close to the rock's center hits (the blob is about 40 of 50 pixels wide)
const HIT_RADIUS = 64;
const rctx = rockCanvas.getContext("2d");
rockCanvas.width = ROCK_GRID;
rockCanvas.height = ROCK_GRID;

let rock = null;

// Specks in the stone hint at how lucky the rock is
const SPECK_COLORS = ["#b8aac8", "#b8aac8", "#b8aac8", "#40d959", "#40d959", "#408cff", "#408cff", "#a64df2", "#a64df2", "#ffcf4a"];

function makeRock() {
  // RogueMiner: three nested rolls make most rocks soft and a few very hard
  const dice1 = range(1, 100);
  const dice2 = range(1, dice1);
  const luck = range(1, dice2);
  const rarity = range(1, 11);
  const rockLevel = stat("rockLevel");
  const worldLevel = stat("worldLevel");
  const difficulty = 1 + (rockLevel - 1) * 0.08 + (worldLevel - 1) * 0.15;
  const hardness = Math.max(1, Math.round(luck * difficulty));
  const hp = 100 * difficulty;

  // Higher insight unlocks wilder ways to wiggle, from calm to frantic
  const unlocked = Math.min(PATTERNS.length, Math.max(1, Math.ceil(PATTERNS.length * clamp01(rockLevel / 100))));

  // A lumpy outline: a circle bent by three random harmonics
  const harmonics = [2, 3, 5].map((k) => ({ k, amp: between(0.04, 0.12), ph: between(0, Math.PI * 2) }));
  const specks = [];
  const speckCount = 4 + rarity * 2;
  for (let i = 0; i < speckCount; i++) {
    specks.push({ x: range(10, 40), y: range(10, 40), size: Math.random() < 0.3 ? 2 : 1, color: SPECK_COLORS[Math.min(9, range(0, rarity))] });
  }
  // Cracks: random walks from the middle, revealed as the rock loses health
  const cracks = [];
  for (let c = 0; c < 6; c++) {
    let x = 25 + range(-4, 5);
    let y = 25 + range(-4, 5);
    let a = between(0, Math.PI * 2);
    const path = [];
    for (let s = 0; s < 14; s++) {
      a += between(-0.7, 0.7);
      x += Math.cos(a) * 1.4;
      y += Math.sin(a) * 1.4;
      path.push([Math.round(x), Math.round(y)]);
    }
    cracks.push(path);
  }
  // Harder rocks are darker
  const shade = Math.max(0, 1 - Math.log10(hardness) * 0.32);
  return {
    hp,
    maxHp: hp,
    hardness,
    rarity,
    luck,
    pattern: range(0, unlocked),
    phase: between(0, Math.PI * 2),
    harmonics,
    specks,
    cracks,
    shade,
    x: 0,
    y: 0,
    broken: false,
  };
}

function insideRock(r, x, y) {
  const dx = x - 24.5;
  const dy = y - 24.5;
  const angle = Math.atan2(dy, dx);
  let radius = 19.5;
  for (const h of r.harmonics) radius += Math.sin(angle * h.k + h.ph) * h.amp * 19.5;
  return Math.hypot(dx, dy) <= radius;
}

const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;

function drawRock() {
  rctx.clearRect(0, 0, ROCK_GRID, ROCK_GRID);
  if (!rock) return;
  const r = rock;
  const dark = [22, 14, 30];
  const base = [122, 106, 140];
  const light = [184, 170, 200];
  const shadow = [70, 56, 88];
  const body = mix(dark, base, r.shade);
  const hi = mix(dark, light, r.shade);
  const lo = mix(dark, shadow, r.shade);
  for (let y = 0; y < ROCK_GRID; y++) {
    for (let x = 0; x < ROCK_GRID; x++) {
      if (!insideRock(r, x, y)) continue;
      // Light from the top left: edge pixels facing it are bright, the others dark
      const upLeft = !insideRock(r, x - 2, y - 2);
      const downRight = !insideRock(r, x + 2, y + 2);
      rctx.fillStyle = upLeft ? hi : downRight ? lo : body;
      rctx.fillRect(x, y, 1, 1);
      if (!insideRock(r, x - 1, y) || !insideRock(r, x + 1, y) || !insideRock(r, x, y - 1) || !insideRock(r, x, y + 1)) {
        rctx.fillStyle = "#160828";
        rctx.fillRect(x, y, 1, 1);
      }
    }
  }
  for (const s of r.specks) {
    if (!insideRock(r, s.x, s.y)) continue;
    rctx.fillStyle = s.color;
    rctx.fillRect(s.x, s.y, s.size, s.size);
  }
  // Cracks grow as health drops
  const damage = 1 - Math.max(0, r.hp) / r.maxHp;
  rctx.fillStyle = "#0b0518";
  r.cracks.forEach((path, ci) => {
    const shown = Math.floor(path.length * clamp01(damage * 1.6 - ci * 0.12));
    for (let i = 0; i < shown; i++) {
      const [x, y] = path[i];
      if (insideRock(r, x, y)) rctx.fillRect(x, y, 1, 1);
    }
  });
}

// Six ways to wiggle, calm to frantic. Each returns an offset in -1..1 for the pit
const tri = (p) => (2 / Math.PI) * Math.asin(Math.sin(p));
const PATTERNS = [
  (p) => [0.35 * Math.sin(p), 0.12 * Math.sin(2 * p)],
  (p) => [0.55 * Math.sin(p), 0.35 * Math.sin(2 * p)],
  (p) => [0.6 * Math.cos(p * 1.2), 0.5 * Math.sin(p * 1.2)],
  (p) => [0.8 * tri(p * 0.9), 0.45 * Math.sin(p * 2.6)],
  (p) => [0.85 * Math.sin(p * 1.6), 0.6 * Math.sin(p * 2.4 + 1)],
  (p) => [0.8 * Math.sin(p * 2.1) + 0.15 * Math.sin(p * 7), 0.65 * Math.sin(p * 3.1) + 0.15 * Math.cos(p * 5)],
];
// Radians per second at full speed
const WIGGLE_SPEED = 1.8;

let pitW = 0;
let pitH = 0;
function measurePit() {
  pitW = pit.clientWidth;
  pitH = pit.clientHeight;
}
measurePit();
window.addEventListener("resize", measurePit);

let lastFrame = performance.now();
let knock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (rock) {
    // Slow motion calms every rock; a harder rock also wiggles slower (easier to hit)
    const calm = phase === "mining" ? 1 : 0.25;
    const speed = (stat("slowMotion") / 100) * (1 / (1 + rock.hardness * 0.02)) * calm;
    rock.phase += dt * WIGGLE_SPEED * speed;
    const [ox, oy] = PATTERNS[rock.pattern](rock.phase);
    const half = ROCK_PX / 2;
    rock.x = pitW / 2 + ox * Math.max(0, pitW / 2 - half);
    rock.y = pitH / 2 + oy * Math.max(0, pitH / 2 - half);
    knock *= 0.8;
    const jitter = knock > 0.5 ? (Math.random() - 0.5) * knock : 0;
    rockCanvas.style.transform = `translate(${rock.x - half + jitter}px, ${rock.y - half + jitter}px)`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- Mining ---------- */

let holding = false;
let pointer = null;
let swingTimer = null;
let lastMissFloat = 0;

// Pointer position inside the pit, undoing the stage's fit-to-screen scaling
function pitPoint(e) {
  const rect = pit.getBoundingClientRect();
  const scale = rect.width / Math.max(1, pit.offsetWidth);
  return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale, cx: e.clientX, cy: e.clientY };
}

pit.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (phase === "idle") {
    nudgeButton();
    return;
  }
  holding = true;
  pointer = pitPoint(e);
  try {
    pit.setPointerCapture(e.pointerId);
  } catch {
    // Older browsers: holding still works while the pointer stays over the pit
  }
  swing();
  clearInterval(swingTimer);
  swingTimer = setInterval(() => holding && swing(), SWING_MS);
});
pit.addEventListener("pointermove", (e) => {
  if (holding) pointer = pitPoint(e);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  pit.addEventListener(type, () => {
    holding = false;
    clearInterval(swingTimer);
  });
}

function swing() {
  if (phase !== "mining" || !rock || rock.broken || !pointer) return;
  const dist = Math.hypot(pointer.x - rock.x, pointer.y - rock.y);
  if (dist > HIT_RADIUS) {
    SOUND.miss();
    const now = performance.now();
    if (now - lastMissFloat > 400) {
      lastMissFloat = now;
      floatText(pointer.cx, pointer.cy, "miss", "miss");
    }
    return;
  }
  hit();
}

function hit() {
  // RogueMiner: damage from strength and pickaxe against hardness, agility steadies it,
  // and three nested rolls pick a crit level (0 = a weak 0.4x swing, 8 = a 3.6x smash)
  const base = (stat("strength") * 10 + stat("pickaxe") * 100) / rock.hardness;
  const variance = between(0.9, 1.1) + stat("agility") * 0.01;
  const c1 = range(1, 10);
  const c2 = range(1, c1);
  const c3 = range(1, c2);
  const crit = range(0, c3);
  const damage = base * variance * ((crit + 1) / 2.5);

  rock.hp -= damage;
  run.hits++;
  run.bestHit = Math.max(run.bestHit, damage);
  knock = 4 + crit * 3;
  SOUND.hit(crit);
  floatText(pointer.cx, pointer.cy - 20, fmt(Math.max(1, damage)), `c${crit}`);
  burst(pointer.cx, pointer.cy, 3 + crit * 2, ["#7a6a8c", "#b8aac8", "#4d405c", ...(crit >= 4 ? ["#ffcf4a"] : [])], 0.6);
  if (crit >= 5) showToast(crit >= 7 ? "MEGA CRIT!" : "CRIT!", 4 + crit / 2);
  drawRock();
  renderHp();
  if (rock.hp <= 0) breakRock();
}

async function breakRock() {
  rock.broken = true;
  phase = "busy";
  const r = rock;
  const at = rockCenter();
  SOUND.crumble();
  burst(at.x, at.y, 40, ["#7a6a8c", "#b8aac8", "#4d405c", "#160828", RARITY_COLORS[Math.min(4, Math.floor(r.rarity / 2.5))]]);
  rockCanvas.animate([{ opacity: 1, filter: "brightness(2)" }, { opacity: 0, filter: "brightness(1)" }], { duration: 250, fill: "forwards" });

  // Score: RogueMiner's 80 per rock, raised by dimension, luck and player power
  const worldMult = 1 + (stat("worldLevel") - 1) * 0.2;
  const luckMult = 1 + stat("luck") * 0.01;
  const gain = Math.round(80 * worldMult * luckMult * (stat("power") / 100) * between(0.75, 1.25));
  addScore(gain);
  floatText(at.x, at.y - 30, `+${fmt(gain)}`, "gold");
  run.rocks--;
  run.mined++;
  state.stats.minedStones++;

  const item = rollLoot(r);
  addItem(item.id);
  run.finds[item.id] = (run.finds[item.id] || 0) + 1;
  await wait(180);
  floatText(at.x, at.y - 70, `${RARITY_NAMES[item.rarity]}: ${item.name}`, `loot r${item.rarity}`);
  SOUND.drop(item.rarity);
  if (item.rarity >= 3) {
    showToast(`${RARITY_NAMES[item.rarity]}!\n${item.name.toUpperCase()}`, item.rarity === 4 ? 9 : 7, true);
    sparkles(at.x, at.y, item.rarity === 4 ? 60 : 30);
    if (item.rarity === 4) celebrate();
  }
  renderRun();
  checkAchievements();
  persist();
  await wait(350);

  if (run.score >= run.goal) await levelUp();
  if (run.rocks <= 0) {
    await gameOver();
    return;
  }
  spawnRock();
}

function rockCenter() {
  const rect = rockCanvas.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// RogueMiner's loot table: every rarity always has a chance, and luck (the rock's, its
// rarity, insight and the player's) slides all of them toward an even 20% each
function rollLoot(r) {
  const progress = clamp01((r.luck / 50 + r.rarity / 10 + stat("rockLevel") / 100 + stat("luck") / 1601) / 4);
  const chances = [
    [4, lerp(0.001, 0.2, progress)],
    [3, lerp(0.01, 0.2, progress)],
    [2, lerp(0.075, 0.2, progress)],
    [1, lerp(0.154, 0.2, progress)],
  ];
  let roll = Math.random();
  let rarity = 0;
  for (const [rar, chance] of chances) {
    if (roll < chance) {
      rarity = rar;
      break;
    }
    roll -= chance;
  }
  return pick(ITEMS.filter((i) => i.rarity === rarity));
}

function addScore(points) {
  const prev = run.total;
  run.score += points;
  run.total += points;
  countUp(totalEl, prev, run.total);
  bump(scoreEl);
  state.stats.scoreHigh = Math.max(state.stats.scoreHigh, run.score);
  state.stats.totalHigh = Math.max(state.stats.totalHigh, run.total);
}

function spawnRock() {
  rock = makeRock();
  drawRock();
  rockCanvas.getAnimations().forEach((a) => a.cancel());
  // Scale, not transform: the transform is the rock's position, set every frame
  rockCanvas.animate([{ scale: "0.2", opacity: 0 }, { scale: "1", opacity: 1 }], { duration: 200, easing: "steps(4)" });
  hardnessEl.textContent = rock.hardness;
  rarityEl.textContent = `${rock.rarity}/10`;
  renderHp();
  phase = "mining";
  updateHint();
}

async function levelUp() {
  run.level++;
  run.score = 0;
  run.rocks = rocksForLevel(run.level);
  run.goal = goalFor(run.level);
  if (run.level > state.stats.levelHigh) state.stats.levelHigh = run.level;
  setDepth(run.level);
  cartRumble(1.2);
  ding(0.08, 1.1);
  const tier = tierFor(run.level);
  const banner = document.createElement("div");
  banner.className = "panel level-banner";
  banner.innerHTML = `<small>&#9660; DEEPER &#9660;</small><b>LEVEL ${run.level}</b><span>${run.rocks} rocks &middot; goal ${fmt(run.goal)}</span>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2300);
  if (tierFor(run.level - 1) < tier) {
    setTimeout(() => {
      showToast(`${TIERS[tier].name} DEPTHS`, tier, true);
      victory(tier);
      celebrate();
    }, 900);
  }
  setMessage(`> level ${run.level}. the air gets thinner...`, true);
  renderRun();
  checkAchievements();
  persist();
  await wait(1200);
}

function setDepth(level) {
  const root = document.documentElement;
  root.style.setProperty("--depth", `${(level - 1) * 120}px`);
  root.style.setProperty("--level-color", TIERS[tierFor(level)].color);
  depthLabelEl.textContent = level;
  rockDepthEl.textContent = `LV ${level}`;
  paintTier(levelEl, tierFor(level));
  if (level > topLevel) {
    topLevel = level;
    topLevelEl.textContent = topLevel;
    bump(topLevelEl);
  }
}

function startRun() {
  state.stats.gameStarts++;
  run = state.run = {
    level: 1,
    score: 0,
    total: 0,
    rocks: START_ROCKS,
    goal: goalFor(1),
    mined: 0,
    hits: 0,
    bestHit: 0,
    finds: {},
  };
  gameoverEl.classList.remove("show");
  setDepth(1);
  renderRun();
  setButton("mining");
  setMessage("> swing away!");
  SOUND.combo();
  checkAchievements();
  persist();
  spawnRock();
}

// A run saved mid-way (closed tab, reload) picks up where it left off
function resumeRun() {
  setDepth(run.level);
  renderRun();
  setButton("mining");
  setMessage("> back in the mine. your rocks waited for you");
  spawnRock();
}

/* ---------- Game over ---------- */

const gameoverEl = $("gameover");
const goCard = $("go-card");

async function gameOver() {
  phase = "busy";
  rock = null;
  drawRock();
  hpText.textContent = "OUT OF ROCKS";
  hpFill.style.width = "0";
  SOUND.sad();
  setMessage("> out of rocks. the cart heads back up");
  await wait(900);

  const final = run;
  const tier = tierFor(final.level);
  state.run = null;
  persist();

  paintTier(goCard, tier);
  const scoreOut = $("go-score");
  paintTier(scoreOut, tier);
  $("go-tier").textContent = TIERS[tier].name;
  $("go-title").textContent = `${TIERS[tier].title}: "${TIERS[tier].verdict}"`;
  $("go-level").textContent = final.level;
  $("go-best-level").textContent = state.stats.levelHigh;
  $("go-rocks").textContent = final.mined;
  $("go-hits").textContent = final.hits;
  $("go-crit").textContent = fmt(final.bestHit);
  $("go-short").textContent = fmt(Math.max(0, final.goal - final.score));
  $("go-ladder").innerHTML = TIERS.map((t, i) => `<span style="--c:${t.color}" class="${i <= tier ? "on" : ""}"></span>`).join("");
  const finds = Object.entries(final.finds)
    .map(([id, n]) => [ITEM_BY_ID[id], n])
    .filter(([item]) => item)
    .sort((a, b) => b[0].rarity - a[0].rarity || b[1] - a[1]);
  $("go-finds").innerHTML = finds.length
    ? finds.map(([item, n]) => `<span class="chip r${item.rarity}">${item.name}${n > 1 ? ` <b>x${n}</b>` : ""}</span>`).join("")
    : `<span class="lb-empty">nothing. not even a pebble</span>`;
  $("go-entry").hidden = true;

  run = null;
  phase = "idle";
  setButton("idle");
  renderRun();
  updateHint();

  gameoverEl.classList.add("show");
  scoreOut.textContent = "0";
  await countUp(scoreOut, 0, final.total, 1200);
  victory(tier);
  if (tier >= 3) celebrate();
  offerLeaderboard(final, tier);
}

// Tapping beside the card puts it away (to look at the cave, the bag or the shop)
gameoverEl.addEventListener("click", (e) => {
  if (e.target === gameoverEl) gameoverEl.classList.remove("show");
});

/* ---------- Leaderboard ---------- */

const LB_KEY = "minele-leaderboard";
const LB_SIZE = 10;

function loadBoard() {
  try {
    const list = JSON.parse(localStorage.getItem(LB_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveBoard(list) {
  try {
    localStorage.setItem(LB_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable; the board just won't persist
  }
}

function rememberedInitials() {
  try {
    return localStorage.getItem("minele-initials") || "";
  } catch {
    return "";
  }
}

// Top-10 run? The game-over card offers SAVE (under the remembered initials), EDIT (type
// new ones) or SKIP
function offerLeaderboard(final, tier) {
  const board = loadBoard();
  const rank = board.filter((e) => e.score >= final.total).length + 1;
  if (rank > LB_SIZE || final.total <= 0) return;
  const entry = $("go-entry");
  const input = $("go-initials");
  $("go-entry-title").textContent = rank === 1 ? "NEW #1 HIGH SCORE!" : `HIGH SCORE #${rank}!`;
  entry.hidden = false;
  entry.dataset.score = final.total;
  entry.dataset.tier = tier;
  entry.dataset.level = final.level;
  input.value = rememberedInitials();
  $("go-entry-name").textContent = input.value || "???";
  $("go-entry-actions").hidden = false;
  $("go-edit-row").hidden = true;
  entry.animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: "cubic-bezier(.3, 1.6, .5, 1)" });
  arp([523, 659, 784, 1047], 0.08, { type: "triangle", vol: 0.05 });
}

$("go-initials").addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
});

function submitInitials() {
  const entry = $("go-entry");
  const name = ($("go-initials").value || "???").padEnd(3, "?");
  try {
    localStorage.setItem("minele-initials", name);
  } catch {
    // ignore
  }
  const board = loadBoard();
  const record = {
    name,
    score: Number(entry.dataset.score),
    tier: Number(entry.dataset.tier),
    level: Number(entry.dataset.level),
    date: new Date().toISOString().slice(0, 10),
  };
  board.push(record);
  board.sort((a, b) => b.score - a.score);
  saveBoard(board.slice(0, LB_SIZE));
  entry.hidden = true;
  SOUND.combo();
  showLeaderboard(record);
}

function editInitials() {
  $("go-entry-actions").hidden = true;
  $("go-edit-row").hidden = false;
  const input = $("go-initials");
  input.focus();
  input.select();
}

$("go-save").addEventListener("click", () => (rememberedInitials() ? submitInitials() : editInitials()));
$("go-edit").addEventListener("click", editInitials);
$("go-edit-save").addEventListener("click", submitInitials);
$("go-skip").addEventListener("click", () => {
  $("go-entry").hidden = true;
});
$("go-initials").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitInitials();
});

function showLeaderboard(highlight) {
  const board = loadBoard();
  const rows = board.length
    ? board
        .map((e, i) => {
          const t = TIERS[Math.min(9, Math.max(0, e.tier || 0))];
          const mine = highlight && e.name === highlight.name && e.score === highlight.score && e.date === highlight.date;
          return `<tr class="${mine ? "mine" : ""}" style="--tc:${t.color}">
            <td>${i + 1}</td><td class="lb-name">${e.name}</td>
            <td class="lb-score">${fmt(e.score)}</td>
            <td class="lb-tier">${t.name}</td><td>LV ${e.level ?? "-"}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="lb-empty">No runs yet. The rocks are waiting!</td></tr>`;
  $("lb-rows").innerHTML = rows;
  openModal("leaderboard");
}

/* ---------- Bag: sell finds ---------- */

let bagTab = 0;
let bagSelected = null;

// Which upgrades want this item for their next level
function neededBy(id) {
  return UPGRADES.filter((u) => {
    const level = upgradeLevel(u.id);
    if (level >= u.max) return false;
    return u.costs[level].slice(1).some(([itemId]) => itemId === id);
  });
}

function renderBag() {
  const discovered = ITEMS.filter((i) => everFound(i.id) > 0).length;
  $("bag-count").textContent = discovered;
  $("bag-tabs").innerHTML = RARITY_GROUPS.map((g, r) => {
    const group = ITEMS.filter((i) => i.rarity === r);
    const found = group.filter((i) => everFound(i.id) > 0).length;
    return `<button type="button" class="tab r${r} ${r === bagTab ? "on" : ""}" data-tab="${r}">${g} ${found}/${group.length}</button>`;
  }).join("");
  $("bag-grid").innerHTML = ITEMS.filter((i) => i.rarity === bagTab)
    .map((i) => {
      const known = everFound(i.id) > 0;
      const cls = `item r${i.rarity}${known ? "" : " unknown"}${known && !available(i.id) ? " empty" : ""}${bagSelected === i.id ? " sel" : ""}`;
      return `<button type="button" class="${cls}" data-id="${i.id}" ${known ? "" : "disabled"}>
        <span class="gem"></span>${known ? i.name : "???"}<span class="qty">${known ? "x" + available(i.id) : ""}</span></button>`;
    })
    .join("");
  renderDetail();
}

function renderDetail() {
  const box = $("bag-detail");
  const item = bagSelected && ITEM_BY_ID[bagSelected];
  if (!item) {
    box.hidden = true;
    return;
  }
  const have = available(item.id);
  const wanted = neededBy(item.id);
  box.hidden = false;
  box.className = `detail r${item.rarity}`;
  box.innerHTML = `<h4>${item.name} &middot; ${RARITY_NAMES[item.rarity]}</h4>
    <p>${item.desc}</p>
    <p>In the bag <b>${have}</b> &middot; ever found <b>${everFound(item.id)}</b> &middot; sells for <b>${item.sell}</b> gold each</p>
    ${wanted.length ? `<p>&#9888; The shop wants it for: ${wanted.map((u) => u.name).join(", ")}</p>` : ""}
    <div class="row">
      <button type="button" class="panel small-btn" data-sell="1" ${have ? "" : "disabled"}>SELL 1 (+${item.sell})</button>
      <button type="button" class="panel small-btn" data-sell="all" ${have ? "" : "disabled"}>SELL ALL (+${fmt(have * item.sell)})</button>
    </div>`;
}

$("bag-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-tab]");
  if (!tab) return;
  bagTab = Number(tab.dataset.tab);
  bagSelected = null;
  SOUND.pop();
  renderBag();
});
$("bag-grid").addEventListener("click", (e) => {
  const el = e.target.closest("[data-id]");
  if (!el || el.disabled) return;
  bagSelected = el.dataset.id;
  sfx(600, 0.05, { vol: 0.03 });
  renderBag();
});
$("bag-detail").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sell]");
  if (!btn || btn.disabled) return;
  const item = ITEM_BY_ID[bagSelected];
  const n = btn.dataset.sell === "all" ? available(item.id) : 1;
  if (!spendItem(item.id, n)) return;
  addGold(n * item.sell);
  SOUND.coin();
  const { x, y } = centerOf(btn);
  floatText(x, y, `+${fmt(n * item.sell)} G`, "gold");
  checkAchievements();
  persist();
  renderBag();
  renderShopBadge();
});

/* ---------- Shop: upgrades ---------- */

function costOf(u) {
  const level = upgradeLevel(u.id);
  if (level >= u.max) return null;
  const [gold, ...items] = u.costs[level];
  return { gold, items };
}

function canAfford(u) {
  const cost = costOf(u);
  return !!cost && state.gold >= cost.gold && cost.items.every(([id, n]) => available(id) >= n);
}

function renderShop() {
  $("shop-list").innerHTML = UPGRADES.map((u) => {
    const level = upgradeLevel(u.id);
    const cost = costOf(u);
    const now = level ? u.values[level - 1] : BASE_STATS[u.stat];
    const effect = cost
      ? `${STAT_LABELS[u.stat]} <span class="effect">${fmt(now)} &rarr; ${fmt(u.values[level])}</span>`
      : `${STAT_LABELS[u.stat]} <span class="effect">${fmt(now)}</span> &middot; MAXED`;
    const chips = cost
      ? [`<span class="chip ${state.gold >= cost.gold ? "" : "short"}" style="--rc:var(--gold);color:var(--gold)">${fmt(cost.gold)} G</span>`]
          .concat(
            cost.items.map(([id, n]) => {
              const item = ITEM_BY_ID[id];
              return `<span class="chip r${item.rarity} ${available(id) >= n ? "" : "short"}">${item.name} <b>${available(id)}/${n}</b></span>`;
            })
          )
          .join("")
      : "";
    return `<div class="upgrade ${canAfford(u) ? "can" : ""}">
      <div><h4>${u.name}</h4><span class="lvl">LV ${level}/${u.max}</span></div>
      <button type="button" class="panel small-btn" data-buy="${u.id}" ${canAfford(u) ? "" : "disabled"}>${cost ? "BUY" : "MAX"}</button>
      <p>${u.desc}</p>
      <p>${effect}</p>
      <div class="cost">${chips}</div>
    </div>`;
  }).join("");
}

$("shop-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-buy]");
  if (!btn) return;
  const u = UPGRADE_BY_ID[btn.dataset.buy];
  if (!canAfford(u)) {
    SOUND.deny();
    return;
  }
  const cost = costOf(u);
  state.gold -= cost.gold;
  for (const [id, n] of cost.items) spendItem(id, n);
  state.upgrades[u.id] = upgradeLevel(u.id) + 1;
  SOUND.combo();
  const { x, y } = centerOf(btn);
  sparkles(x, y, 24);
  floatText(x, y, `LV ${upgradeLevel(u.id)}!`, "gold");
  renderGold();
  checkAchievements();
  persist();
  renderShop();
  renderShopBadge();
});

function renderShopBadge() {
  const n = UPGRADES.filter(canAfford).length;
  $("shop-ready").textContent = n ? `(${n})` : "";
}

/* ---------- Achievements ---------- */

function achievementMet(a) {
  const s = state.stats;
  switch (a.type) {
    case "minedStones": return s.minedStones >= a.n;
    case "goldEarned": return s.goldEarned >= a.n;
    case "itemCollected": return everFound(a.item) >= a.n;
    case "distinctItems": return ITEMS.filter((i) => everFound(i.id) > 0).length >= a.n;
    case "distinctUpgrades": return UPGRADES.filter((u) => upgradeLevel(u.id) > 0).length >= a.n;
    case "upgradeLevels": return UPGRADES.reduce((sum, u) => sum + upgradeLevel(u.id), 0) >= a.n;
    case "upgradeLevel": return upgradeLevel(a.upgrade) >= a.n;
    case "gameStarts": return s.gameStarts >= a.n;
    case "rarityCollected": return ITEMS.filter((i) => i.rarity === a.rarity).reduce((sum, i) => sum + everFound(i.id), 0) >= a.n;
    case "rarityDistinct": return ITEMS.filter((i) => i.rarity === a.rarity && everFound(i.id) > 0).length >= a.n;
    case "levelHighscore": return s.levelHigh >= a.n;
    case "allItemsAtLeast": return ITEMS.every((i) => everFound(i.id) >= a.n);
    case "allUpgradesMaxed": return UPGRADES.every((u) => upgradeLevel(u.id) >= u.max);
    case "rockLevel": return stat("rockLevel") >= a.n;
    case "worldLevel": return stat("worldLevel") >= a.n;
    default: return false;
  }
}

// New unlocks queue up and slide in one after another
let achQueue = [];
let achShowing = false;
function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (state.ach[a.id] || !achievementMet(a)) continue;
    state.ach[a.id] = true;
    achQueue.push(a);
  }
  renderAchCount();
  if (!achShowing) showNextAchievement();
}

async function showNextAchievement() {
  const a = achQueue.shift();
  if (!a) {
    achShowing = false;
    return;
  }
  achShowing = true;
  const el = document.createElement("div");
  el.className = "panel ach-toast";
  el.innerHTML = `<small>&#127941; ACHIEVEMENT</small><b>${a.name}</b>`;
  document.body.appendChild(el);
  SOUND.trophy();
  await wait(3300);
  el.remove();
  showNextAchievement();
}

function renderAchCount() {
  const n = Object.keys(state.ach).length;
  $("ach-short").textContent = `${n}/${ACHIEVEMENTS.length}`;
  $("ach-count").textContent = `${n} of ${ACHIEVEMENTS.length}`;
}

function renderAchievements() {
  $("ach-list").innerHTML = ACHIEVEMENTS.slice()
    .sort((a, b) => Number(!!state.ach[b.id]) - Number(!!state.ach[a.id]))
    .map((a) => `<div class="ach ${state.ach[a.id] ? "on" : ""}"><b>${state.ach[a.id] ? "&#10004; " : ""}${a.name}</b>${a.desc}</div>`)
    .join("");
}

/* ---------- Scoreboard & effects ---------- */

function renderGold() {
  goldEl.textContent = fmt(state.gold);
}

function renderRun() {
  const r = run || { level: 1, score: 0, total: 0, rocks: START_ROCKS, goal: goalFor(1) };
  levelEl.textContent = r.level;
  scoreEl.textContent = fmt(r.score);
  goalEl.textContent = fmt(r.goal);
  rocksEl.textContent = r.rocks;
  totalEl.textContent = fmt(r.total);
  const progress = clamp01(r.score / r.goal);
  goalFill.style.width = `${progress * 100}%`;
  goalFill.classList.toggle("full", progress >= 1);
  // Few rocks left and the goal still far away: the counter warns
  rocksEl.classList.toggle("low", !!run && r.rocks <= 3 && progress < 1);
  renderShopBadge();
}

function renderHp() {
  if (!rock) return;
  const left = Math.max(0, rock.hp);
  hpFill.style.width = `${(left / rock.maxHp) * 100}%`;
  hpText.textContent = left > 0 ? `${fmt(Math.ceil(left))} / ${fmt(rock.maxHp)} HP` : "DESTROYED!";
}

function bump(el) {
  el.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], {
    duration: 350,
    easing: "steps(3)",
  });
}

function countUp(el, from, to, duration = 450) {
  const start = performance.now();
  return new Promise((resolve) => {
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

function showToast(text, tier = 9, long = false) {
  toastEl.textContent = text;
  paintTier(toastEl, Math.min(9, Math.round(tier)));
  toastEl.classList.remove("show");
  toastEl.classList.toggle("long", long);
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
}

function setMessage(text, win = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("win", win);
}

function floatText(x, y, text, cls = "") {
  const el = document.createElement("div");
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${x + (Math.random() - 0.5) * 30}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// The big button: NEW RUN when idle, a reminder while mining
function setButton(mode) {
  rollBtn.classList.toggle("mining", mode === "mining");
  rollBtn.innerHTML =
    mode === "mining"
      ? '&#9935; TAP THE ROCK &#9935;<span class="auto">hold to keep swinging</span>'
      : "&#9660; NEW RUN &#9660;";
}

function nudgeButton() {
  rollBtn.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "none" }], { duration: 250 });
  SOUND.blub();
}

/* ---------- Help hints ---------- */

const hintEl = $("hint");
function setHint(text) {
  if (hintEl.textContent === text) return;
  hintEl.textContent = text;
  hintEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
}

function updateHint() {
  if (!run) {
    setHint("Tap NEW RUN to play. New here? The ? button explains everything.");
    return;
  }
  const need = run.goal - run.score;
  if (run.rocks <= 3 && need > 0) {
    setHint(`Only ${run.rocks} rock${run.rocks > 1 ? "s" : ""} left and ${fmt(need)} to go. Make them count!`);
  } else if (rock && rock.hardness >= 30) {
    setHint(`Hardness ${rock.hardness}: a tough one, but it wiggles slower. Hold on it and keep swinging.`);
  } else {
    setHint(`Tap or hold on the rock. Reach ${fmt(run.goal)} before your ${run.rocks} rocks run out.`);
  }
}

/* ---------- Modals ---------- */

function openModal(id) {
  const m = $(id);
  m.hidden = false;
  // Only the box pops in; the backdrop is never faded, so it can't get stuck see-through
  m.querySelector(".modal-box").animate([{ transform: "scale(.9)" }, { transform: "none" }], { duration: 200 });
  m.querySelector(".modal-close").focus();
}

function closeModal(id) {
  $(id).hidden = true;
}

for (const m of document.querySelectorAll(".modal")) {
  m.querySelector(".modal-close").addEventListener("click", () => closeModal(m.id));
  m.addEventListener("click", (e) => {
    if (e.target === m) closeModal(m.id);
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
});

function openBag() {
  renderBag();
  openModal("bag");
}
function openShop() {
  renderShop();
  openModal("shop");
}

$("lb-btn").addEventListener("click", () => showLeaderboard());
$("help-btn").addEventListener("click", () => openModal("help"));
$("bag-btn").addEventListener("click", openBag);
$("shop-btn").addEventListener("click", openShop);
$("gold").addEventListener("click", openShop);
$("go-bag").addEventListener("click", openBag);
$("go-shop").addEventListener("click", openShop);
$("ach-btn").addEventListener("click", () => {
  renderAchievements();
  openModal("trophies");
});
$("lb-clear").addEventListener("click", () => {
  if (confirm("Clear this device's leaderboard?")) {
    saveBoard([]);
    showLeaderboard();
  }
});

// The tier table in the help screen
$("tier-rows").innerHTML = TIERS.map(
  (t, i) => `<tr style="--tc:${t.color}"><td class="lb-tier">${t.name}</td><td>${t.title}<br><i>“${t.verdict}”</i></td>
    <td class="lb-score">LV ${LEVEL_TIERS[i]}+</td></tr>`
).join("");

$("version").textContent = "v" + VERSION;

/* ---------- Flashy toggle ---------- */

let flashy = load("minele-flashy") === 1;
const flashyBtn = $("flashy");
function applyFlashy() {
  document.documentElement.classList.toggle("flashy", flashy);
  flashyBtn.setAttribute("aria-pressed", String(flashy));
}
applyFlashy();
flashyBtn.addEventListener("click", () => {
  flashy = !flashy;
  save("minele-flashy", flashy ? 1 : 0);
  applyFlashy();
  SOUND.pop();
});

/* ---------- The big button ---------- */

function play() {
  if (phase === "idle") startRun();
  else if (phase === "mining") {
    setMessage("> the rock's in the cave. tap it!");
    pit.animate([{ outline: "3px solid #ffcf4a" }, { outline: "3px solid transparent" }], { duration: 600, easing: "steps(3)" });
  }
}
rollBtn.addEventListener("click", play);
$("new-game").addEventListener("click", () => {
  if (phase === "idle") startRun();
});
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" && e.code !== "Enter") return;
  // Typing initials or using another button: leave the key alone
  const el = document.activeElement;
  if (el && (el.tagName === "INPUT" || (el.tagName === "BUTTON" && el !== rollBtn))) return;
  if (phase === "idle" && !document.querySelector(".modal:not([hidden])")) {
    e.preventDefault();
    startRun();
  }
});

/* ---------- Keep the screen awake ---------- */

let wakeLock = null;
async function keepAwake() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible" || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => (wakeLock = null));
  } catch {
    // Not allowed right now (battery saver, no gesture yet): try again on the next tap
    wakeLock = null;
  }
}
document.addEventListener("visibilitychange", keepAwake);
window.addEventListener("pointerdown", keepAwake);
keepAwake();

/* ---------- Fit the whole game into 90% of the screen, no scrolling ---------- */

const stageEl = $("stage");
function fitStage() {
  const natural = stageEl.offsetHeight; // layout size, not affected by the transform
  const avail = window.innerHeight * 0.9 - stageEl.offsetTop;
  const scale = Math.min(1, avail / Math.max(natural, 1));
  stageEl.style.transform = scale < 1 ? `scale(${scale.toFixed(4)})` : "";
}
window.addEventListener("resize", fitStage);
window.addEventListener("orientationchange", () => setTimeout(fitStage, 200));
if (window.ResizeObserver) new ResizeObserver(fitStage).observe(stageEl);
fitStage();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitStage);

// A big score gets a smaller font instead of being cut off
function fitValue(el) {
  el.style.fontSize = "";
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > 5) {
    size -= 0.5;
    el.style.fontSize = `${size}px`;
  }
}
const statValues = [...document.querySelectorAll(".stat .value")];
const fitObserver = new MutationObserver((records) => {
  for (const el of new Set(records.map((r) => (r.target.nodeType === 1 ? r.target : r.target.parentElement)))) fitValue(el);
});
for (const el of statValues) {
  fitObserver.observe(el, { childList: true, characterData: true, subtree: true });
  fitValue(el);
}
addEventListener("resize", () => statValues.forEach(fitValue));

/* ---------- Splash ---------- */

const splashEl = $("splash");
$("splash-help").addEventListener("click", (e) => {
  e.stopPropagation();
  audio();
  SOUND.pop();
  openModal("help");
});
splashEl.addEventListener("click", () => {
  audio();
  keepAwake();
  SOUND.combo();
  splashEl.style.pointerEvents = "none";
  splashEl.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(1.1)" }], { duration: 400, fill: "forwards" });
  // Removed on a timer, not on animation end, so it can't get stuck covering the game
  setTimeout(() => splashEl.remove(), 450);
  rollBtn.focus();
});

/* ---------- Falling nuggets you can tap ---------- */

// A nugget drifts by every ~7 seconds, a golden one (worth gold) about every 6 minutes
const MAX_DRIFTERS = reducedMotion ? 2 : 3;
const DRIFT_EVERY_MS = 7000;
const GOLDEN_CHANCE = 0.02;

function spawnDrifter() {
  if (driftEl.childElementCount >= MAX_DRIFTERS) return;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "drifter";
  el.setAttribute("aria-label", "Falling nugget");
  if (Math.random() < GOLDEN_CHANCE) el.classList.add("golden");
  const size = 24 + Math.floor(Math.random() * 4) * 6;
  el.style.left = `${Math.random() * 94}vw`;
  el.style.setProperty("--ds", `${size}px`);
  el.style.setProperty("--dur", `${12 + Math.random() * 12}s`);
  el.style.setProperty("--sway", `${(Math.random() - 0.5) * 120}px`);
  el.style.setProperty("--spin", `${3 + Math.random() * 6}s`);
  const nug = document.createElement("div");
  nug.className = "nugget";
  el.appendChild(nug);
  el.addEventListener("pointerdown", () => popDrifter(el));
  el.addEventListener("animationend", (e) => {
    if (e.target === el || e.animationName === "popspin") el.remove();
  });
  driftEl.appendChild(el);
}

function popDrifter(el) {
  if (el.classList.contains("popped")) return;
  el.classList.add("popped");
  const { x, y } = centerOf(el);
  burst(x, y, 16);
  SOUND.pop();
  if (el.classList.contains("golden")) {
    const gold = 10 + topLevel * 5;
    addGold(gold);
    floatText(x, y, `+${gold} G`, "gold");
    showToast(`GOLDEN NUGGET!\n+${gold} GOLD`, 4);
    SOUND.coin();
    persist();
  } else if (run && phase !== "idle") {
    const points = Math.round(between(5, 15) * (1 + (stat("worldLevel") - 1) * 0.2));
    addScore(points);
    renderRun();
    floatText(x, y, `+${points}`);
  } else {
    floatText(x, y, "shiny!");
  }
}

setInterval(() => {
  if (!document.hidden) spawnDrifter();
}, DRIFT_EVERY_MS);
setTimeout(spawnDrifter, 1500);

/* ---------- Particles ---------- */

const canvas = $("fx");
const ctx = canvas.getContext("2d");
const COLORS = ["#ffcf4a", "#ff3d9a", "#44f0ff", "#d61f35", "#fff2dc", "#1f8a45"];
let particles = [];
let animating = false;

function resize() {
  // 1:1 pixels on purpose: the particles are pixel art
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
window.addEventListener("resize", resize);

function burst(x, y, count, colors = COLORS, power = 1) {
  if (reducedMotion) count = Math.round(count / 4);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (4 + Math.random() * 9) * power;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4 * power,
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.012 + Math.random() * 0.012,
      gravity: 0.35,
      bubble: false,
    });
  }
  start();
}

// Gold sparkles that float up and wobble
function sparkles(x, y, count) {
  if (reducedMotion) count = Math.round(count / 4);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 60,
      y: y + Math.random() * 20,
      vx: 0,
      vy: -1 - Math.random() * 2,
      size: 4 + Math.floor(Math.random() * 3) * 4,
      rot: 0,
      vr: 0,
      phase: Math.random() * Math.PI * 2,
      color: "#ffcf4a",
      life: 1,
      decay: 0.006 + Math.random() * 0.006,
      gravity: -0.02,
      bubble: true,
    });
  }
  start();
}

function start() {
  if (!animating) {
    animating = true;
    requestAnimationFrame(tick);
  }
}

function celebrate() {
  const w = innerWidth;
  burst(w * 0.2, innerHeight * 0.3, 70);
  setTimeout(() => burst(w * 0.8, innerHeight * 0.3, 70), 200);
  setTimeout(() => burst(w * 0.5, innerHeight * 0.2, 90), 400);
}

function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => p.life > 0 && p.y < innerHeight + 40 && p.y > -40);
  for (const p of particles) {
    p.vy += p.gravity;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= p.decay;
    // Snap to a 4px grid so everything reads as pixel art
    const size = Math.round(p.size / 4) * 4;
    let px = Math.round(p.x / 4) * 4;
    const py = Math.round(p.y / 4) * 4;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    if (p.bubble) {
      p.phase += 0.08;
      px += Math.round(Math.sin(p.phase) * 2) * 4;
      // Pixel plus-shaped twinkle
      ctx.fillRect(px - size / 2, py - 2, size, 4);
      ctx.fillRect(px - 2, py - size / 2, 4, size);
    } else {
      // Tumbling chips: flip between full and thin to fake rotation
      const w = Math.abs(Math.cos(p.rot)) > 0.5 ? size : Math.max(4, size / 2);
      ctx.fillRect(px - w / 2, py - size / 2, w, size);
    }
  }
  ctx.globalAlpha = 1;
  if (particles.length) requestAnimationFrame(tick);
  else animating = false;
}

/* ---------- Start ---------- */

renderGold();
renderAchCount();
if (run) {
  resumeRun();
} else {
  setDepth(1);
  renderRun();
  setButton("idle");
  // A resting rock sits in the cave until the run starts
  rock = makeRock();
  rock.pattern = 0;
  drawRock();
  hpText.textContent = "tap NEW RUN";
  updateHint();
}
checkAchievements();
