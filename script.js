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
// Shakes and lurches move the floor, never the stage (which carries the fit-to-screen scale)
const floorEl = document.querySelector(".floor");
const darknessEl = $("darkness");

const VERSION = "1.6.0";

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
const eyesFor = (level) => Math.min(45, Math.round(1 + (level - 1) * 1.4));
// Every level's goal is 15% above the last one's
const goalFor = (level) => Math.floor(400 * Math.pow(1.15, level));
// Holding on the rock swings this often
const SWING_MS = 100;
// Rarity 5 is Archeology (dinosaurs, only in fossil rocks), 6 is Mushrooms (only in mushroom rocks)
const RARITY_NAMES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "ARCHEOLOGY", "MUSHROOM"];
// One symbol per rarity, shown wherever a find appears
const RARITY_SYMBOLS = ["◇", "◆", "✦", "❖", "✸", "⚱", "🍄"];

// Balance on top of RogueMiner's numbers: hits land harder, a crit roll never drops below
// 0.6x, and every hit in a row adds 4% (up to 3x at a 50 combo). A miss or a pause breaks it
const DAMAGE_BOOST = 1.5;
const COMBO_STEP = 0.04;
const COMBO_CAP = 50;
const COMBO_WINDOW_MS = 1500;
// About one rock in 25 is a geode: double health, glittering, three boosted finds and lots of gold
const GEODE_CHANCE = 0.04;
// One rock in 100 is a fossil: a dinosaur in the stone, the only way to find one
const FOSSIL_CHANCE = 0.01;
const DINOSAURS = ITEMS.filter((i) => i.rarity === 5);
// One rock in 200 is a mushroom growing out of the stone, the only place to pick one
const MUSHROOM_CHANCE = 0.005;
const MUSHROOMS = ITEMS.filter((i) => i.rarity === 6);
// Finds of the plainer rarities come in small stacks
// A swing this close to the rock's center (in pit pixels) is a PERFECT hit: double damage
const PERFECT_RADIUS = 12;
// One rock in 300 is a pet rock with googly eyes. It has opinions
const PET_CHANCE = 1 / 300;
const STACK_SIZES = [[1, 3], [1, 2], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1]];
const RARITY_GROUPS = ["STONES", "MINERALS", "GEMS", "PRECIOUS", "ELEMENTS", "ARCHEOLOGY", "MUSHROOMS"];
const RARITY_COLORS = ["#c7c7c7", "#40d959", "#408cff", "#a64df2", "#ffa61a", "#e8dcb8", "#ff4fd8"];
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
  // Up in the middle of the night? They noticed
  const late = new Date().getHours() === 3 && Math.random() < 0.3;
  jokeEl.textContent = "\u2026 " + (late ? "It's 3 AM. They're louder at 3 AM" : lines[jokeIndex++ % lines.length]) + " \u2026";
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
// While tripping on a mushroom, every note wavers around the depth pitch
let tripping = false;
const soundPitch = () => (tripping ? pitch * (1 + 0.07 * Math.sin(performance.now() / 170)) : pitch);

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
  const bend = soundPitch();
  osc.frequency.setValueAtTime(freq * bend, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to * bend, t + dur);
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
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
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
  src.start(t, Math.random() * 1.5);
  src.stop(t + Math.max(dur, attack + 0.05) + 0.05);
}

