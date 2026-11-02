# Minele: The Bottomless Mine

A retro pixel mining game in plain HTML, CSS and JavaScript. No build step, no dependencies.

The look and feel come from [Dicele](../Dicele); the gameplay, items, upgrades and achievements come from RogueMiner (Unity).

## How to play

1. **Smash the rock.** Tap it to swing, hold to keep swinging. It wiggles: a swing that misses does nothing.
2. **Damage** = (strength × 10 + pickaxe × 100) ÷ hardness, ±10% plus agility, times a crit roll (0.4× up to 3.6×).
3. **Every rock** pays score (80 × dimension × luck × player power) and drops one find: common stone, uncommon mineral, rare gem, epic gem or legendary element. Luckier rocks drop better finds.
4. **Reach the goal** (400 × 1.15^level) before the rocks run out and you go a level deeper with 6 + 3 × level rocks. Out of rocks below the goal ends the run.
5. **Deeper is darker.** Every level the cage takes you 50 m down. The lamplight shrinks, all sound drops half a semitone and gains echo (an octave at most), the mine's drone, whispers and heartbeat grow, and more pairs of eyes open in the dark and turn to watch you. Rare finds make the shaft lurch and every eye go wide.
6. **Finds, gold, upgrades and achievements are kept forever.** Sell finds in the bag; the shop's 8 upgrades (up to 100 levels each) cost gold and specific finds.

Buttons: 🏆 leaderboard (this device), ? rules, ⚡ flashy animations, ♪ sound, 🎒 bag, 🛒 shop, 🏅 achievements.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `style.css` | Pixel mine look and all animations |
| `script.js` | Game rules, sound (Web Audio), effects, bag, shop, achievements |
| `data.js` | 160 items, 8 upgrades and 104 achievements, generated from RogueMiner's `Loot-DB`, `ShopDB` and `Achievement-DB` |

Saves live in `localStorage` (`minele-save`, `minele-leaderboard`).

## Run locally

```bash
python -m http.server 8124
```
