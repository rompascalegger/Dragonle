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
const stageEl = $("stage");
const darknessEl = $("darkness");

const VERSION = "1.2.0";

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
// Every level is another 50 m down
const METERS_PER_LEVEL = 50;
const depthText = (level) => `-${fmt(level * METERS_PER_LEVEL)} M`;
// How dark it is: 0 at the first level, creeping toward 1 in the abyss
const darkFor = (level) => 1 - 1 / (1 + (level - 1) * 0.12);
// Pairs of eyes watching from the dark: one at the start, more on every level
const eyesFor = (level) => Math.min(90, Math.round(1 + (level - 1) * 1.6));
// Every level's goal is 15% above the last one's
const goalFor = (level) => Math.floor(400 * Math.pow(1.15, level));
// Holding on the rock swings this often
const SWING_MS = 100;
const RARITY_NAMES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
// One symbol per rarity, shown wherever a find appears
const RARITY_SYMBOLS = ["◇", "◆", "✦", "❖", "✸"];

// Balance on top of RogueMiner's numbers: hits land harder, a crit roll never drops below
// 0.6x, and every hit in a row adds 4% (up to 3x at a 50 combo). A miss or a pause breaks it
const DAMAGE_BOOST = 1.5;
const COMBO_STEP = 0.04;
const COMBO_CAP = 50;
const COMBO_WINDOW_MS = 1500;
// About one rock in 25 is a geode: double health, glittering, three boosted finds and lots of gold
const GEODE_CHANCE = 0.04;
// Finds of the plainer rarities come in small stacks
const STACK_SIZES = [[1, 3], [1, 2], [1, 1], [1, 1], [1, 1]];
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
topLevelEl.textContent = depthText(topLevel);

// Whispers in the footer: what you hear changes the deeper you go
const WHISPERS = [
  [
    "The canary is still singing. For now",
    "Mind your head. And your lamp",
    "Keep the lamp lit. Always keep the lamp lit",
    "Every miner hears the knocking eventually",
    "Count your rocks. Not the eyes",
    "The old shafts were sealed for a reason",
  ],
  [
    "The canary stopped singing",
    "Something knocks back",
    "The walls are warmer than they should be",
    "Was that your echo?",
    "Don't count the eyes",
    "The cage cable groans at night",
  ],
  [
    "They have been waiting for you",
    "No one remembers the way up",
    "The eyes don't blink anymore",
    "Dig. They like it when you dig",
    "Your lamp is the only light for miles",
    "You were always going to come down here",
  ],
];
const depthBand = (level) => (level < 5 ? 0 : level < 12 ? 1 : 2);
let jokeIndex = Math.floor(Math.random() * 6);
function nextJoke() {
  const band = depthBand(run ? run.level : 1);
  const lines = WHISPERS[band];
  jokeEl.textContent = "\u2026 " + lines[jokeIndex++ % lines.length] + " \u2026";
  jokeEl.classList.toggle("deep", band === 2);
  jokeEl.animate([{ opacity: 0 }, { opacity: 0.8 }], { duration: 1200, easing: "steps(6)" });
}
nextJoke();
setInterval(nextJoke, 7000);

/* ---------- 8-bit sound ---------- */

let muted = load("minele-sound-off") === 1;
muteBtn.classList.toggle("off", muted);

let audioCtx = null;
let master = null;
let reverb = null;
// Set by depth: every level pitches all sound down half a semitone (an octave at most)
// and adds cave echo
let pitch = 1;
let echo = 0;

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
  osc.frequency.setValueAtTime(freq * pitch, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to * pitch, t + dur);
  if (attack) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  } else {
    gain.gain.setValueAtTime(vol, t);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  send(gain, wet + echo);
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
  send(gain, wet + echo);
  src.start(t);
}

/* ---------- Mine instruments (all synthesized) ---------- */

const semis = (root, s) => root * Math.pow(2, s / 12);

// Every tune in the mine comes from one dark scale: D minor pentatonic, plus the flat second
// that creeps in down deep
const MINE_ROOT = 146.83; // D3
const MINE_SCALE = [0, 3, 5, 7, 10];
function mineNote(degree, octave = 0) {
  const oct = Math.floor(degree / MINE_SCALE.length);
  const step = ((degree % MINE_SCALE.length) + MINE_SCALE.length) % MINE_SCALE.length;
  return semis(MINE_ROOT, 12 * (oct + octave) + MINE_SCALE[step]);
}

// Struck metal: a bell, an anvil or a rail. Inharmonic partials that ring and die away
const METAL_PARTIALS = [[1, 1, 1], [2.76, 0.35, 0.45], [5.4, 0.18, 0.2], [8.93, 0.1, 0.08]];
function metal(freq, dur, { vol = 0.06, delay = 0, wet = 0.4, bright = 1 } = {}) {
  for (const [ratio, gain, length] of METAL_PARTIALS) {
    // Partials above hearing (and the audio limit) are left out
    if (freq * ratio * pitch > 16000) break;
    sfx(freq * ratio, dur * length, { type: "sine", vol: vol * gain * (ratio > 1 ? bright : 1), delay, wet });
  }
  noise(0.012, { vol: vol * 0.6, delay, hp: 4000 });
}

// A pickaxe biting stone: a sharp clink, grit, and a dull thud underneath
function pickaxe(power = 1, delay = 0, wet = 0) {
  noise(0.04, { vol: 0.08 * power, hp: 2500, delay, wet });
  noise(0.08, { vol: 0.12 * power, lp: 500, delay, wet });
  metal(between(1900, 2400), 0.12, { vol: 0.035 * power, delay, wet, bright: 0.6 });
}

