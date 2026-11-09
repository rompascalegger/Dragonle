# Dragonle

A retro pixel web game about dragon eggs, young dragons and the politics of the sky. Plain HTML, CSS and JavaScript – no build step, no dependencies.

A dragon world serves as the hub, with portals to twelve elemental zones. You buy or breed eggs, hatch them in a zone, raise the young dragons at the Dragon School, and once they are grown they choose a faction, fly in the sky and drop scales you can collect and sell. On top sits a political layer with twelve factions, reputation, alliances, a Dragon King and wars.

## Core rules

- **1 game year = 1 second.** Things only happen while you play; offline only adult dragons keep ageing.
- **Element vector:** every dragon has a share of each of the 12 elements in 5 % steps (20 steps total). Its scales are pure colours in that ratio (dithering); rare fractal scales carry the mixed colour.
- **Life cycle:** egg → incubation (placeholder 30 s) → hatch (last crack by click) → Dragon School (a level every 10 years, mature at 300) → adult at 1000 years: imprinted by its zone, picks a faction, flies in the sky.
- **Clutch:** gate roll 0–6 (0 = empty), then x ∈ 1–12, y ∈ 1–x, z ∈ 1–y eggs. Every roll is shown and logged.
- **Eggs:** Cheap, Common, Noble, Purebred, Rare mix. Any bought egg may be a dud (shell refunded); 10 dud shells grant a better egg. Metal and gem dragons (20 tiers, 1 : 100 × 1.2^(k−1)) hatch only from Cheap eggs.
- **Riddles:** examining an egg gives three uncertain candidates and a riddle in a consistent hint language. A correct label earns school reputation, which makes later riddles clearer.
- **Factions:** reputation from Hated to Exalted, transferred through an asymmetric relationship matrix; alliances with their own names and colours; 20 activities to court factions; needs, war risk, transparent war rolls, a Dragon King (the eldest of the ruling faction) and laws.

## Court & diplomacy

Every 20 game years the Dragon King gives a speech in the herald bar at the bottom; ministers brief you in between, and every third speech issues a royal decree with a real effect. The Court tab offers audiences with the King, envoys (alliance, pact of peace, royal wedding, tribute), war pledges and peace talks. Battles end in a skippable anime-style cutscene that shows the real power ratio and the decisive roll.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `style.css` | Retro pixel look (notched pixel borders, pixel fonts, stepped animations) |
| `config.js` | **All balancing numbers** (tagged FIXED / PROPOSAL / OPEN from the design spec) |
| `core.js` | Game logic without DOM (also runs in Node) |
| `sprites.js` | Runtime pixel art: dragons, eggs, scales, portals, hatcheries, icons, sky dragons |
| `voices.js` | The voices of the twelve factions: battle cries, royal openings, declarations, victory and defeat lines |
| `court.js` | Royal speeches, minister briefings, declarations and laments built from the live state of the realm |
| `cinema.js` | Anime-style pixel war cutscene: focus lines, champion face-off, VS slam, beam struggle, decisive roll |
| `ui.js` | Screens, animations, the proportional sky, the 13-chapter Keeper's Handbook and sound |
| `tools/sim.js`, `tools/sim.html` | Balancing simulation (bot plays for hours, reports population, gold, wars) |
| `tools/sprites.html` | Sprite sheet for art review |

Save: `localStorage` key `dragonle-v3`.

## Open points (placeholders)

Brood time, hatcheries other than lava pool and ember oven, worldviews other than Fire, faction voices, music, alliance names (generated from element syllables), the breeding boost from 1000 years.

## Testing aids

- `?speed=20` speeds up time, `?seed=42` starts a new game with a fixed seed.
- `tools/sim.html?args=3,7` runs the balancing simulation for 3 hours with seed 7 (or `node tools/sim.js 3 7`).

## Run locally

```bash
python -m http.server 8126
```