// Two seconds of white noise, made once and shared by every noisy sound
let sharedNoise = null;
function noiseBuffer(ac) {
  if (!sharedNoise) {
    sharedNoise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = sharedNoise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return sharedNoise;
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
  perfect: () => {
    metal(mineNote(12, 1), 0.6, { vol: 0.06, bright: 1.4, wet: 0.3 });
    metal(mineNote(14, 1), 0.4, { vol: 0.03, delay: 0.06, wet: 0.3 });
  },
  chirp: () => {
    for (let i = 0; i < 3; i++) sfx(2400, 0.07, { type: "sine", vol: 0.04, to: 3300, delay: i * 0.11 });
  },
  record: () => bellPhrase([5, 7, 9, 10, 12], 0.09, { vol: 0.05 }),
  // A find hitting the cave floor: a pebble ticks, an element crashes. power < 1 for bounces
  land: (r, power) => {
    const p = power;
    if (r === 0) {
      noise(0.03, { vol: 0.07 * p, hp: 2500 });
      sfx(380, 0.05, { type: "triangle", vol: 0.05 * p, to: 200 });
    } else if (r === 1) {
      metal(1800, 0.15, { vol: 0.03 * p, bright: 0.7, wet: 0.2 });
      noise(0.04, { vol: 0.06 * p, lp: 800 });
    } else if (r === 2) {
      metal(2600, 0.4, { vol: 0.04 * p, wet: 0.3 });
      metal(3900, 0.25, { vol: 0.02 * p, wet: 0.3 });
    } else if (r === 3) {
      sfx(180, 0.25, { type: "sine", vol: 0.22 * p, to: 80 });
      metal(mineNote(9, 1), 0.9, { vol: 0.05 * p, wet: 0.4 });
    } else if (r === 4) {
      // An element: a heavy crash that rattles the cave
      sfx(80, 0.9, { type: "sine", vol: 0.55 * p, to: 28, wet: 0.3 });
      noise(0.6, { vol: 0.35 * p, lp: 900, wet: 0.3 });
      noise(0.35, { vol: 0.18 * p, hp: 3000 });
      metal(1200, 0.7, { vol: 0.07 * p, bright: 1.5, wet: 0.4 });
      if (p > 0.5) for (let k = 0; k < 5; k++) noise(0.03, { vol: 0.05, delay: 0.2 + k * between(0.05, 0.1), hp: 2000 });
    } else if (r === 5) {
      // Bones: a clatter of dry knocks on a heavy thud
      sfx(110, 0.3, { type: "sine", vol: 0.3 * p, to: 50 });
      for (let k = 0; k < 6; k++) sfx(between(300, 700), 0.04, { type: "triangle", vol: 0.06 * p, delay: k * between(0.03, 0.06) });
    } else {
      // A mushroom: a soft, squishy plop with a little boing
      sfx(300, 0.18, { type: "sine", vol: 0.12 * p, to: 90 });
      noise(0.12, { vol: 0.08 * p, lp: 600 });
      sfx(700, 0.2, { type: "sine", vol: 0.04 * p, to: 1400, delay: 0.05 });
    }
  },
  // A mushroom appears: a bell that slides off its note, and a slow breath
  shroom: () => {
    for (const d of [1, 1.01]) sfx(mineNote(5, 1) * d, 1.4, { type: "sine", vol: 0.05, to: mineNote(8, 1), wet: 0.7 });
    noise(1.2, { vol: 0.05, hp: 1200, attack: 0.6, wet: 0.6 });
  },
  // The trip: bells sliding up and down the mine scale, and a long whoosh
  trip: () => {
    for (let i = 0; i < 10; i++) {
      const from = mineNote(i % 5 + 2, 1);
      sfx(from, 0.5, { type: "sine", vol: 0.04, to: from * (i % 2 ? 1.5 : 0.66), delay: i * 0.12, wet: 0.7 });
    }
    noise(2.4, { vol: 0.08, hp: 700, attack: 1.2, wet: 0.7 });
  },
  // A giant footstep: a deep thump, the ground cracking, pebbles falling after
  stomp: (i) => {
    sfx(60, 0.6, { type: "sine", vol: 0.55, to: 26, wet: 0.3 });
    noise(0.35, { vol: 0.3, lp: 160, wet: 0.4 });
    noise(0.08, { vol: 0.1, hp: 1200 });
    for (let k = 0; k < 4; k++) noise(0.03, { vol: 0.04, delay: 0.15 + k * between(0.05, 0.1), hp: 2000 });
    if (i % 2) chain(3, 0.05);
  },
  // The roar: a growl that drops into the floor, breath tearing through it
  roar: () => {
    for (const d of [1, 1.013, 0.988]) sfx(130 * d, 1.8, { type: "sawtooth", vol: 0.07, to: 48, attack: 0.12, wet: 0.6 });
    noise(1.7, { vol: 0.16, hp: 500, attack: 0.15, wet: 0.5 });
    sfx(65, 1.8, { type: "sine", vol: 0.3, to: 32, attack: 0.1 });
  },
  fossil: () => {
    for (let i = 0; i < 4; i++) noise(0.25, { vol: 0.05, hp: 2500, delay: i * 0.2, attack: 0.1 });
    metal(mineNote(0, -2), 2.4, { vol: 0.12, delay: 0.1, wet: 0.7 });
    choir(mineNote(0, -1), [0, 1, 7], 2.8, 0.3);
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

// The mine's background (drone, wind, drips, whispers, the distant work tune) can be
// silenced on its own, keeping every game sound
const ambienceBtn = $("ambience-btn");
let ambienceOff = load("minele-ambience-off") === 1;
function applyAmbience() {
  ambienceBtn.classList.toggle("off", ambienceOff);
  ambienceBtn.setAttribute("aria-pressed", String(!ambienceOff));
}
applyAmbience();
ambienceBtn.addEventListener("click", () => {
  ambienceOff = !ambienceOff;
  save("minele-ambience-off", ambienceOff ? 1 : 0);
  applyAmbience();
  ambience.start();
  SOUND.pop();
});

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
// A swing hits when it lands on the rock's shape (or within this many grid pixels of it),
// so holes, gaps and spikes really count
const HIT_SLACK = 2;
const rctx = rockCanvas.getContext("2d");
rockCanvas.width = ROCK_GRID;
rockCanvas.height = ROCK_GRID;

let rock = null;

// Specks in the stone hint at how lucky the rock is
const SPECK_COLORS = ["#b0a090", "#b0a090", "#b0a090", "#40d959", "#40d959", "#408cff", "#408cff", "#a64df2", "#a64df2", "#ffcf4a"];

// What the rock is made of: base, lit and shadowed color. Deeper levels favor the dark ones
const MATERIALS = [
  { name: "GRANITE", base: [112, 96, 80], light: [170, 152, 130], shadow: [62, 50, 40], depth: 0 },
  { name: "SANDSTONE", base: [150, 110, 62], light: [200, 160, 100], shadow: [92, 62, 32], depth: 0 },
  { name: "MARBLE", base: [176, 168, 160], light: [228, 222, 214], shadow: [118, 110, 104], depth: 0, veins: [120, 110, 120] },
  { name: "SLATE", base: [78, 90, 104], light: [124, 138, 154], shadow: [40, 48, 58], depth: 0.1 },
  { name: "IRONSTONE", base: [128, 62, 40], light: [184, 98, 66], shadow: [70, 30, 20], depth: 0.2 },
  { name: "MOSSROCK", base: [80, 96, 60], light: [124, 148, 92], shadow: [42, 52, 30], depth: 0.2 },
  { name: "BASALT", base: [58, 54, 58], light: [100, 96, 104], shadow: [30, 28, 32], depth: 0.35 },
  { name: "OBSIDIAN", base: [38, 24, 48], light: [120, 86, 150], shadow: [14, 8, 20], depth: 0.5, shine: true },
  { name: "BLOODSTONE", base: [92, 20, 22], light: [150, 40, 40], shadow: [44, 8, 10], depth: 0.6, veins: [40, 90, 50] },
];
// Crystal clusters come in gem colors
const CRYSTALS = [
  { name: "AMETHYST", base: [120, 70, 170], light: [190, 150, 235], shadow: [62, 30, 96], shine: true },
  { name: "QUARTZ", base: [160, 190, 210], light: [225, 240, 250], shadow: [90, 110, 130], shine: true },
  { name: "CITRINE", base: [200, 150, 40], light: [250, 214, 110], shadow: [120, 80, 10], shine: true },
  { name: "JADE", base: [50, 140, 90], light: [120, 210, 150], shadow: [20, 76, 46], shine: true },
];
const BONE = { name: "BONE", base: [190, 178, 146], light: [230, 222, 196], shadow: [120, 108, 82] };
const SHROOM = { name: "MUSHROOM", base: [176, 36, 150], light: [255, 120, 230], shadow: [96, 14, 84], shine: true };

// Shapes, each a test on (dx, dy) from the center of the 50x50 grid, with its own random
// parameters. weight = how common, depth = only from this darkness on, spin = turns as it wiggles
const SHAPES = {
  // A lumpy boulder: a circle bent by three harmonics
  boulder: {
    weight: 6,
    name: "BOULDER",
    make: () => ({ h: [2, 3, 5].map((k) => ({ k, amp: between(0.04, 0.12), ph: between(0, Math.PI * 2) })) }),
    test: (dx, dy, p) => {
      const a = Math.atan2(dy, dx);
      let radius = 19.5;
      for (const h of p.h) radius += Math.sin(a * h.k + h.ph) * h.amp * 19.5;
      return Math.hypot(dx, dy) <= radius;
    },
  },
  // A star of jagged spikes
  shard: {
    weight: 3,
    name: "SHARD",
    spin: true,
    make: () => ({ k: range(4, 9), ph: between(0, Math.PI * 2), inner: between(9, 13) }),
    test: (dx, dy, p) => {
      const a = Math.atan2(dy, dx);
      const spike = Math.pow(Math.max(0, Math.cos(p.k * a + p.ph)), 3);
      return Math.hypot(dx, dy) <= p.inner + spike * (22 - p.inner);
    },
  },
  // Pointed prisms growing from a base
  crystal: {
    weight: 2,
    name: "CLUSTER",
    make: () => ({
      prisms: Array.from({ length: range(3, 6) }, () => ({ tilt: between(-0.75, 0.75), w: between(3.5, 6.5), len: between(15, 26) })),
    }),
    test: (dx, dy, p) => {
      if (Math.hypot(dx, dy - 12) <= 9) return true;
      for (const q of p.prisms) {
        // Along the prism (u) and across it (v), from its foot at the bottom
        const x = dx;
        const y = 14 - dy;
        const u = x * Math.sin(q.tilt) + y * Math.cos(q.tilt);
        const v = x * Math.cos(q.tilt) - y * Math.sin(q.tilt);
        if (u < 0 || u > q.len) continue;
        const half = u > q.len - q.w ? (q.len - u) : q.w;
        if (Math.abs(v) <= half) return true;
      }
      return false;
    },
  },
  // A flat, chipped slab
  slab: {
    weight: 2,
    name: "SLAB",
    make: () => ({ tilt: between(-0.4, 0.4), w: between(18, 22), h: between(8, 12) }),
    test: (dx, dy, p) => {
      const x = dx * Math.cos(p.tilt) + dy * Math.sin(p.tilt);
      const y = -dx * Math.sin(p.tilt) + dy * Math.cos(p.tilt);
      return Math.abs(x) <= p.w && Math.abs(y) <= p.h && Math.abs(x) + Math.abs(y) * 1.6 <= p.w + p.h * 0.9;
    },
  },
  // Two rocks fused together
  twin: {
    weight: 2,
    name: "TWINS",
    spin: true,
    make: () => ({ a: between(0, Math.PI), r1: between(10, 13), r2: between(9, 12), gap: between(8, 10) }),
    test: (dx, dy, p) => {
      const ox = Math.cos(p.a) * p.gap;
      const oy = Math.sin(p.a) * p.gap;
      return Math.hypot(dx - ox, dy - oy) <= p.r1 || Math.hypot(dx + ox, dy + oy) <= p.r2;
    },
  },
  // A crescent moon of stone
  crescent: {
    weight: 1.5,
    name: "CRESCENT",
    spin: true,
    make: () => ({ ox: between(6, 9), oy: between(-6, -2) }),
    test: (dx, dy, p) => Math.hypot(dx, dy) <= 20 && Math.hypot(dx - p.ox, dy - p.oy) > 15,
  },
  // A ring: swing at the hole and you hit nothing
  ring: {
    weight: 1.2,
    name: "RING",
    spin: true,
    make: () => ({ hole: between(7, 10), lump: between(0, Math.PI * 2) }),
    test: (dx, dy, p) => {
      const d = Math.hypot(dx, dy);
      return d >= p.hole && d <= 19 + Math.sin(Math.atan2(dy, dx) * 3 + p.lump) * 1.5;
    },
  },
  // A tall stalagmite
  pillar: {
    weight: 1.5,
    name: "STALAGMITE",
    make: () => ({ tilt: between(-0.25, 0.25), base: between(8, 11) }),
    test: (dx, dy, p) => {
      const x = dx - dy * p.tilt;
      if (dy < -22 || dy > 20) return false;
      const width = p.base * ((dy + 22) / 42) + 1.5;
      return Math.abs(x) <= width + Math.sin(dy * 0.9) * 1.2;
    },
  },
  // An isometric block, shaded per face
  cube: {
    weight: 1.2,
    name: "BLOCK",
    spin: true,
    make: () => ({}),
    test: (dx, dy) => Math.abs(dx) <= 17 && Math.abs(dy) + Math.abs(dx) * 0.577 <= 20,
  },
  // A fossil curled into a spiral
  ammonite: {
    weight: 1,
    name: "AMMONITE",
    spin: true,
    make: () => ({ turn: between(0, Math.PI * 2) }),
    test: (dx, dy) => Math.hypot(dx, dy) <= 18,
  },
  // A pile of pebbles stuck together
  cluster: {
    weight: 1.5,
    name: "PEBBLES",
    make: () => ({ blobs: Array.from({ length: range(5, 8) }, () => ({ x: between(-12, 12), y: between(-12, 12), r: between(6, 10) })) }),
    test: (dx, dy, p) => p.blobs.some((b) => Math.hypot(dx - b.x, dy - b.y) <= b.r),
  },
  // Deep down, some rocks look back at you
  skull: {
    weight: 2,
    depth: 0.3,
    name: "SKULL",
    make: () => ({}),
    test: (dx, dy) => {
      const head = Math.hypot(dx / 1.05, dy + 4) <= 16;
      const jaw = Math.abs(dx) <= 9 && dy >= 6 && dy <= 18;
      const socket = Math.hypot(Math.abs(dx) - 6.5, dy + 2) <= 4;
      const nose = dy >= 5 && dy <= 9 && Math.abs(dx) <= (dy - 4) * 0.6;
      const teeth = dy >= 14 && dy <= 18 && Math.abs(dx) <= 8 && Math.round(dx) % 3 === 0;
      return (head || jaw) && !socket && !nose && !teeth;
    },
  },
};
// The mushroom rock is never picked at random: only the 1-in-200 roll makes one
SHAPES.mushroom = {
  weight: 0,
  name: "MUSHROOM",
  make: () => ({}),
  test: (dx, dy) => {
    const cap = dy <= 1 && Math.pow(dx / 21, 2) + Math.pow((dy + 1) / 17, 2) <= 1;
    const stem = dy > 0 && dy <= 20 && Math.abs(dx) <= 6 + (dy > 16 ? (dy - 16) * 0.9 : 0);
    return cap || stem;
  },
};
const SHAPE_NAMES = Object.keys(SHAPES);

function pickWeighted(list, weight) {
  const total = list.reduce((sum, x) => sum + weight(x), 0);
  let roll = Math.random() * total;
  for (const x of list) {
    roll -= weight(x);
    if (roll <= 0) return x;
  }
  return list[list.length - 1];
}

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
  const fossil = !geode && Math.random() < FOSSIL_CHANCE;
  const shroom = !geode && !fossil && Math.random() < MUSHROOM_CHANCE;
  const pet = !geode && !fossil && !shroom && Math.random() < PET_CHANCE;
  const hp = 100 * difficulty * (geode ? 2 : fossil || shroom ? 1.5 : pet ? 0.5 : 1);

  // Higher insight unlocks wilder ways to wiggle, from calm to frantic
  const unlocked = Math.min(PATTERNS.length, Math.max(1, Math.ceil(PATTERNS.length * clamp01(rockLevel / 100))));

  // Shape and stone: deeper levels unlock the stranger ones
  const dark = darkFor(run ? run.level : 1);
  const shape = shroom ? "mushroom" : fossil || pet ? "boulder" : geode ? pick(["boulder", "crystal"]) : pickWeighted(SHAPE_NAMES.filter((s) => SHAPES[s].weight > 0 && (SHAPES[s].depth || 0) <= dark), (s) => SHAPES[s].weight);
  const params = SHAPES[shape].make();
  const material =
    shroom ? SHROOM
    : pet ? MATERIALS[0]
    : fossil ? MATERIALS[1]
    : shape === "skull" ? BONE
    : shape === "crystal" || geode ? pick(CRYSTALS)
    : pickWeighted(MATERIALS.filter((m) => m.depth <= dark + 0.05), (m) => 1 + (m.depth <= dark ? m.depth * 3 : 0));

  // The shape becomes a 50x50 mask, used for drawing and for hit tests
  const mask = new Uint8Array(ROCK_GRID * ROCK_GRID);
  const cells = [];
  for (let y = 0; y < ROCK_GRID; y++) {
    for (let x = 0; x < ROCK_GRID; x++) {
      if (SHAPES[shape].test(x - 24.5, y - 24.5, params)) {
        mask[y * ROCK_GRID + x] = 1;
        cells.push([x, y]);
      }
    }
  }

  const specks = [];
  const speckCount = geode ? 46 : 4 + rarity * 2;
  for (let i = 0; i < speckCount; i++) {
    const color = geode ? pick(RARITY_COLORS.slice(1)) : SPECK_COLORS[Math.min(9, range(0, rarity))];
    const [x, y] = pick(cells);
    specks.push({ x, y, size: Math.random() < (geode ? 0.5 : 0.3) ? 2 : 1, color });
  }
  // Cracks: random walks from inside the rock, revealed as it loses health
  const cracks = [];
  for (let c = 0; c < 6; c++) {
    let [x, y] = pick(cells);
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
  const shade = Math.max(0.25, 1 - Math.log10(hardness) * 0.32);
  return {
    hp,
    maxHp: hp,
    hardness,
    rarity: geode || fossil || shroom ? 10 : rarity,
    fossil,
    shroom,
    pet,
    luck,
    geode,
    shape,
    params,
    material,
    mask,
    name: geode ? "GEODE" : fossil ? "FOSSIL" : shroom ? "MUSHROOM" : pet ? "PET ROCK" : `${material.name} ${SHAPES[shape].name}`,
    // Some shapes turn as they wiggle; the rest just rock back and forth a little
    spin: SHAPES[shape].spin ? between(0.4, 1.1) * (Math.random() < 0.5 ? -1 : 1) : 0,
    angle: between(-0.3, 0.3),
    pattern: range(0, unlocked),
    phase: between(0, Math.PI * 2),
    specks,
    cracks,
    shade,
    x: 0,
    y: 0,
    broken: false,
  };
}

function insideRock(r, x, y) {
  return x >= 0 && y >= 0 && x < ROCK_GRID && y < ROCK_GRID && r.mask[y * ROCK_GRID + x] === 1;
}

// Does a point in the pit land on the rock? Undo the rock's turn, then check its shape
function hitsRock(px, py) {
  const scale = ROCK_GRID / ROCK_PX;
  const dx = px - rock.x;
  const dy = py - rock.y;
  const cos = Math.cos(-rock.angle);
  const sin = Math.sin(-rock.angle);
  const gx = Math.round((dx * cos - dy * sin) * scale + 24.5);
  const gy = Math.round((dx * sin + dy * cos) * scale + 24.5);
  for (let oy = -HIT_SLACK; oy <= HIT_SLACK; oy++) {
    for (let ox = -HIT_SLACK; ox <= HIT_SLACK; ox++) {
      if (insideRock(rock, gx + ox, gy + oy)) return true;
    }
  }
  return false;
}

const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;

function drawRock() {
  rctx.clearRect(0, 0, ROCK_GRID, ROCK_GRID);
  if (!rock) return;
  const r = rock;
  const m = r.material;
  const black = [14, 10, 8];
  const body = mix(black, m.base, r.shade);
  const hi = mix(black, m.light, r.shade);
  const lo = mix(black, m.shadow, r.shade);
  const isCube = r.shape === "cube";
  for (let y = 0; y < ROCK_GRID; y++) {
    for (let x = 0; x < ROCK_GRID; x++) {
      if (!insideRock(r, x, y)) continue;
      if (isCube) {
        // Three faces: lit top, plain left, shadowed right
        const dx = x - 24.5;
        const dy = y - 24.5;
        const top = dy < 0 && dy + Math.abs(dx) * 0.577 < 0;
        rctx.fillStyle = top ? hi : dx < 0 ? body : lo;
      } else {
        // Light from the top left: edge pixels facing it are bright, the others dark
        const upLeft = !insideRock(r, x - 2, y - 2);
        const downRight = !insideRock(r, x + 2, y + 2);
        rctx.fillStyle = upLeft ? hi : downRight ? lo : body;
      }
      rctx.fillRect(x, y, 1, 1);
      if (!insideRock(r, x - 1, y) || !insideRock(r, x + 1, y) || !insideRock(r, x, y - 1) || !insideRock(r, x, y + 1)) {
        rctx.fillStyle = "#080504";
        rctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // Marble and bloodstone have veins running through them
  if (m.veins) {
    rctx.fillStyle = mix(black, m.veins, r.shade);
    for (let x = 0; x < ROCK_GRID; x++) {
      const y = Math.round(24 + Math.sin(x * 0.35 + r.phase) * 7 + Math.sin(x * 0.9) * 2);
      if (insideRock(r, x, y)) rctx.fillRect(x, y, 1, 1);
    }
  }
  // A fossil's spiral
  if (r.shape === "ammonite") {
    rctx.fillStyle = mix(black, m.shadow, r.shade * 0.7);
    for (let t = 0; t < 22; t += 0.08) {
      const rad = 1 + t * 0.78;
      const x = Math.round(24.5 + Math.cos(t + r.params.turn) * rad);
      const y = Math.round(24.5 + Math.sin(t + r.params.turn) * rad);
      if (insideRock(r, x, y)) rctx.fillRect(x, y, 1, 1);
    }
  }
  // Glassy stones and crystals catch the lamp in streaks
  if (m.shine) {
    rctx.fillStyle = "rgba(255, 255, 255, .55)";
    for (let i = 0; i < 6; i++) {
      const x = 14 + i;
      const y = 16 - i;
      if (insideRock(r, x, y)) rctx.fillRect(x, y, 1, 1);
      if (insideRock(r, x + 12, y + 14)) rctx.fillRect(x + 12, y + 14, 1, 1);
    }
  }
  for (const s of r.specks) {
    if (!insideRock(r, s.x, s.y)) continue;
    rctx.fillStyle = s.color;
    rctx.fillRect(s.x, s.y, s.size, s.size);
  }
  // A pet rock: two googly eyes, pupils rattling around every time it's drawn
  if (r.pet) {
    for (const ex of [18, 30]) {
      rctx.fillStyle = "#080504";
      rctx.fillRect(ex - 3, 17, 7, 7);
      rctx.fillStyle = "#fff";
      rctx.fillRect(ex - 2, 18, 5, 5);
      rctx.fillStyle = "#000";
      rctx.fillRect(ex - 1 + range(-1, 2), 19 + range(-1, 2), 2, 2);
    }
    rctx.fillStyle = "#3e3228";
    rctx.fillRect(21, 29, 7, 1);
    rctx.fillRect(20, 28, 1, 1);
    rctx.fillRect(28, 28, 1, 1);
  }
  // A mushroom: a pale stem under the cap, and glowing spots
  if (r.shroom) {
    for (let y = 26; y < ROCK_GRID; y++) {
      for (let x = 0; x < ROCK_GRID; x++) {
        if (!insideRock(r, x, y)) continue;
        const edge = !insideRock(r, x - 1, y) || !insideRock(r, x + 1, y) || !insideRock(r, x, y + 1);
        rctx.fillStyle = edge ? "#080504" : x < 24 ? "#f0e6d0" : "#c8b8a0";
        rctx.fillRect(x, y, 1, 1);
      }
    }
    rctx.fillStyle = "#fff6c0";
    for (const [sx, sy] of [[16, 14], [24, 10], [32, 15], [12, 20], [27, 18], [37, 21], [20, 21]]) rctx.fillRect(sx, sy, 2, 2);
  }
  // A fossil: a big bone showing through the sandstone, knobs at both ends
  if (r.fossil) {
    rctx.fillStyle = "#efe4c4";
    for (let i = 0; i < 22; i++) {
      const x = 14 + i;
      const y = Math.round(30 - i * 0.45);
      rctx.fillRect(x, y, 1, 3);
    }
    for (const [cx, cy] of [[13, 29], [13, 33], [36, 19], [36, 23]]) rctx.fillRect(cx - 1, cy - 1, 3, 3);
    rctx.fillStyle = "#b8a882";
    for (let i = 0; i < 22; i += 3) rctx.fillRect(14 + i, Math.round(32 - i * 0.45), 1, 1);
  }
  // A skull's sockets glow, like everything else down here
  if (r.shape === "skull") {
    rctx.fillStyle = "#ff3b2f";
    rctx.fillRect(17, 22, 2, 1);
    rctx.fillRect(30, 22, 2, 1);
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
    // Spinning shapes turn with the wiggle; the rest rock back and forth
    if (rock.spin) rock.angle += dt * rock.spin * speed * 1.6;
    else rock.angle = 0.18 * Math.sin(rock.phase * 0.8);
    knock *= 0.8;
    const jitter = knock > 0.5 ? (Math.random() - 0.5) * knock : 0;
    rockCanvas.style.transform = `translate(${rock.x - half + jitter}px, ${rock.y - half + jitter}px) rotate(${rock.angle.toFixed(3)}rad)`;
  }
  if (frameCount++ % 8 === 0) lookAt();
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
  if (!hitsRock(pointer.x, pointer.y)) {
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

function hit(auto = false) {
  // RogueMiner: damage from strength and pickaxe against hardness, agility steadies it,
  // and three nested rolls pick a crit level (0 = a weak swing, 8 = a huge smash)
  const now = performance.now();
  if (now - lastHitAt > COMBO_WINDOW_MS) combo = 0;
  lastHitAt = now;
  // Only hand swings build a combo
  if (auto) combo = 0;
  else combo++;
  const base = (stat("strength") * 10 + stat("pickaxe") * 100) / rock.hardness;
  const variance = between(0.9, 1.1) + stat("agility") * 0.01;
  const c1 = range(1, 10);
  const c2 = range(1, c1);
  const c3 = range(1, c2);
  const crit = range(0, c3);
  const perfect = !auto && Math.hypot(pointer.x - rock.x, pointer.y - rock.y) <= PERFECT_RADIUS;
  const damage = base * variance * ((crit + 1.5) / 2.5) * comboMult() * DAMAGE_BOOST * (perfect ? 2 : 1) * (fever ? 2 : 1);

  const hpBefore = rock.hp;
  rock.hp -= damage;
  // Smashing a rock with three times what it had left is an OVERKILL
  if (rock.hp <= 0 && damage >= hpBefore * 3) rock.overkill = true;
  run.hits++;
  run.bestHit = Math.max(run.bestHit, damage);
  run.bestCombo = Math.max(run.bestCombo || 0, combo);
  knock = 4 + crit * 3;
  SOUND.hit(crit, combo);
  floatText(pointer.cx, pointer.cy - 20, fmt(Math.max(1, damage)), `c${crit}`);
  burst(pointer.cx, pointer.cy, 2 + crit, rainbowPick ? ["#ff4f4f", "#ffd84a", "#4fff7a", "#4fc8ff", "#c84fff"] : ["#706050", "#aa9882", "#3e3228", ...(crit >= 4 ? ["#ffcf4a"] : [])], 0.6);
  if (perfect) {
    SOUND.perfect();
    floatText(pointer.cx, pointer.cy - 50, "PERFECT!", "perfect");
    fxEl("shock", pointer.cx, pointer.cy, 4, 900).style.setProperty("--ss", 5);
  }
  if (fever) {
    addGold(1);
    if (run.hits % 3 === 0) floatText(pointer.cx + 30, pointer.cy, "+1 G", "gold");
  }
  if (!auto && Math.random() < (rock.pet ? 0.35 : 0.025 + (crit >= 4 ? 0.04 : 0))) rockSays(pick(rock.pet ? PET_LINES : ROCK_LINES));
  if (crit >= 4) shake(document.querySelector(".table"), 2 + crit);
  if (crit >= 5) {
    freezeUntil = now + 90;
    showToast(crit >= 7 ? "MEGA CRIT!" : "CRIT!", 4 + crit / 2);
  }
  if (combo === 50) startFever();
  if (combo && combo % 10 === 0) {
    SOUND.comboUp(combo);
    showToast(`${RARITY_SYMBOLS[Math.min(4, combo / 10 - 1)]} COMBO x${combo} ${RARITY_SYMBOLS[Math.min(4, combo / 10 - 1)]}`, Math.min(9, 3 + combo / 10));
  }
  renderCombo();
  drawRock();
  renderHp();
  if (rock.hp <= 0) breakRock();
}

/* ---------- Auto-mine ---------- */

// The pickaxe swings itself, but slowly and without a combo: hand mining stays far faster
const AUTO_SWING_MS = 400;
const autoBtn = $("auto-btn");
let autoMine = load("minele-automine") === 1;

function applyAutoMine() {
  autoBtn.classList.toggle("on", autoMine);
  autoBtn.setAttribute("aria-pressed", String(autoMine));
  autoBtn.innerHTML = `&#9935; AUTO-MINE: ${autoMine ? "ON" : "OFF"}`;
  updateHint();
}

autoBtn.addEventListener("click", () => {
  autoMine = !autoMine;
  save("minele-automine", autoMine ? 1 : 0);
  applyAutoMine();
  SOUND.pop();
});

setInterval(() => {
  // A hand on the rock takes over from the auto swing
  if (!autoMine || holding || phase !== "mining" || !rock || rock.broken) return;
  const rect = pit.getBoundingClientRect();
  const scale = rect.width / Math.max(1, pit.offsetWidth);
  pointer = { x: rock.x, y: rock.y, cx: rect.left + rock.x * scale, cy: rect.top + rock.y * scale };
  hit(true);
}, AUTO_SWING_MS);

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
  if (r >= 4) {
    // Legendary and archeology: everything stops, the lamp dies, then the find erupts in gold
    freezeUntil = performance.now() + 900;
    const dark = fxEl("blackout", x, y, r, 1100);
    dark.style.setProperty("--bx", `${x}px`);
    dark.style.setProperty("--by", `${y}px`);
    SOUND.preLegendary();
    await wait(650);
  }
  floatText(x, y - 70, `${sym} ${item.name} ${sym}`, `loot r${r}`);
  // The landing is heard from the falling token; rarer finds also ring a bell phrase
  if (r >= 2) SOUND.drop(r);
  if (r >= 1) fxEl("shock", x, y, r, 900).style.setProperty("--ss", 4 + r * 3);
  if (r >= 2) {
    fxEl("beam", x, y, r, 1600).style.setProperty("--bw", `${16 + Math.min(r, 4) * 14}px`);
    symbolBurst(x, y, r, Math.min(12, 3 + r * 2));
  }
  if (r >= 3) {
    fxEl("rarity-flash", 0, 0, r, 800);
    setTimeout(() => fxEl("shock", x, y, r, 900).style.setProperty("--ss", 18), 160);
    showToast(`${sym} ${RARITY_NAMES[r]} ${sym}\n${item.name.toUpperCase()}`, r >= 4 ? 9 : 7, true);
    sparkles(x, y, r >= 4 ? 30 : 16);
    lurch(r >= 4);
    setMessage(
      r === 6 ? `> ${item.name.toLowerCase()}. the walls are breathing. the colors are wrong`
      : r === 5 ? `> ${item.name.toLowerCase()}. it has been waiting down here for millions of years`
      : r === 4 ? "> it glows. everything down here saw it"
      : "> it glitters. the eyes noticed too",
      "eerie"
    );
  }
  if (r === 5) {
    burst(x, y, 30, ["#e8dcb8", "#c8b890", "#8a7660", "#5a4632"], 1.2);
    dinoStomp();
  }
  if (r === 6) startTrip();
  if (r >= 4) {
    fxEl("rays", x, y, r, 2600);
    setTimeout(() => fxEl("shock", x, y, r, 900).style.setProperty("--ss", 30), 320);
    symbolBurst(x, y, r, 18, true);
    shake(floorEl, 10, 600);
  }
}

/* ---------- The find drops out of the rock ---------- */

// The find tumbles out as its symbol, bounces on the cave floor (each bounce heard, louder
// for heavier finds), then flies into the bag
function dropToken(item, x, y) {
  const r = item.rarity;
  const el = fxEl("drop-token", x, y, r, 1700);
  el.textContent = RARITY_SYMBOLS[r];
  el.style.fontSize = `${18 + Math.min(r, 4) * 4}px`;
  const pitRect = pit.getBoundingClientRect();
  const floor = Math.max(y + 20, pitRect.bottom - 16) - y;
  const dx = between(-50, 50);
  const at = (px, py, s = 1, rot = 0) => `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) scale(${s}) rotate(${rot}deg)`;
  el.animate(
    [
      { transform: at(0, 0, 0.4), easing: "ease-out" },
      { transform: at(dx * 0.4, -70, 1, 90), offset: 0.22, easing: "ease-in" },
      { transform: at(dx, floor, 1.1, 200), offset: 0.48, easing: "ease-out" },
      { transform: at(dx * 1.2, floor - 26, 1, 260), offset: 0.62, easing: "ease-in" },
      { transform: at(dx * 1.35, floor, 1, 330), offset: 0.76 },
      { transform: at(dx * 1.35, floor, 1, 330) },
    ],
    { duration: 1000, fill: "forwards" }
  );
  const floorY = y + floor;
  setTimeout(() => {
    SOUND.land(r, 1);
    burst(x + dx, floorY, r >= 4 ? 14 : 5, ["#8a7660", "#5a4632", RARITY_COLORS[r]], 0.5);
    if (r >= 4) shake(document.querySelector(".table"), 8, 300);
  }, 480);
  setTimeout(() => SOUND.land(r, 0.35), 760);
  // Into the bag
  setTimeout(() => {
    const bag = centerOf($("bag-btn"));
    el.animate(
      [{ transform: at(dx * 1.35, floor, 1, 330), opacity: 1 }, { transform: at(bag.x - x, bag.y - y, 0.3, 720), opacity: 0.2 }],
      { duration: 450, easing: "ease-in", fill: "forwards" }
    );
    setTimeout(() => bump($("bag-btn")), 430);
  }, 1150);
}

/* ---------- The mushroom trip ---------- */

// A picked mushroom: for a few seconds the colors melt, the mine wobbles and every sound bends
let tripTimer = null;
function startTrip() {
  tripping = true;
  document.documentElement.classList.add("trip");
  SOUND.trip();
  clearTimeout(tripTimer);
  tripTimer = setTimeout(() => {
    tripping = false;
    document.documentElement.classList.remove("trip");
  }, reducedMotion ? 3000 : 8000);
}

/* ---------- The dinosaur stomp ---------- */

// A dug-up dinosaur walks again: a huge shadow tyrant with one glowing eye stomps across
// the mine. Every step shakes the screen and kicks up dust, and every eye in the dark hides.
// X = body, O = eye; two leg frames take turns
const DINO_BODY = [
  "...............XXXXXXX..",
  "..............XXXOXXXXX.",
  "..............XXXXXXXXXX",
  "..............XXXXX.X.X.",
  "..............XXXXXXXX..",
  "X............XXXXXX.....",
  "XX..........XXXXXXXX....",
  ".XX........XXXXXXX.XX...",
  "..XXX.....XXXXXXXX..X...",
  "...XXXXXXXXXXXXXXX......",
  "....XXXXXXXXXXXXXX......",
  ".....XXXXXXXXXXXX.......",
  "......XXXXXXXXXX........",
];
const DINO_LEGS = [
  ["......XXXX...XXX........", ".....XXX......XXX.......", ".....XX........XX.......", "....XXX.......XXXX......"],
  ["........XXXXXXX.........", "........XXX..XX.........", "........XX...XX.........", ".......XXX..XXX........."],
];
const DINO_CELL = 4;

function drawDino(canvas, frame) {
  const rows = DINO_BODY.concat(DINO_LEGS[frame]);
  canvas.width = rows[0].length * DINO_CELL;
  canvas.height = rows.length * DINO_CELL;
  const g = canvas.getContext("2d");
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === ".") return;
      g.fillStyle = c === "O" ? "#ff3b2f" : "#120c08";
      g.fillRect(x * DINO_CELL, y * DINO_CELL, DINO_CELL, DINO_CELL);
    });
  });
}

let stomping = false;
async function dinoStomp() {
  if (stomping) return;
  stomping = true;
  const dino = document.createElement("canvas");
  dino.className = "stomp-dino";
  drawDino(dino, 0);
  document.body.appendChild(dino);
  // The watchers hide while it passes
  eyesEl.classList.add("flee");
  pitEyesEl.classList.add("flee");
  const steps = reducedMotion ? 3 : 9;
  const stepMs = 420;
  const walk = dino.animate([{ transform: "translateX(-60vw)" }, { transform: "translateX(110vw)" }], {
    duration: steps * stepMs,
    easing: "linear",
    fill: "forwards",
  });
  for (let i = 0; i < steps; i++) {
    drawDino(dino, i % 2);
    // Down comes the foot
    const rect = dino.getBoundingClientRect();
    const footX = rect.left + rect.width * (i % 2 ? 0.42 : 0.3);
    SOUND.stomp(i);
    shake(floorEl, 9, 260);
    burst(footX, innerHeight - 10, 18, ["#8a7660", "#5a4632", "#c8b890"], 0.9);
    if (i === Math.floor(steps / 2)) SOUND.roar();
    await wait(stepMs);
  }
  await walk.finished.catch(() => {});
  dino.remove();
  eyesEl.classList.remove("flee");
  pitEyesEl.classList.remove("flee");
  stomping = false;
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
  burst(at.x, at.y, 22, ["#706050", "#aa9882", "#3e3228", "#080504", RARITY_COLORS[Math.min(4, Math.floor(r.rarity / 2.5))]]);
  rockCanvas.animate([{ opacity: 1, filter: "brightness(2)" }, { opacity: 0, filter: "brightness(1)" }], { duration: 250, fill: "forwards" });

  // Score: RogueMiner's 80 per rock, raised by dimension, luck and player power
  const worldMult = 1 + (stat("worldLevel") - 1) * 0.2;
  const luckMult = 1 + stat("luck") * 0.01;
  const gain = Math.round(80 * worldMult * luckMult * (stat("power") / 100) * between(0.75, 1.25));
  const bonus = r.geode ? 3 : r.fossil ? 5 : r.shroom ? 8 : 1;
  // Style points: overkill pays a quarter more score, a quick break pays extra gold
  const overkill = r.overkill ? 1.25 : 1;
  const quick = performance.now() - r.spawnedAt < 1500;
  addScore(Math.round(gain * bonus * overkill));
  floatText(at.x, at.y - 30, `+${fmt(gain * bonus * overkill)}`, "gold");
  if (r.overkill) {
    showToast("OVERKILL!", 8);
    unlockAch("secret_overkill");
  }
  if (quick) floatText(at.x + 50, at.y - 10, "QUICK! +GOLD", "gold");
  if (r.pet) {
    run.rocks += 3;
    showToast("PET ROCK...\n+3 ROCKS. MONSTER.", 5, true);
    setMessage("> pebbles is gone. you monster. (+3 rocks)", "eerie");
    unlockAch("secret_pet");
  }
  run.rocks--;
  run.mined++;
  state.stats.minedStones++;

  // Gold straight from the rock: more from luckier rocks and deeper levels, a pile from geodes
  const gold = Math.max(1, Math.round((1 + r.rarity * 0.4) * (1 + (run.level - 1) * 0.15) * between(0.8, 1.2) * (r.geode ? 6 : r.fossil ? 10 : r.shroom ? 15 : 1) * (quick ? 1.5 : 1)));
  coinsTo(at.x, at.y, gold);

  // A geode holds three finds, rolled with extra luck; a plain rock one
  const drops = r.geode ? 3 : 1;
  for (let d = 0; d < drops; d++) {
    const item = rollLoot(r, r.geode ? 0.35 : 0);
    const [lo, hi] = STACK_SIZES[item.rarity];
    // A gold vein doubles every find
    const n = range(lo, hi + 1) * (run.vein > 0 ? 2 : 1);
    addItem(item.id, n);
    run.finds[item.id] = (run.finds[item.id] || 0) + n;
    await wait(d ? 420 : 120);
    const dropX = at.x + (d - (drops - 1) / 2) * 60;
    dropToken(item, dropX, at.y);
    await rarityFX(n > 1 ? { ...item, name: `${item.name} x${n}` } : item, dropX, at.y);
  }
  if (run.vein > 0) run.vein--;
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
  tickEvents();
}

function rockCenter() {
  const rect = rockCanvas.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// RogueMiner's loot table: every rarity always has a chance, and luck (the rock's, its
// rarity, insight and the player's) slides all of them toward an even 20% each
function rollLoot(r, boost = 0) {
  if (r.fossil) return pick(DINOSAURS);
  if (r.shroom) return pick(MUSHROOMS);
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
  rock.spawnedAt = performance.now();
  drawRock();
  rockCanvas.getAnimations().forEach((a) => a.cancel());
  // Scale, not transform: the transform is the rock's position, set every frame
  rockCanvas.animate([{ scale: "0.2", opacity: 0 }, { scale: "1", opacity: 1 }], { duration: 200, easing: "steps(4)" });
  hardnessEl.textContent = rock.hardness;
  // Lucky rocks glow in the color of the finds they're likely to hold
  const glow = rock.shroom ? 6 : rock.fossil ? 5 : rock.geode ? 4 : rock.rarity >= 10 ? 4 : rock.rarity >= 9 ? 3 : rock.rarity >= 7 ? 2 : -1;
  rarityEl.textContent = rock.shroom ? "🍄 MUSHROOM 🍄" : rock.fossil ? "⚱ FOSSIL ⚱" : rock.geode ? "✸ GEODE ✸" : `${rock.rarity}/10${glow >= 0 ? " " + RARITY_SYMBOLS[glow] : ""}`;
  rockCanvas.style.setProperty("--aura", glow >= 0 ? RARITY_COLORS[glow] : "transparent");
  rockCanvas.classList.toggle("geode", rock.geode);
  rockCanvas.classList.toggle("fossil", rock.fossil);
  rockCanvas.classList.toggle("shroom", rock.shroom);
  if (rock.pet) {
    showToast("A PET ROCK!\nIT'S LOOKING AT YOU", 4, true);
    setTimeout(() => rockSays("hi!"), 600);
  }
  if (rock.shroom) {
    SOUND.shroom();
    showToast("🍄 A MUSHROOM 🍄\nGROWING OUT OF THE STONE", 9, true);
    startle(2000);
  }
  if (rock.fossil) {
    SOUND.fossil();
    showToast("⚱ FOSSIL ⚱\nSOMETHING IS IN THE STONE", 9, true);
    pulseDark();
    startle(2000);
  }
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
  floorEl.classList.remove("lurch");
  void floorEl.offsetWidth;
  floorEl.classList.add("lurch");
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
    // Deeper than ever before
    if (run && level > 1) {
      setTimeout(() => {
        showToast(`NEW RECORD\n${depthText(level)}`, 8, true);
        SOUND.record();
        sparkles(innerWidth / 2, innerHeight * 0.4, 30);
      }, 1400);
    }
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
  $("bag-total").textContent = ITEMS.length;
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
    .map((a) => {
      const got = !!state.ach[a.id];
      const hidden = a.secret && !got;
      return `<div class="ach ${got ? "on" : ""}"><b>${got ? "&#10004; " : ""}${hidden ? "??? (secret)" : a.name}</b>${hidden ? "Keep digging. Or poking." : a.desc}</div>`;
    })
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
  hpText.textContent = left > 0 ? `${rock.name} · ${fmt(Math.ceil(left))} / ${fmt(rock.maxHp)} HP` : "DESTROYED!";
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
  if (rainbowPick && /^c\d/.test(cls)) el.style.color = `hsl(${Math.floor(Math.random() * 360)}, 100%, 65%)`;
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
    setHint(
      autoMine
        ? `Auto-mine is swinging, slowly. Tap the rock yourself to build a combo and go faster.`
        : `Tap or hold on the rock. Reach ${fmt(run.goal)} before your ${run.rocks} rocks run out.`
    );
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

// fast: part of a cave-in (quick fall, no limit); golden: force a golden one
function spawnDrifter(fast = false, golden = false) {
  if (!fast && driftEl.childElementCount >= MAX_DRIFTERS) return;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "drifter";
  el.setAttribute("aria-label", "Falling nugget");
  if (golden || Math.random() < GOLDEN_CHANCE) el.classList.add("golden");
  const size = 24 + Math.floor(Math.random() * 4) * 6;
  el.style.left = `${Math.random() * 94}vw`;
  el.style.setProperty("--ds", `${size}px`);
  el.style.setProperty("--dur", fast ? `${3 + Math.random() * 2}s` : `${12 + Math.random() * 12}s`);
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

// Particles are capped so big moments never pile up into lag
const MAX_PARTICLES = 220;
function burst(x, y, count, colors = COLORS, power = 1) {
  if (reducedMotion) count = Math.round(count / 4);
  count = Math.min(count, Math.max(0, MAX_PARTICLES - particles.length));
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
  count = Math.min(count, Math.max(0, MAX_PARTICLES - particles.length));
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
    out.gain.setTargetAtTime(muted || ambienceOff ? 0.0001 : 0.05 + dark * 0.12, t, 1.5);
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
  if (muted || ambienceOff || document.hidden || !ambience.nodes) return;
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
  if (muted || ambienceOff || document.hidden || !ambience.nodes) return;
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

/* ---------- Secret achievements ---------- */

// Unlocked by doing something, not by a counter
function unlockAch(id) {
  if (state.ach[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  state.ach[id] = true;
  achQueue.push(a);
  renderAchCount();
  if (!achShowing) showNextAchievement();
  persist();
}

/* ---------- Pixel sprites ---------- */

function drawSprite(canvas, rows, palette, cell) {
  canvas.width = rows[0].length * cell;
  canvas.height = rows.length * cell;
  const g = canvas.getContext("2d");
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (!palette[c]) return;
      g.fillStyle = palette[c];
      g.fillRect(x * cell, y * cell, cell, cell);
    })
  );
}

const CANARY = ["...YYY..", "..YYKYO.", "..YYYYOO", "YYYYYY..", ".YYYYY..", "..YYYY..", "...O.O.."];
const CANARY_COLORS = { Y: "#ffd84a", K: "#000", O: "#ff8a1f" };
const GHOST = [
  ".....LL...", "...HHHHH..", "..HHHHHHH.", "..WWWWWW..", "..WKWWKW..", "..WWWWWW..", "...WWWW...",
  "..GGGGGG..", ".GGGGGGGG.", ".GGGGGGGG.", ".GG.GG.GG.", ".GGGGGGGG.", "..GG..GG..", "..G....G..",
];
const GHOST_COLORS = { H: "#8a7660", L: "#ffd84a", W: "#dfe8ff", K: "#223", G: "#b8c8ff" };

// A sprite crossing the screen; tapping it calls onTap, letting it escape calls onMiss
function crossScreen(rows, palette, cell, cls, ms, onTap, onMiss) {
  const el = document.createElement("canvas");
  el.className = `crosser ${cls}`;
  drawSprite(el, rows, palette, cell);
  el.style.top = `${between(18, 55)}vh`;
  document.body.appendChild(el);
  let caught = false;
  const flight = el.animate([{ transform: "translateX(-15vw)" }, { transform: "translateX(112vw)" }], { duration: ms, easing: "linear", fill: "forwards" });
  el.addEventListener("pointerdown", (e) => {
    if (caught) return;
    caught = true;
    const { x, y } = centerOf(el);
    flight.pause();
    el.animate([{ opacity: 1, transform: getComputedStyle(el).transform }, { opacity: 0, transform: `${getComputedStyle(el).transform} scale(2)` }], { duration: 400, fill: "forwards" });
    setTimeout(() => el.remove(), 420);
    onTap(x, y);
    e.stopPropagation();
  });
  flight.finished
    .then(() => {
      if (caught) return;
      el.remove();
      onMiss && onMiss();
    })
    .catch(() => {});
}

/* ---------- Gold fever ---------- */

// A 50 combo sets it off: ten seconds of double damage and a coin on every hit
let fever = false;
function startFever() {
  if (fever) return;
  fever = true;
  document.documentElement.classList.add("fever");
  showToast("🔥 GOLD FEVER 🔥\n2× DAMAGE · GOLD EVERY HIT", 9, true);
  victory(5);
  unlockAch("secret_fever");
  setTimeout(() => {
    fever = false;
    document.documentElement.classList.remove("fever");
  }, 10000);
}

/* ---------- Random mine events ---------- */

let rocksUntilEvent = range(12, 26);
function tickEvents() {
  if (--rocksUntilEvent > 0) return;
  rocksUntilEvent = range(12, 26);
  pick([caveIn, canary, goldVein, ghostMiner])();
}

function caveIn() {
  showToast("CAVE-IN!\nGRAB THE NUGGETS", 6, true);
  boom(0);
  shake(floorEl, 8, 500);
  pulseDark();
  setMessage("> the ceiling gives way. it's raining nuggets", "eerie");
  for (let i = 0; i < 12; i++) setTimeout(() => spawnDrifter(true, i === 5), i * 90);
}

function canary() {
  SOUND.chirp();
  setMessage("> a canary! still alive! catch it before it's gone", true);
  crossScreen(CANARY, CANARY_COLORS, 6, "canary", 6500, (x, y) => {
    SOUND.chirp();
    sparkles(x, y, 20);
    unlockAch("secret_canary");
    if (run) {
      run.rocks += 2;
      renderRun();
      showToast("THE CANARY LIVES!\n+2 ROCKS", 4, true);
    } else showToast("THE CANARY LIVES!", 4);
  }, () => setMessage("> the canary flew off. that's... probably fine", "eerie"));
}

function goldVein() {
  if (!run) return;
  run.vein = 3;
  showToast("✦ GOLD VEIN ✦\nNEXT 3 ROCKS: DOUBLE FINDS", 7, true);
  SOUND.trophy();
  setMessage("> you hit a vein. the walls sparkle", true);
}

const GHOST_LINES = [
  "> a ghost miner drifts by. he's still on shift",
  "> a ghost miner waves. he forgot his lunch in 1893",
  "> a ghost miner points at the rock. helpful",
  "> a ghost miner checks his pocket watch. it stopped long ago",
];
function ghostMiner() {
  setMessage(pick(GHOST_LINES), "eerie");
  noise(2, { vol: 0.05, hp: 1500, attack: 1, wet: 0.8 });
  crossScreen(GHOST, GHOST_COLORS, 5, "ghost", 11000, (x, y) => {
    floatText(x, y - 20, "boo.", "gold");
    unlockAch("secret_ghost");
    // He leaves something behind
    const item = rollLoot({ luck: 30, rarity: 9 });
    addItem(item.id);
    if (run) run.finds[item.id] = (run.finds[item.id] || 0) + 1;
    dropToken(item, x, y);
    floatText(x, y - 50, `${RARITY_SYMBOLS[item.rarity]} ${item.name}`, `loot r${item.rarity}`);
    persist();
  });
}

/* ---------- Talking rocks ---------- */

const ROCK_LINES = [
  "ow!", "not the face!", "I have a family!", "rude.", "is this about the gold?", "I was here first",
  "ok that one hurt", "stop. please.", "I'm just a rock", "you'll regret this", "my mother was a mountain",
  "can we talk about this?", "harder? HARDER?", "*rock noises*", "I felt that in my strata",
];
const PET_LINES = [
  "hi!", "are we friends?", "why", "I trusted you", "my name is Pebbles", "this is fine", "ow ow ow",
  "I was going to be a mountain someday", "we could just hang out", "tell my family I love them",
];
let lastSpeech = 0;
function rockSays(text) {
  const now = performance.now();
  if (now - lastSpeech < 1500) return;
  lastSpeech = now;
  const { x, y } = rockCenter();
  const el = fxEl("speech", x, y - 70, 0, 1700);
  el.textContent = text;
  sfx(between(500, 700), 0.08, { type: "square", vol: 0.02 });
  sfx(between(700, 900), 0.08, { type: "square", vol: 0.02, delay: 0.09 });
}

/* ---------- Poking the eyes ---------- */

const POKE_LINES = ["hey!", "rude.", "ow, my eye", "we're watching YOU", "stop that", "...", "blink. blink.", "personal space?"];
let pokes = 0;
eyesEl.addEventListener("pointerdown", (e) => {
  const pairEl = e.target.closest(".eye-pair");
  if (!pairEl) return;
  pairEl.classList.add("poked");
  setTimeout(() => pairEl.classList.remove("poked"), 1400);
  floatText(e.clientX, e.clientY - 20, pick(POKE_LINES), "miss");
  sfx(220, 0.12, { type: "sine", vol: 0.06, to: 120 });
  if (++pokes % 10 === 0) {
    eyesEl.classList.add("all-poked");
    setTimeout(() => eyesEl.classList.remove("all-poked"), 3000);
    showToast("FINE.\nWE'LL STOP LOOKING.", 5, true);
    unlockAch("secret_rude");
  }
});

/* ---------- The sign falls down ---------- */

let signTaps = [];
let signDown = false;
document.querySelector("header h1").addEventListener("click", async () => {
  const now = performance.now();
  signTaps = signTaps.filter((t) => now - t < 2000).concat(now);
  metal(mineNote(signTaps.length + 4, 1), 0.2, { vol: 0.03 });
  if (signTaps.length < 5 || signDown) return;
  signTaps = [];
  signDown = true;
  const sign = document.querySelector("header .sign");
  chain(8);
  await sign.animate(
    [{ transform: "rotate(-1.2deg)" }, { transform: "rotate(14deg)", offset: 0.3 }, { transform: "translateY(120vh) rotate(40deg)" }],
    { duration: 1100, easing: "ease-in", fill: "forwards" }
  ).finished.catch(() => {});
  boom(0);
  shake(floorEl, 10, 400);
  setMessage("> the sign fell. health and safety has been notified", true);
  unlockAch("secret_sign");
  await wait(1800);
  chain(10);
  await sign.animate([{ transform: "translateY(-60vh) rotate(0deg)" }, { transform: "translateY(8px) rotate(-3deg)", offset: 0.8 }, { transform: "rotate(-1.2deg)" }], {
    duration: 900,
    easing: "ease-out",
  }).finished.catch(() => {});
  sign.getAnimations().forEach((a) => a.cancel());
  signDown = false;
});

/* ---------- Easter eggs on the keyboard ---------- */

// The old code turns your pickaxe into a rainbow; a few typed words wake things up
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let rainbowPick = load("minele-rainbow") === 1;
let keyTrail = [];
let typed = "";
const SECRET_WORDS = {
  canary: () => canary(),
  dino: () => dinoStomp(),
  shroom: () => startTrip(),
  boo: () => {
    eyesEl.classList.add("all-poked", "flee");
    setTimeout(() => eyesEl.classList.remove("all-poked", "flee"), 2000);
    setMessage("> boo yourself", "eerie");
    SOUND.blub();
  },
};
document.addEventListener("keydown", (e) => {
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  keyTrail = keyTrail.concat(e.key.length === 1 ? e.key.toLowerCase() : e.key).slice(-KONAMI.length);
  if (KONAMI.every((k, i) => keyTrail[i] === k)) {
    keyTrail = [];
    rainbowPick = !rainbowPick;
    save("minele-rainbow", rainbowPick ? 1 : 0);
    showToast(rainbowPick ? "↑↑↓↓←→←→BA\nRAINBOW PICKAXE" : "RAINBOW PICKAXE\nPUT AWAY", 9, true);
    victory(4);
    unlockAch("secret_konami");
    return;
  }
  if (e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-12);
  for (const [word, action] of Object.entries(SECRET_WORDS)) {
    if (typed.endsWith(word)) {
      typed = "";
      action();
    }
  }
});

/* ---------- Start ---------- */

renderGold();
renderAchCount();
applyAutoMine();
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
