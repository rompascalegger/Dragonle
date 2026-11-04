/*
 * Dragonle – central configuration.
 * Every balancing number lives here. No other file contains game numbers.
 *
 * Tags from the design spec:
 *   [FIXED]     decided by the designer
 *   [PROPOSAL]  starting value, may be changed
 *   [OPEN]      not decided yet -> placeholder, ask the designer
 */
(function (root) {
  'use strict';

  const CONFIG = {
    version: 3,
    saveKey: 'dragonle-v3',

    // ---------------------------------------------------------------- Time
    time: {
      yearsPerSecond: 1,        // [FIXED] 1 game year = 1 second
      maxTickSeconds: 0.25,     // longest single simulation step
      matureAge: 300,           // [FIXED] sexual maturity
      adultAge: 1000,           // [FIXED] adult, leaves school
      levelEvery: 10,           // [FIXED] one level every 10 years
      autosaveSeconds: 5,
    },

    // ---------------------------------------------------------------- Elements [FIXED]
    // Order: arch-enemies sit next to each other (index ^ 1 = arch-enemy).
    // pre/suf: building blocks for alliance names ([OPEN] alliance names -> placeholder generator).
    elements: [
      { id: 'fire',      name: 'Fire',      color: '#E8341C', deep: '#8E1405', pre: 'Ember',   suf: 'blaze'   },
      { id: 'water',     name: 'Water',     color: '#1F6FE8', deep: '#0A3487', pre: 'Tide',    suf: 'stream'  },
      { id: 'light',     name: 'Light',     color: '#FFF4C2', deep: '#E3C35C', pre: 'Glow',    suf: 'shine'   },
      { id: 'dark',      name: 'Darkness',  color: '#1E1A2E', deep: '#09070F', pre: 'Night',   suf: 'shade'   },
      { id: 'lightning', name: 'Lightning', color: '#FFE135', deep: '#C79A00', pre: 'Thunder', suf: 'spark'   },
      { id: 'sand',      name: 'Sand',      color: '#D8B878', deep: '#9C7530', pre: 'Dune',    suf: 'dust'    },
      { id: 'wind',      name: 'Wind',      color: '#B8E8D8', deep: '#5BB59A', pre: 'Cloud',   suf: 'storm'   },
      { id: 'stone',     name: 'Stone',     color: '#7A7A80', deep: '#3D3D44', pre: 'Rock',    suf: 'wall'    },
      { id: 'ice',       name: 'Ice',       color: '#9FE3FF', deep: '#3FA6D6', pre: 'Frost',   suf: 'crystal' },
      { id: 'magma',     name: 'Magma',     color: '#FF8C1A', deep: '#B04A00', pre: 'Lava',    suf: 'heart'   },
      { id: 'nature',    name: 'Nature',    color: '#3FA34D', deep: '#1B5E25', pre: 'Moss',    suf: 'grove'   },
      { id: 'poison',    name: 'Poison',    color: '#9B3FD1', deep: '#561C7A', pre: 'Thorn',   suf: 'mist'    },
    ],

    // ---------------------------------------------------------------- Vector
    vector: {
      steps: 20,                // [PROPOSAL] 5 % steps: sum n_e = 20
    },

    // ---------------------------------------------------------------- Zones & hatcheries
    zones: {
      start: ['fire', 'water', 'nature'],   // [PROPOSAL] 3 zones open at start
      startSlots: 2,                        // [PROPOSAL] brood slots per zone
      maxSlots: 6,
      slotPriceBase: 200,                   // price of slot 3, then ×slotPriceGrowth
      slotPriceGrowth: 2.5,
      groundCapacity: 50,                   // [PROPOSAL] scales per zone on the ground (oldest decays when full)
      imprintSteps: 1,                      // [PROPOSAL] imprint shifts by 1 step
      // Hatcheries: magma [FIXED], fire [PROPOSAL], rest [OPEN] -> placeholder
      incubators: {
        magma: { name: 'Lava pool', style: 'lava' },
        fire:  { name: 'Ember oven', style: 'oven' },
      },
      incubatorPlaceholder: { name: 'Hatchery', style: 'nest', placeholder: true }, // [OPEN]
    },

    incubation: {
      seconds: 30,              // [OPEN] brood time -> placeholder 30 s
      crackStages: 4,           // [PROPOSAL] cracks appear gradually, the last one by click
    },

    // ---------------------------------------------------------------- Eggs & merchant
    eggClasses: [
      // [PROPOSAL] prices, dud rates, refunds. minShare = minimum share of the main element (in steps).
      { id: 'cheap',  name: 'Cheap',     price: 10,   dud: 0.30, refund: 0.30, shell: '#8B6B4A', spots: '#5A4030' },
      { id: 'common', name: 'Common',    price: 50,   dud: 0.20, refund: 0.50, shell: '#E6DCC0', spots: '#B8A57E', minShare: 10 },
      { id: 'noble',  name: 'Noble',     price: 250,  dud: 0.10, refund: 0.75, shell: '#B9C3D6', spots: '#7C88A6', minShare: 16 },
      { id: 'pure',   name: 'Purebred',  price: 1250, dud: 0.05, refund: 1.00, shell: '#F2CF5B', spots: '#B8902A', minShare: 20 },
      { id: 'rare',   name: 'Rare mix',  price: 6250, dud: 0.05, refund: 1.00, shell: '#E7A6E0', spots: '#8C4C9E' },
    ],
    market: {
      buybackRate: 0.40,        // [PROPOSAL] merchant buys back at 40 %
      examinedBonus: 0.10,      // [PROPOSAL] examined eggs +10 %
      saturationPerSale: 1,     // saturation per sold egg of an element
      saturationStrength: 0.15, // price factor 1 / (1 + strength * saturation)
      saturationHalfLife: 300,  // seconds of play until saturation halves
      offerCount: 4,            // [PROPOSAL] rotating offers
      offerLifetime: [90, 240], // seconds of play
      offerWeights: { cheap: 0, common: 50, noble: 30, pure: 15, rare: 5 },
      pityShells: 10,           // [PROPOSAL] pity rule: 10 dud shells
      wonderEgg: {              // [PROPOSAL] daily wonder egg (free, never a dud)
        weights: { common: 40, noble: 35, pure: 20, rare: 5 },
      },
      examineCost: { cheap: 4, common: 10, noble: 30, pure: 80, rare: 250 }, // [PROPOSAL] examining costs gold
      chamberCapacity: 30,      // egg chamber
      startGold: 120,
    },

    // ---------------------------------------------------------------- Metal & gem dragons
    material: {
      // [FIXED] p_k = 1 / (base * growth^(k-1)), only from Cheap eggs
      base: 100,
      growth: 1.2,
      luckStep: 0.01,           // [PROPOSAL] luck counter: +1 % per Cheap egg without material
      factorPerTier: 0.25,      // [PROPOSAL] M_k = 1 + k/4
      riddleGlitter: 0.30,      // riddle mentions a glitter for material eggs
      riddleFalseGlitter: 0.01, // ... and sometimes deceives
      tiers: [
        { name: 'Copper',      color: '#B87333' },
        { name: 'Bronze',      color: '#CD7F32' },
        { name: 'Brass',       color: '#D4B35E' },
        { name: 'Amber',       color: '#FFB000' },
        { name: 'Silver',      color: '#C8CCD6' },
        { name: 'Gold',        color: '#FFD23F' },
        { name: 'Jade',        color: '#00A86B' },
        { name: 'Amethyst',    color: '#9966CC' },
        { name: 'Topaz',       color: '#FFC87C' },
        { name: 'Garnet',      color: '#A3122A' },
        { name: 'Pearl',       color: '#F3EEE2' },
        { name: 'Platinum',    color: '#E5E4E2' },
        { name: 'Opal',        color: '#A8D8CF' },
        { name: 'Sapphire',    color: '#1550C8' },
        { name: 'Emerald',     color: '#2FBF71' },
        { name: 'Ruby',        color: '#E0115F' },
        { name: 'Alexandrite', color: '#5E7FA8' },
        { name: 'Diamond',     color: '#CFF6FF' },
        { name: 'Black Opal',  color: '#262438' },
        { name: 'Red Diamond', color: '#FF2440' },
      ],
    },

    // ---------------------------------------------------------------- Breeding
    breed: {
      minYears: 50,             // designer: a new clutch takes at least 50 years
      chancePerYear: 1 / 50,    // [PROPOSAL] after the minimum, geometric extra wait (mean 50 years)
      adultBoost: 1.0,          // [OPEN] boost from 1000 years -> placeholder without effect
      restlessYears: 5,         // [PROPOSAL] warning "restless"
      nests: 3,                 // nesting ground: simultaneous pairs
      // [FIXED] clutch rolls
      gateMax: 6,               // a in {0..6}, 0 = empty
      xMax: 12,
      // [PROPOSAL] inheritance
      shiftMax: 2,              // shift 0..2 steps
      mutationChance: 0.05,     // new element with one step
      // animation
      shortAnimMs: 1500,
      bigClutch: 7,             // from this many eggs: special animation
    },

    // ---------------------------------------------------------------- Examination & riddles
    riddle: {
      repPerLevel: 100,         // school reputation per clarity level
      maxClarity: 6,
      baseHints: 2,
      hintsPerTwoLevels: 1,
      noiseStart: 0.45,         // share of misleading hints at school reputation 0
      noisePerLevel: 0.07,
      noiseMin: 0.05,
      hitRep: 20,               // school reputation per correct label
      streakBonus: 0.5,         // +50 % per hit in a row
      streakCap: 4,
      factionHitRep: 300,       // Riddle of the Elders: reputation with the faction
      // [PROPOSAL] consistent riddle language: each phrase always means the same elements
      phrases: [
        { t: 'The shell is warm.',                     el: ['fire', 'magma'] },
        { t: 'A crackle, barely audible.',             el: ['fire', 'lightning'] },
        { t: 'It throbs like a heart beneath embers.', el: ['magma', 'fire'] },
        { t: 'The shell is cool.',                     el: ['water', 'ice'] },
        { t: 'Fine droplets bead on it.',              el: ['water', 'nature'] },
        { t: 'It smells of rain.',                     el: ['water', 'wind'] },
        { t: 'It glows faintly from within.',          el: ['light', 'lightning'] },
        { t: 'The shell is smooth as glass.',          el: ['ice', 'light'] },
        { t: 'It wants to rise out of your hand.',     el: ['wind', 'light'] },
        { t: 'Plants lean towards it.',                el: ['nature', 'light'] },
        { t: 'It swallows the light.',                 el: ['dark', 'poison'] },
        { t: 'It grows restless at night.',            el: ['dark', 'lightning'] },
        { t: 'It never gets quite warm.',              el: ['ice', 'dark'] },
        { t: 'It is cold as a crypt.',                 el: ['dark', 'stone'] },
        { t: 'It hums when touched.',                  el: ['lightning', 'wind'] },
        { t: 'Your fingers tingle afterwards.',        el: ['poison', 'lightning'] },
        { t: 'It feels dry and rough.',                el: ['sand', 'stone'] },
        { t: 'Fine dust trickles off it.',             el: ['sand', 'wind'] },
        { t: 'It grinds softly when turned.',          el: ['sand', 'stone'] },
        { t: 'A faint draught surrounds it.',          el: ['wind', 'ice'] },
        { t: 'It is heavy as a boulder.',              el: ['stone', 'magma'] },
        { t: 'Moss grows on its underside.',           el: ['nature', 'stone'] },
        { t: 'A sweetish scent.',                      el: ['nature', 'poison'] },
        { t: 'It bubbles quietly.',                    el: ['magma', 'poison'] },
      ],
      glitter: 'Something glitters beneath the shell.',
    },

    // ---------------------------------------------------------------- Scales
    scales: {
      dropMeanSeconds: 30,      // [PROPOSAL] per adult dragon
      fractalChance: 0.05,      // [PROPOSAL]
      fractalFactor: 4,
      baseValue: 2,             // W_e (same for all elements)
      quality: {                // Q [PROPOSAL]
        common:  { name: 'Common',     factor: 1,  color: '#D8D2C0' },
        shimmer: { name: 'Shimmering', factor: 3,  color: '#8FF2FF' },
        war:     { name: 'War-marked', factor: 5,  color: '#FF5A3C' },
        radiant: { name: 'Radiant',    factor: 10, color: '#FFF27A' },
      },
      // [PROPOSAL] chance per drop that the dragon's quality appears on the scale
      qualityChance: { radiant: 0.35, war: 0.3, shimmer: 0.5 },
      comboWindowMs: 1200,      // fast collecting -> combo (display only)
      // [PROPOSAL] politics: the ruler's scales are in demand, its arch-enemy's are worth less
      rulerDemand: 1.25,
      rulerEnemyDemand: 0.75,
    },

    // ---------------------------------------------------------------- Reputation [PROPOSAL]
    rep: {
      levels: [
        { id: 'hated',      name: 'Hated',      min: -Infinity },
        { id: 'hostile',    name: 'Hostile',    min: -6000 },
        { id: 'unfriendly', name: 'Unfriendly', min: -2000 },
        { id: 'neutral',    name: 'Neutral',    min: 0 },
        { id: 'friendly',   name: 'Friendly',   min: 1000 },
        { id: 'honored',    name: 'Honored',    min: 3000 },
        { id: 'revered',    name: 'Revered',    min: 7000 },
        { id: 'exalted',    name: 'Exalted',    min: 14000 },
      ],
      cap: 21000,
      floor: -21000,
      transfer: 0.5,            // reputation spreads through the relationship matrix
      unlocks: {
        friendly: 'Common scales can be collected',
        honored:  'Fractal and shimmering scales can be collected, portal can open',
        revered:  'War-marked scales can be collected',
        exalted:  'Radiant scales can be collected',
      },
      // required level per scale
      need: { normal: 'friendly', fractal: 'honored', shimmer: 'honored', war: 'revered', radiant: 'exalted' },
    },

    // ---------------------------------------------------------------- Factions
    factions: {
      capacity: 8,              // K: capacity per faction
      startAdults: [2, 4],      // wild starting population per faction
      startAgeMax: 30000,
      rulerStartBonus: 2,
      startRuler: 'fire',
      // Worldviews: fire [FIXED], rest [OPEN] -> placeholder k = 0.5
      worldviews: {
        fire: { k: 0.1, text: 'Very domineering, rules with an iron fist.' },
      },
      worldviewPlaceholder: { k: 0.5, text: 'Worldview still open (placeholder).', placeholder: true },
      // Needs 0..100 [PROPOSAL]
      needs: {
        driftPerSecond: 0.01,   // approach towards the target value
        brutTarget: 50, ehreRuler: 75, ehreOther: 45, tributRuler: 70, tributOther: 35,
        raumFree: 1.5,          // space = 100 * clamp(raumFree - N/K)
      },
      // Faction choice on reaching adulthood [PROPOSAL]
      choice: { rulerPull: 1.5, rulerEnemyPush: 0.5 },
      govSize: 3,
      reformSeconds: 360,       // a fallen faction can re-form after this long ...
      reformMin: 2,             // ... once this many of its exiles have gathered (or a grown dragon chooses it)
    },

    wild: {
      breedChancePerYear: 1 / 120, // wild nests: very small population
      nestCapacity: 2,
      broodSeconds: 60,
    },

    // ---------------------------------------------------------------- Relations
    relations: {
      allianceThreshold: 60,    // both directions above -> alliance
      enemyCap: -20,            // arch-enemies never rise above this
      enemyStart: [-90, -60],
      otherStart: [-40, 62],     // some factions start close enough to ally
      asymmetry: 15,
      startAlliances: 4,        // bigger wars: allies always join
      reversion: 0.002,
      noise: 0.6,
      strong: 50,               // network view shows only |relation| >= strong
    },

    // ---------------------------------------------------------------- War [PROPOSAL]
    war: {
      baseRate: 1 / 400,        // war risk R -> chance per second = R * baseRate
      announceSeconds: 20,
      fightSeconds: 90,         // "a few minutes of play"
      fightSecondsMin: 30,      // wars get shorter under overpopulation
      cooldownSeconds: 60,
      cooldownPressureExp: 1,   // pause / (total population / total capacity)^exp -> reliable brake
      startPeaceSeconds: 300,   // peaceful start for new players
      allyWeight: 1.0,          // designer: alliances always help each other at full strength
      allyLoserDie: 0.2,        // allies on the losing side lose fewer dragons than the leader
      allyLoserDefect: 0.2,
      collapseBelow: 2,         // a faction with fewer adults after a lost war collapses
      exileReturnSeconds: 300,  // fled dragons come home after this long (if their faction still exists)
      victoryBond: 12,          // winners grow closer
      defeatStrain: 15,         // losing allies blame each other
      loserDie: 0.30,
      loserDefect: 0.30,
      ehreSwing: 30,
      relationHit: 25,
      tau: 9000 / -Math.log(0.9), // [FIXED] strength S(a) = exp(-(a-1000)/tau)
    },

    // ---------------------------------------------------------------- Rule [PROPOSAL]
    laws: {
      fire:   { name: 'Law of Fire',     text: '20 % levy on scale sales.', scaleTax: 0.20 },
      water:  { name: 'Law of the Tide', text: 'Eggs at the merchant 10 % cheaper.', eggDiscount: 0.10 },
      nature: { name: 'Grove Right',     text: 'Breeding chance of all pairs ×1.5.', breedMult: 1.5 },
      dark:   { name: 'Shadow Edict',    text: 'Parts of the relationship matrix are hidden.', hideRelations: 0.3 },
    },
    lawPlaceholder: { name: 'No law', text: 'This faction\'s law is still open (placeholder).', placeholder: true },

    // ---------------------------------------------------------------- Portals
    portals: {
      goldBase: 4000,           // portal for a lot of gold
      goldGrowth: 1.6,
      unlockLevel: 'honored',   // Honored with the faction or one of its allies
      closeLevel: 'hostile',    // from Hostile the portal closes
      backdoorPrice: 3000,      // [FIXED] expensive device, [PROPOSAL] values
      backdoorUpkeepPerMinute: 30,
      backdoorRepDrain: 2,      // reputation per second while the device runs
    },

    // ---------------------------------------------------------------- Activities [PROPOSAL]
    activities: {
      perFaction: 3,
      refreshSeconds: 600,
      rep: { neutral: 250, group: 500, counter: -500, war: 1200, warOthers: -200 },
      costs: {
        nestCare: 30, smallNeed: 60, banner: 400, alliance: 300, peace: 500,
        mixedPool: 2500, scaleOffer: 5, armor: 2, fractalGift: 1,
      },
      disturbSeconds: 180,
      lendSeconds: 180,
      floodRate: 0.5,
      rumorHit: 25,
      allianceBoost: 20,
    },

    // ---------------------------------------------------------------- Faction voices [OPEN]
    // Placeholders until the designer decides how factions speak.
    speech: {
      placeholder: true,
      warn: '{f}: Our sky grows crowded. We will not wait forever.',
      war: '{a} challenges {b}!',
      thanks: '{f}: We will not forget this.',
      angry: '{f}: You will regret this.',
    },

    names: {
      a: ['Ar', 'Bra', 'Cy', 'Dra', 'Ei', 'Fa', 'Gor', 'Hy', 'Ix', 'Ka', 'Ly', 'Mor', 'Ny', 'Or', 'Py', 'Qua', 'Ra', 'Sy', 'Tha', 'Ul', 'Va', 'Wy', 'Xe', 'Zy'],
      b: ['ga', 'ri', 'tho', 'mel', 'dra', 'ven', 'si', 'lo', 'na', 'ko', 'the', 'ru', 'vi', 'ze'],
      c: ['x', 'n', 'th', 'r', 'l', 's', 'ra', 'on', 'ix', 'el', 'is', 'ar', 'yn', 'or'],
    },
  };

  root.DRAGONLE_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