// A chain rattling: a run of tiny clinks
function chain(count = 6, delay = 0) {
  for (let i = 0; i < count; i++) metal(between(2600, 3600), 0.05, { vol: 0.015, delay: delay + i * between(0.03, 0.06), wet: 0.2 });
}

// The miner's steam whistle: two detuned voices with a wobble
function whistle(freq, dur, delay = 0, vol = 0.03) {
  for (const d of [1, 1.006]) sfx(freq * d, dur, { type: "triangle", vol, delay, attack: 0.08, wet: 0.5 });
  noise(dur, { vol: vol * 0.6, delay, hp: 3000, attack: 0.08, wet: 0.3 });
}

// Dynamite going off somewhere: a huge low drop you feel more than hear
function boom(delay = 0) {
  sfx(70, 1.8, { type: "sine", vol: 0.6, to: 28, delay, wet: 0.2 });
  noise(0.6, { vol: 0.3, delay, lp: 200, wet: 0.4 });
  // Pebbles raining down after it
  for (let i = 0; i < 6; i++) noise(0.03, { vol: 0.05, delay: delay + 0.3 + i * between(0.06, 0.14), hp: 1800, wet: 0.3 });
}

// The cage going down: a sinking motor, the cable humming, wheels clacking on the guide rails
function cartRumble(dur) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(95 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(48 * pitch, t + dur);
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
  chain(10);
  for (let i = 0; i < dur / 0.16; i++) noise(0.04, { vol: 0.06, delay: i * 0.16, hp: 2500 });
}

// The landing bell
function ding(vol = 0.1, delay = 0) {
  metal(mineNote(10), 1.4, { vol, delay, wet: 0.5 });
}

// Voices from below: soft detuned triangles fading in, mostly echo
function choir(root, chord, dur, delay = 0) {
  for (const s of chord) {
    for (const d of [0.996, 1, 1.004]) {
      sfx(semis(root, s) * d, dur, { type: "triangle", vol: 0.018, delay, attack: dur * 0.35, wet: 0.7 });
    }
  }
}

// A phrase of the mine tune on bells: degrees of the mine scale, null = rest
function bellPhrase(degrees, step, { octave = 0, vol = 0.05, delay = 0, dur = 0.9 } = {}) {
  degrees.forEach((d, i) => {
    if (d !== null) metal(mineNote(d, octave), dur, { vol, delay: delay + i * step, wet: 0.5 });
  });
}

// The miners' work song, the heart of every fanfare: pick, pick, bell
const WORK_SONG = [0, 2, 3, 4, 3, 2, 0, null];

// Victory: the work song on bells over pickaxe strokes, bigger and fuller the higher the tier
function victory(tier) {
  const step = 0.17;
  const lift = Math.min(tier, 9) % 5;
  const song = WORK_SONG.map((d) => (d === null ? null : d + lift));
  boom(0);
  bellPhrase(song, step, { vol: 0.06, delay: 0.1 });
  for (let i = 0; i < song.length; i += 2) pickaxe(0.8, 0.1 + i * step, 0.3);
  metal(mineNote(lift, -1), 2.4, { vol: 0.09, delay: 0.1 + song.length * step, wet: 0.6 });
  if (tier >= 3) {
    bellPhrase(song, step, { octave: 1, vol: 0.03, delay: 0.1 + step / 2 });
    choir(mineNote(lift, -1), [0, 7, 12], 3.2, 0.4);
  }
  if (tier >= 6) {
    whistle(mineNote(lift + 4, 1), 1.2, 0.1 + song.length * step);
    chain(12, 0.2);
  }
}

const kick = (delay) => sfx(150, 0.35, { type: "sine", vol: 0.5, to: 40, delay });

const SOUND = {
  // The pickaxe strike: harder crits bite deeper, and each hit in a combo rings the next
  // bell of the mine tune, climbing the scale
  hit: (crit, chainLength) => {
    pickaxe(0.8 + crit * 0.12);
    if (chainLength >= 3) metal(mineNote(Math.min(chainLength - 3, 14), 1), 0.35, { vol: 0.03, wet: 0.3 });
    if (crit >= 3) metal(mineNote(4 + crit, 1), 0.5, { vol: 0.03 + crit * 0.005, wet: 0.4 });
    if (crit >= 5) kick(0);
  },
  // Pick whooshing through empty air
  miss: () => noise(0.08, { vol: 0.03, hp: 900 }),
  // The rock gives way: a heavy thud and gravel pouring
  crumble: () => {
    noise(0.45, { vol: 0.28, lp: 700 });
    sfx(110, 0.35, { type: "triangle", vol: 0.15, to: 40 });
    for (let i = 0; i < 7; i++) noise(0.03, { vol: 0.06, delay: 0.08 + i * between(0.03, 0.07), hp: 1600 });
  },
  // Finds ring out on bells, longer phrases for rarer finds
  drop: (r) => {
    if (r === 0) metal(mineNote(2), 0.5, { vol: 0.04 });
    else if (r === 1) bellPhrase([5, 7], 0.09, { vol: 0.05 });
    else if (r === 2) bellPhrase([5, 7, 9, 10], 0.08, { vol: 0.05 });
    // Epic: a falling line, wrong somehow, with voices underneath
    else if (r === 3) {
      bellPhrase([12, 11, 9, 8, 5], 0.11, { vol: 0.05, dur: 1.2 });
      choir(mineNote(0, -1), [0, 1, 7], 2.4, 0.2);
    } else {
      // Legendary: the deep bell tolls three times, then the whole scale cascades up
      for (let i = 0; i < 3; i++) metal(mineNote(0, -1), 2.2, { vol: 0.12, delay: i * 0.45, wet: 0.7 });
      bellPhrase([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.06, { octave: 1, vol: 0.04, delay: 1.35 });
      choir(mineNote(0, -1), [0, 3, 7, 10], 3.5, 0.3);
      boom(1.35);
    }
  },
  // The lamp dies right before a legendary: a long breath in
  preLegendary: () => {
    noise(0.6, { vol: 0.12, hp: 600, attack: 0.55, wet: 0.5 });
    sfx(mineNote(0, -2), 0.7, { type: "sine", vol: 0.1, to: mineNote(0, -3) });
  },
  coin: () => {
    metal(2637, 0.15, { vol: 0.03, wet: 0.2 });
    metal(3136, 0.25, { vol: 0.03, delay: 0.07, wet: 0.2 });
  },
  coinTick: (i) => metal(2400 + (i % 6) * 160, 0.08, { vol: 0.015, wet: 0.2 }),
  // Starting a run: the cage gate rattles open and the bell rings once
  combo: () => {
    chain(6);
    metal(mineNote(5), 0.8, { vol: 0.05, delay: 0.15 });
  },
  comboUp: (n) => bellPhrase([0, 2, 4, 5].map((d) => d + Math.min(Math.floor(n / 10), 6)), 0.06, { octave: 1, vol: 0.04 }),
  comboBreak: () => {
    metal(mineNote(1, -1), 0.6, { vol: 0.05, wet: 0.5 });
    noise(0.2, { vol: 0.05, lp: 400 });
  },
  geode: () => {
    bellPhrase([10, 11, 12, 13, 14], 0.05, { vol: 0.035 });
    ding(0.05, 0.3);
  },
  pop: () => metal(mineNote(7, 1), 0.2, { vol: 0.03, wet: 0.1 }),
  blub: () => sfx(700, 0.15, { type: "sine", to: 180, vol: 0.07, wet: 0.6 }),
  // The lamp goes out: the work song, slowed and falling
  sad: () => bellPhrase([3, 2, 0, -1], 0.28, { vol: 0.05, dur: 1.4 }),
  trophy: () => bellPhrase([4, 5, 7, 9], 0.08, { vol: 0.04 }),
  deny: () => metal(mineNote(1, -1), 0.3, { vol: 0.04, bright: 0.3 }),
};

muteBtn.addEventListener("click", () => {
  muted = !muted;
  save("minele-sound-off", muted ? 1 : 0);
  muteBtn.classList.toggle("off", muted);
  SOUND.pop();
  ambience.start();
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
const SPECK_COLORS = ["#b0a090", "#b0a090", "#b0a090", "#40d959", "#40d959", "#408cff", "#408cff", "#a64df2", "#a64df2", "#ffcf4a"];

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
  const geode = Math.random() < GEODE_CHANCE;
  const hp = 100 * difficulty * (geode ? 2 : 1);

  // Higher insight unlocks wilder ways to wiggle, from calm to frantic
  const unlocked = Math.min(PATTERNS.length, Math.max(1, Math.ceil(PATTERNS.length * clamp01(rockLevel / 100))));

  // A lumpy outline: a circle bent by three random harmonics
  const harmonics = [2, 3, 5].map((k) => ({ k, amp: between(0.04, 0.12), ph: between(0, Math.PI * 2) }));
  const specks = [];
  const speckCount = geode ? 46 : 4 + rarity * 2;
  for (let i = 0; i < speckCount; i++) {
    const color = geode ? pick(RARITY_COLORS.slice(1)) : SPECK_COLORS[Math.min(9, range(0, rarity))];
    specks.push({ x: range(10, 40), y: range(10, 40), size: Math.random() < (geode ? 0.5 : 0.3) ? 2 : 1, color });
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
    rarity: geode ? 10 : rarity,
    luck,
    geode,
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
  const dark = [14, 10, 8];
  const base = [112, 96, 80];
  const light = [170, 152, 130];
  const shadow = [62, 50, 40];
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
        rctx.fillStyle = "#080504";
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
  rctx.fillStyle = "#050302";
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
let frameCount = 0;
let knock = 0;
// Hit-stop: big moments freeze the rock for a beat
let freezeUntil = 0;
function frame(now) {
  const dt = now < freezeUntil ? 0 : Math.min(0.05, (now - lastFrame) / 1000);
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
  if (frameCount++ % 4 === 0) lookAt();
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
    breakCombo();
    const now = performance.now();
    if (now - lastMissFloat > 400) {
      lastMissFloat = now;
      floatText(pointer.cx, pointer.cy, "miss", "miss");
    }
    return;
  }
  hit();
}

/* ---------- Combo ---------- */

const comboEl = $("combo");
let combo = 0;
let lastHitAt = 0;
let comboFade = null;
const comboMult = () => 1 + Math.min(combo, COMBO_CAP) * COMBO_STEP;

function breakCombo() {
  if (combo >= 10) {
    SOUND.comboBreak();
    floatText(pointer ? pointer.cx : innerWidth / 2, pointer ? pointer.cy - 40 : innerHeight / 2, `COMBO LOST x${combo}`, "miss");
  }
  combo = 0;
  renderCombo();
}

function renderCombo() {
  clearTimeout(comboFade);
  if (combo < 3) {
    comboEl.classList.remove("on");
    return;
  }
  // The counter heats up through the rarity colors as the combo grows
  const heat = Math.min(4, Math.floor(combo / 10));
  comboEl.style.setProperty("--rc", RARITY_COLORS[heat]);
  comboEl.innerHTML = `${RARITY_SYMBOLS[heat]} x${combo}<small>${comboMult().toFixed(2)}x DMG</small>`;
  comboEl.classList.add("on");
  comboEl.animate([{ transform: "scale(1.4)" }, { transform: "scale(1)" }], { duration: 160, easing: "steps(3)" });
  comboFade = setTimeout(() => {
    combo = 0;
    comboEl.classList.remove("on");
  }, COMBO_WINDOW_MS);
}

function shake(el, power, duration = 260) {
  if (reducedMotion) return;
  const frames = [];
  for (let i = 0; i < 6; i++) frames.push({ transform: `translate(${between(-power, power)}px, ${between(-power, power)}px)` });
  frames.push({ transform: "none" });
  el.animate(frames, { duration, easing: "steps(6)" });
}

function hit() {
  // RogueMiner: damage from strength and pickaxe against hardness, agility steadies it,
  // and three nested rolls pick a crit level (0 = a weak swing, 8 = a huge smash)
  const now = performance.now();
  if (now - lastHitAt > COMBO_WINDOW_MS) combo = 0;
  lastHitAt = now;
  combo++;
  const base = (stat("strength") * 10 + stat("pickaxe") * 100) / rock.hardness;
  const variance = between(0.9, 1.1) + stat("agility") * 0.01;
  const c1 = range(1, 10);
  const c2 = range(1, c1);
  const c3 = range(1, c2);
  const crit = range(0, c3);
  const damage = base * variance * ((crit + 1.5) / 2.5) * comboMult() * DAMAGE_BOOST;

  rock.hp -= damage;
  run.hits++;
  run.bestHit = Math.max(run.bestHit, damage);
  run.bestCombo = Math.max(run.bestCombo || 0, combo);
  knock = 4 + crit * 3;
  SOUND.hit(crit, combo);
  floatText(pointer.cx, pointer.cy - 20, fmt(Math.max(1, damage)), `c${crit}`);
  burst(pointer.cx, pointer.cy, 3 + crit * 2, ["#706050", "#aa9882", "#3e3228", ...(crit >= 4 ? ["#ffcf4a"] : [])], 0.6);
  if (crit >= 4) shake(document.querySelector(".table"), 2 + crit);
  if (crit >= 5) {
    freezeUntil = now + 90;
    showToast(crit >= 7 ? "MEGA CRIT!" : "CRIT!", 4 + crit / 2);
  }
  if (combo % 10 === 0) {
    SOUND.comboUp(combo);
    showToast(`${RARITY_SYMBOLS[Math.min(4, combo / 10 - 1)]} COMBO x${combo} ${RARITY_SYMBOLS[Math.min(4, combo / 10 - 1)]}`, Math.min(9, 3 + combo / 10));
  }
  renderCombo();
  drawRock();
  renderHp();
  if (rock.hp <= 0) breakRock();
}

/* ---------- Rarity effects: the rarer, the crazier ---------- */

function fxEl(cls, x, y, rarity, life) {
  const el = document.createElement("div");
  el.className = `${cls} r${rarity}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), life);
  return el;
}

// Symbols flung out from a point (or raining over the whole screen for legendaries)
function symbolBurst(x, y, rarity, count, rain = false) {
  if (reducedMotion) count = Math.ceil(count / 4);
  for (let i = 0; i < count; i++) {
    const el = fxEl("sym", rain ? between(0, innerWidth) : x, rain ? -40 : y, rarity, 3200);
    el.textContent = RARITY_SYMBOLS[rarity];
    el.style.fontSize = `${Math.round(between(14, rain ? 40 : 28))}px`;
    const a = between(0, Math.PI * 2);
    const d = between(60, 200);
    const to = rain
      ? `translate(${between(-60, 60)}px, ${innerHeight + 80}px) rotate(${between(-360, 360)}deg)`
      : `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${between(-180, 180)}deg)`;
    el.animate([{ transform: "translate(0, 0) scale(.3)", opacity: 1 }, { transform: to, opacity: 0 }], {
      duration: rain ? between(1800, 3000) : between(700, 1200),
      delay: rain ? between(0, 900) : 0,
      easing: rain ? "linear" : "cubic-bezier(.2, .8, .4, 1)",
      fill: "both",
    });
  }
}

async function rarityFX(item, x, y) {
  const r = item.rarity;
  const sym = RARITY_SYMBOLS[r];
  if (r === 4) {
    // Legendary: everything stops, the lamp dies, then the find erupts in gold
    freezeUntil = performance.now() + 900;
    const dark = fxEl("blackout", x, y, r, 1100);
    dark.style.setProperty("--bx", `${x}px`);
    dark.style.setProperty("--by", `${y}px`);
    SOUND.preLegendary();
    await wait(650);
  }
  floatText(x, y - 70, `${sym} ${item.name} ${sym}`, `loot r${r}`);
  SOUND.drop(r);
  if (r === 0) burst(x, y, 8, ["#c7c7c7", "#8a7660"], 0.5);
  if (r >= 1) fxEl("shock", x, y, r, 900).style.setProperty("--ss", 4 + r * 3);
  if (r === 1) burst(x, y, 16, ["#40d959", "#8ac25a"], 0.7);
  if (r >= 2) {
    fxEl("beam", x, y, r, 1600).style.setProperty("--bw", `${16 + r * 14}px`);
    symbolBurst(x, y, r, 4 + r * 4);
  }
  if (r >= 3) {
    fxEl("rarity-flash", 0, 0, r, 800);
    setTimeout(() => fxEl("shock", x, y, r, 900).style.setProperty("--ss", 18), 160);
    showToast(`${sym} ${RARITY_NAMES[r]} ${sym}\n${item.name.toUpperCase()}`, r === 4 ? 9 : 7, true);
    sparkles(x, y, r === 4 ? 60 : 30);
    lurch(r === 4);
    setMessage(r === 4 ? "> it glows. everything down here saw it" : "> it glitters. the eyes noticed too", "eerie");
  }
  if (r === 4) {
    fxEl("rays", x, y, r, 2600);
    setTimeout(() => fxEl("shock", x, y, r, 900).style.setProperty("--ss", 30), 320);
    symbolBurst(x, y, r, 40, true);
    shake(stageEl, 10, 600);
  }
}

// Coins fly from the rock into the gold counter, one tick each
async function coinsTo(x, y, amount) {
  const target = centerOf($("gold"));
  const flying = Math.min(12, amount);
  for (let i = 0; i < flying; i++) {
    const el = fxEl("coin-fly", x, y, 4, 1200);
    const mid = { x: x + between(-80, 80), y: y - between(40, 120) };
    el.animate(
      [
        { transform: "translate(-50%, -50%)" },
        { transform: `translate(calc(-50% + ${mid.x - x}px), calc(-50% + ${mid.y - y}px))`, offset: 0.35 },
        { transform: `translate(calc(-50% + ${target.x - x}px), calc(-50% + ${target.y - y}px)) scale(.6)` },
      ],
      { duration: 700, delay: i * 45, easing: "ease-in", fill: "both" }
    );
    setTimeout(() => SOUND.coinTick(i), 700 + i * 45);
  }
  await wait(700 + flying * 45);
  addGold(amount);
  bump(goldEl);
  persist();
}

async function breakRock() {
  rock.broken = true;
  phase = "busy";
  const r = rock;
  const at = rockCenter();
  SOUND.crumble();
  burst(at.x, at.y, 40, ["#706050", "#aa9882", "#3e3228", "#080504", RARITY_COLORS[Math.min(4, Math.floor(r.rarity / 2.5))]]);
  rockCanvas.animate([{ opacity: 1, filter: "brightness(2)" }, { opacity: 0, filter: "brightness(1)" }], { duration: 250, fill: "forwards" });

  // Score: RogueMiner's 80 per rock, raised by dimension, luck and player power
  const worldMult = 1 + (stat("worldLevel") - 1) * 0.2;
  const luckMult = 1 + stat("luck") * 0.01;
  const gain = Math.round(80 * worldMult * luckMult * (stat("power") / 100) * between(0.75, 1.25));
  addScore(gain * (r.geode ? 3 : 1));
  floatText(at.x, at.y - 30, `+${fmt(gain * (r.geode ? 3 : 1))}`, "gold");
  run.rocks--;
  run.mined++;
  state.stats.minedStones++;

  // Gold straight from the rock: more from luckier rocks and deeper levels, a pile from geodes
  const gold = Math.max(1, Math.round((1 + r.rarity * 0.4) * (1 + (run.level - 1) * 0.15) * between(0.8, 1.2) * (r.geode ? 6 : 1)));
  coinsTo(at.x, at.y, gold);

  // A geode holds three finds, rolled with extra luck; a plain rock one
  const drops = r.geode ? 3 : 1;
  for (let d = 0; d < drops; d++) {
    const item = rollLoot(r, r.geode ? 0.35 : 0);
    const [lo, hi] = STACK_SIZES[item.rarity];
    const n = range(lo, hi + 1);
    addItem(item.id, n);
    run.finds[item.id] = (run.finds[item.id] || 0) + n;
    await wait(d ? 420 : 180);
    await rarityFX(n > 1 ? { ...item, name: `${item.name} x${n}` } : item, at.x + (d - (drops - 1) / 2) * 60, at.y);
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
function rollLoot(r, boost = 0) {
  const progress = clamp01((r.luck / 50 + r.rarity / 10 + stat("rockLevel") / 100 + stat("luck") / 1601) / 4 + boost);
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
  // Lucky rocks glow in the color of the finds they're likely to hold
  const glow = rock.geode ? 4 : rock.rarity >= 10 ? 4 : rock.rarity >= 9 ? 3 : rock.rarity >= 7 ? 2 : -1;
  rarityEl.textContent = rock.geode ? "✸ GEODE ✸" : `${rock.rarity}/10${glow >= 0 ? " " + RARITY_SYMBOLS[glow] : ""}`;
  rockCanvas.style.setProperty("--aura", glow >= 0 ? RARITY_COLORS[glow] : "transparent");
  rockCanvas.classList.toggle("geode", rock.geode);
  if (rock.geode) {
    SOUND.geode();
    showToast("✸ GEODE ✸\nCRACK IT OPEN", 8);
    setTimeout(() => sparkles(rockCenter().x, rockCenter().y, 30), 120);
  }
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
  const tier = tierFor(run.level);
  renderRun();
  persist();
  await descend(run.level);
  setDepth(run.level);
  if (tierFor(run.level - 1) < tier) {
    showToast(`${TIERS[tier].name} DEPTHS`, tier, true);
    victory(tier);
  }
  setMessage(pick(LEVEL_LINES[depthBand(run.level)]), "eerie");
  checkAchievements();
  persist();
  await wait(400);
}

const LEVEL_LINES = [
  ["> the cage creaks. deeper", "> the air smells of wet stone", "> your lamp hisses softly"],
  ["> something shifted in the walls", "> you hear digging. not yours", "> the dark down here is thicker"],
  ["> they are closer now", "> the dark is breathing", "> no one has come back from here"],
];

// The cage ride down: gates slam shut, the shaft rushes past, the depth counter falls
async function descend(level) {
  const from = (level - 1) * METERS_PER_LEVEL;
  const to = level * METERS_PER_LEVEL;
  const cage = document.createElement("div");
  cage.className = "cage";
  cage.style.setProperty("--level-color", TIERS[tierFor(level)].color);
  cage.innerHTML = `<div class="cage-shaft"></div><div class="cage-gate left"></div><div class="cage-gate right"></div>
    <div class="panel cage-sign"><small>&#9660; GOING DOWN &#9660;</small><b>-${fmt(from)} M</b>
    <span>LEVEL ${level} &middot; ${run.rocks} rocks &middot; goal ${fmt(run.goal)}</span></div>`;
  document.body.appendChild(cage);
  const [left, right] = cage.querySelectorAll(".cage-gate");
  const counter = cage.querySelector("b");
  const ride = reducedMotion ? 500 : 1700;
  cage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "forwards" });
  left.animate([{ transform: "translateX(-100%)" }, { transform: "none" }], { duration: 350, easing: "steps(5)", fill: "forwards" });
  right.animate([{ transform: "translateX(100%)" }, { transform: "none" }], { duration: 350, easing: "steps(5)", fill: "forwards" });
  noise(0.12, { vol: 0.2, lp: 1200, delay: 0.33 });
  metal(mineNote(0, -1), 0.5, { vol: 0.08, delay: 0.33, bright: 1.5 });
  chain(8, 0.1);
  cartRumble(ride / 1000 + 0.3);
  const startAt = performance.now();
  await new Promise((resolve) => {
    function tick(now) {
      const t = Math.min(1, (now - startAt) / ride);
      counter.textContent = `-${fmt(from + (to - from) * t * t)} M`;
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
    // Background tabs pause animation frames: never let the ride stall the game
    setTimeout(resolve, ride + 300);
  });
  counter.textContent = `-${fmt(to)} M`;
  // Clunk: the cage hits the next landing
  boom(0);
  ding(0.06);
  left.animate([{ transform: "none" }, { transform: "translateX(-100%)" }], { duration: 350, easing: "steps(5)", fill: "forwards" });
  right.animate([{ transform: "none" }, { transform: "translateX(100%)" }], { duration: 350, easing: "steps(5)", fill: "forwards" });
  cage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: 250, fill: "forwards" });
  await wait(720);
  cage.remove();
}

// A rare find: the floor drops a little, the lamp gutters, every eye turns your way
function lurch(legendary) {
  stageEl.classList.remove("lurch");
  void stageEl.offsetWidth;
  stageEl.classList.add("lurch");
  pulseDark();
  startle(legendary ? 3200 : 1600);
  if (legendary) surgeEyes(14);
}

function pulseDark() {
  darknessEl.classList.remove("pulse");
  void darknessEl.offsetWidth;
  darknessEl.classList.add("pulse");
}

function setDepth(level) {
  const root = document.documentElement;
  const dark = darkFor(level);
  root.style.setProperty("--depth", `${(level - 1) * 120}px`);
  root.style.setProperty("--dark", dark.toFixed(3));
  root.style.setProperty("--level-color", TIERS[tierFor(level)].color);
  depthLabelEl.textContent = depthText(level);
  rockDepthEl.textContent = depthText(level);
  paintTier(levelEl, tierFor(level));
  pitch = Math.pow(2, -Math.min((level - 1) * 0.5, 12) / 12);
  echo = dark * 0.35;
  syncEyes(level);
  ambience.update();
  if (level > topLevel) {
    topLevel = level;
    topLevelEl.textContent = depthText(topLevel);
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
  setMessage("> the cage creaks open. start digging");
  ambience.start();
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
  setMessage("> you're still down here. they remember you", "eerie");
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
  setMessage("> your lamp sputters out...", "eerie");
  pulseDark();
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
    ? finds.map(([item, n]) => `<span class="chip r${item.rarity}">${RARITY_SYMBOLS[item.rarity]} ${item.name}${n > 1 ? ` <b>x${n}</b>` : ""}</span>`).join("")
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
  bellPhrase([5, 7, 9, 10], 0.08, { vol: 0.045 });
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
    return `<button type="button" class="tab r${r} ${r === bagTab ? "on" : ""}" data-tab="${r}">${RARITY_SYMBOLS[r]} ${g} ${found}/${group.length}</button>`;
  }).join("");
  $("bag-grid").innerHTML = ITEMS.filter((i) => i.rarity === bagTab)
    .map((i) => {
      const known = everFound(i.id) > 0;
      const cls = `item r${i.rarity}${known ? "" : " unknown"}${known && !available(i.id) ? " empty" : ""}${bagSelected === i.id ? " sel" : ""}`;
      return `<button type="button" class="${cls}" data-id="${i.id}" ${known ? "" : "disabled"}>
        <span class="gem">${known ? RARITY_SYMBOLS[i.rarity] : "?"}</span>${known ? i.name : "???"}<span class="qty">${known ? "x" + available(i.id) : ""}</span></button>`;
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
  box.innerHTML = `<h4>${RARITY_SYMBOLS[item.rarity]} ${item.name} &middot; ${RARITY_NAMES[item.rarity]}</h4>
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
  SOUND.pop();
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
              return `<span class="chip r${item.rarity} ${available(id) >= n ? "" : "short"}">${RARITY_SYMBOLS[item.rarity]} ${item.name} <b>${available(id)}/${n}</b></span>`;
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

// mode: true = good news (gold), "eerie" = something is wrong (ember)
function setMessage(text, mode = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("win", mode === true);
  messageEl.classList.toggle("eerie", mode === "eerie");
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

// The big button: DESCEND when idle, a reminder while mining
function setButton(mode) {
  rollBtn.classList.toggle("mining", mode === "mining");
  rollBtn.innerHTML =
    mode === "mining"
      ? '&#9935; TAP THE ROCK &#9935;<span class="auto">hold to keep swinging</span>'
      : "&#9660; DESCEND &#9660;";
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
    setHint("Tap DESCEND to play. New here? The ? button explains everything.");
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

function fitStage() {
  const natural = stageEl.offsetHeight; // layout size, not affected by the transform
  const avail = window.innerHeight * 0.9 - stageEl.offsetTop;
  const scale = Math.min(1, avail / Math.max(natural, 1));
  stageEl.style.transform = scale < 1 ? `scale(${scale.toFixed(4)})` : "";
  aimLamp();
}

// The lamplight centers on the cave
function aimLamp() {
  const r = document.querySelector(".table").getBoundingClientRect();
  document.documentElement.style.setProperty("--lx", `${Math.round(r.left + r.width / 2)}px`);
  document.documentElement.style.setProperty("--ly", `${Math.round(r.top + r.height * 0.55)}px`);
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
  ambience.start();
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
const COLORS = ["#e8a840", "#ffb54a", "#c2401c", "#8a1410", "#8a7660", "#e8d6b8"];
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

/* ---------- Eyes in the dark ---------- */

const eyesEl = $("eyes");
const pitEyesEl = $("pit-eyes");
// Shallow eyes are mostly amber, deeper ones turn red
const EYE_AMBER = "#ffbf3a";
const EYE_GREEN = "#b8ff5a";
const EYE_RED = "#ff3b2f";
let eyePairs = [];
let pitPairs = [];
let lastPointer = null;

function eyeColor(dark) {
  if (Math.random() < 0.1 + dark * 0.85) return EYE_RED;
  return Math.random() < 0.75 ? EYE_AMBER : EYE_GREEN;
}

// One pair of eyes at a spot given as fractions of its container
function makeEyePair(container, fx, fy, size, color) {
  const el = document.createElement("div");
  el.className = "eye-pair";
  el.style.left = `${(fx * 100).toFixed(2)}%`;
  el.style.top = `${(fy * 100).toFixed(2)}%`;
  el.style.setProperty("--es", `${size}px`);
  el.style.setProperty("--ec", color);
  el.style.setProperty("--tilt", `${Math.round(between(-14, 14))}deg`);
  el.style.setProperty("--blink", `${between(4, 11).toFixed(1)}s`);
  el.style.setProperty("--bd", `${-between(0, 10).toFixed(1)}s`);
  el.style.setProperty("--eo", between(0.45, 0.9).toFixed(2));
  el.innerHTML = '<span class="eye"><span class="pupil"></span></span><span class="eye"><span class="pupil"></span></span>';
  container.appendChild(el);
  return { el, container, fx, fy, size };
}

function dropPair(pair) {
  pair.el.classList.add("leaving");
  setTimeout(() => pair.el.remove(), 900);
}

// More eyes open as you go down; a new run back at the top closes them
function syncEyes(level) {
  const dark = darkFor(level);
  const want = eyesFor(level);
  while (eyePairs.length > want) dropPair(eyePairs.pop());
  while (eyePairs.length < want) {
    // Mostly at the sides, out of the lamplight
    const side = Math.random() < 0.7;
    const fx = side ? (Math.random() < 0.5 ? between(0.02, 0.2) : between(0.8, 0.96)) : between(0.04, 0.94);
    eyePairs.push(makeEyePair(eyesEl, fx, between(0.08, 0.95), Math.round(7 + Math.random() * 6 + dark * 8), eyeColor(dark)));
  }
  // From level 6 something watches from inside the cave itself
  const wantPit = level >= 6 ? Math.min(6, Math.floor((level - 3) / 3)) : 0;
  while (pitPairs.length > wantPit) dropPair(pitPairs.pop());
  while (pitPairs.length < wantPit) {
    pitPairs.push(makeEyePair(pitEyesEl, between(0.03, 0.9), between(0.05, 0.85), Math.round(8 + dark * 6), eyeColor(dark)));
  }
}

// A burst of extra eyes that snap open for a moment, then sink back into the dark
function surgeEyes(count) {
  for (let i = 0; i < count; i++) {
    const pair = makeEyePair(eyesEl, between(0.02, 0.96), between(0.05, 0.95), Math.round(between(8, 18)), EYE_RED);
    pair.el.style.animationDuration = "0.6s";
    setTimeout(() => dropPair(pair), 2600 + i * 60);
  }
}

let startleTimer = null;
function startle(ms) {
  eyesEl.classList.add("widen");
  pitEyesEl.classList.add("widen");
  clearTimeout(startleTimer);
  startleTimer = setTimeout(() => {
    eyesEl.classList.remove("widen");
    pitEyesEl.classList.remove("widen");
  }, ms);
}

for (const type of ["pointermove", "pointerdown"]) {
  window.addEventListener(type, (e) => (lastPointer = { x: e.clientX, y: e.clientY, at: performance.now() }));
}

// Every pupil turns toward you: your pointer while it moves, otherwise the rock you dig at
function lookAt() {
  if (!eyePairs.length && !pitPairs.length) return;
  let target = null;
  if (lastPointer && performance.now() - lastPointer.at < 2500) target = lastPointer;
  else if (rock) target = rockCenter();
  if (!target) return;
  const pitRect = pitPairs.length ? pit.getBoundingClientRect() : null;
  for (const pair of eyePairs.concat(pitPairs)) {
    const x = pair.container === eyesEl ? pair.fx * innerWidth : pitRect.left + pair.fx * pitRect.width;
    const y = pair.container === eyesEl ? pair.fy * innerHeight : pitRect.top + pair.fy * pitRect.height;
    const dx = target.x - x;
    const dy = target.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const reach = pair.size * 0.4;
    pair.el.style.setProperty("--px", `${((dx / len) * reach).toFixed(1)}px`);
    pair.el.style.setProperty("--py", `${((dy / len) * reach * 0.3).toFixed(1)}px`);
  }
}

/* ---------- The mine's own sounds ---------- */

// A low drone and wind that darken with depth, water dripping somewhere, and in the deep
// levels whispers, distant knocking and a heartbeat that isn't yours
const ambience = {
  nodes: null,
  start() {
    const ac = audio();
    if (ac && !this.nodes) {
      const out = ac.createGain();
      out.gain.value = 0.0001;
      out.connect(master);
      const filter = ac.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 220;
      filter.connect(out);
      const drones = [41.2, 61.7, 43.6].map((f) => {
        const osc = ac.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        osc.connect(filter);
        osc.start();
        return { osc, f };
      });
      // Wind: looping noise through a band-pass, slowly swelling and fading
      const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const wind = ac.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const band = ac.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 380;
      band.Q.value = 0.8;
      const windGain = ac.createGain();
      windGain.gain.value = 0.25;
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 0.2;
      lfo.connect(lfoGain).connect(windGain.gain);
      wind.connect(band).connect(windGain).connect(out);
      wind.start();
      lfo.start();
      this.nodes = { out, filter, drones, band };
    }
    this.update();
  },
  update() {
    if (!this.nodes || !audioCtx) return;
    const dark = darkFor(run ? run.level : 1);
    const t = audioCtx.currentTime;
    const { out, filter, drones, band } = this.nodes;
    out.gain.setTargetAtTime(muted ? 0.0001 : 0.05 + dark * 0.12, t, 1.5);
    filter.frequency.setTargetAtTime(240 - dark * 140, t, 2);
    band.frequency.setTargetAtTime(380 * pitch, t, 2);
    for (const { osc, f } of drones) osc.frequency.setTargetAtTime(f * pitch, t, 2);
  },
};

// The mine tune: far away in the tunnels, other miners keep the work song going. Pick strokes
// on the beat, a bell phrase every few bars. The deeper you are, the slower and darker it
// gets, and the wrong note (the flat second, degree 1 of the scale shifted) creeps in
const TUNNEL_PHRASES = [
  [0, null, 2, 3, null, 2, 0, null],
  [3, 4, 5, null, 4, 3, 2, null],
  [5, null, 4, 3, 2, null, 0, null],
  [2, 3, null, 2, 0, null, -1, null],
];
const DEEP_PHRASES = [
  [0, null, 0.5, 0, null, -1, null, null],
  [3, null, 2.5, 2, null, 0.5, 0, null],
];
let tuneBeat = 0;
function tunnelTune() {
  const dark = darkFor(run ? run.level : 1);
  const beatMs = 60000 / (84 - dark * 34);
  setTimeout(tunnelTune, beatMs);
  if (muted || document.hidden || !ambience.nodes) return;
  const bar = Math.floor(tuneBeat / 8);
  const step = tuneBeat % 8;
  tuneBeat++;
  // Two miners trading strokes somewhere down the tunnel
  if (step % 2 === 0) pickaxe(0.35, 0, 0.8);
  if (step === 3 && Math.random() < 0.5) pickaxe(0.2, 0, 0.9);
  // Every other bar the bells carry a phrase of the work song
  if (bar % 2 === 1) {
    const deep = dark > 0.4 && Math.random() < dark;
    const phrases = deep ? DEEP_PHRASES : TUNNEL_PHRASES;
    const phrase = phrases[Math.floor(bar / 2) % phrases.length];
    const d = phrase[step];
    if (d !== null) {
      // Half degrees are the off notes: a semitone above the scale step
      const f = Number.isInteger(d) ? mineNote(d) : semis(mineNote(Math.floor(d)), 1);
      metal(f, 1.6, { vol: 0.022, wet: 0.85, bright: 0.5 });
    }
  }
}
setTimeout(tunnelTune, 2000);

let heartbeat = 0;
setInterval(() => {
  if (muted || document.hidden || !ambience.nodes) return;
  const dark = darkFor(run ? run.level : 1);
  // Water dripping somewhere in the dark
  if (Math.random() < 0.3) {
    const f = between(1500, 2600);
    sfx(f, 0.14, { type: "sine", vol: 0.025, to: f * 0.7, wet: 0.8 });
  }
  // Whispers: breathy noise swelling up and away
  if (dark > 0.25 && Math.random() < dark * 0.12) {
    noise(1.8, { vol: 0.02 + dark * 0.04, hp: between(1000, 1800), attack: 0.9, wet: 0.7 });
  }
  // Something knocking on the other side of the rock
  if (dark > 0.5 && Math.random() < 0.04) {
    for (let i = 0; i < 3; i++) noise(0.08, { vol: 0.12, lp: 300, delay: i * 0.32, wet: 0.5 });
  }
  // A slow heartbeat in the deep levels
  if (dark > 0.45 && heartbeat++ % 2 === 0) {
    sfx(55, 0.22, { type: "sine", vol: 0.1 * dark, to: 32 });
    sfx(55, 0.22, { type: "sine", vol: 0.07 * dark, to: 32, delay: 0.2 });
  }
}, 1000);

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
  hpText.textContent = "tap DESCEND";
  updateHint();
}
checkAchievements();
