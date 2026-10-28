# Familiar Grove

A cozy dark-fantasy incremental game. Tend the Heartwood Tree, gather **Aether**,
grow your grove with magical upgrades, and summon mythical familiars — each with
a rare mutation to discover.

**[▶ Watch the demo video](https://youtu.be/N1hPtyzu6Qc)** · **[Play it in your browser](https://lovelyshades.github.io/familiar-grove/)**

[![Familiar Grove demo video](https://img.youtube.com/vi/N1hPtyzu6Qc/hqdefault.jpg)](https://youtu.be/N1hPtyzu6Qc)

Built with React, TypeScript, PixiJS and Vite.

## Running it

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
npm run dev        # play at http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run assets` | Re-process artwork from `MORE_IMAGES/` (only changed files) |
| `npm test` | Game-logic tests (economy, saving, summoning) |
| `npm run typecheck` | TypeScript check |

The game must be served (dev server or `npm run preview`); opening `index.html`
from the file system won't work. The previous vanilla version is kept at
`/legacy.html`.

## How to play

- A title screen opens the game; first-time players get a short guided tour (replay it from Options).
- **Click the Heartwood Tree** (or Tab to it and press Enter/Space) to gather Aether.
- **Arcane Touch** and **Prismatic Crystals** raise Aether per click.
- **Grove Upgrades** (Glimmercap Mushrooms, Whispering Roots, Moonlit Blossoms,
  Moonveil Elderwood, Astral Spark) produce Aether every second. New ones
  appear as your grove grows. Use **Buy ×1 / ×10 / Max**.
- **Mystery Summon** calls a random familiar: the species is rolled by rarity
  tier, then its own rare-mutation chance (3% + 0.75% per Bond level, max 18%;
  Moon's Favor guarantees one after 30 tries). Duplicates add Familiar Bond.
- Grove levels unlock new species ("Something awakens…").
- The **Bestiary** tracks 10 species / 20 appearances, attunement, bond, and
  which 4 familiars live in the grove.
- **Options**: Moonlit Night / Moonstone Glass interface style, time speed,
  sound, parallax, reduced motion, quick summon, records, guided tour, Reset.
- Progress saves automatically, with offline earnings (up to 8 hours).

## Rubric checklist

| Requirement | Where |
|---|---|
| 0. Theme | Moonlit enchanted grove of mythical familiars, original pixel art |
| 1. Click to increase | Heartwood Tree; Aether count in the top bar |
| 2. Click upgrade | Arcane Touch: price shown, disabled when unaffordable, cost ×1.45 per level |
| 3. Passive upgrade | Glimmercap Mushrooms + 4 more; "+X / sec" in the top bar; cost ×1.15 per level |
| 4. Visual | Layered PixiJS forest with parallax, living familiars, upgrade-driven scenery (blossoms, glowing mushrooms, veins), fireflies and glow that grow with grove level (capped); numbers shorten (24.6K, 3.82M, 1.2e42) |
| 5. Options menu | Options panel (open/close): light/dark style, time speed slider, Reset All |
| 6. Saving | Versioned localStorage save with migration and offline earnings |
| 7. Color and style | Frosted-glass UI, Cinzel/Alegreya fonts, midnight/violet/teal palette |

## Project structure

```
MORE_IMAGES/            original artwork (never modified)
scripts/                asset pipeline: asset-sources.mjs (file → id map), build-assets.mjs
public/assets/grove/    processed WebP copies (generated)
src/
  game/                 game logic, no React: config, registry, state, economy, summoning, store, tests
  scene/                PixiJS grove: GroveScene, layout (positions/slots), effects
  audio/                synthesized Web Audio engine and sounds
  ui/                   React components (top bar, sidebar, nav, summon/, bestiary/, settings/)
  app/                  App shell, store hook
  styles/               glass UI styles
  legacy/               the previous version (legacy.html)
```

### Tuning and adding content

- **Balance** (upgrade costs/rates, summon price, mutation chance, bond, active
  familiar limit, offline cap): `src/game/config.ts`.
- **Creatures**: add images to `MORE_IMAGES/`, map them in
  `scripts/asset-sources.mjs`, run `npm run assets`, then add one entry to
  `SPECIES` in `src/game/registry.ts` (name, rarity tier, unlock level, size,
  facing, habitat, idle motion, portrait focus). Everything else — summoning,
  Bestiary, totals, scene placement — picks it up automatically.
- **Scene positions**: `src/scene/layout.ts`.

### Save format

`localStorage["familiar-grove:save"]`, versioned (`version: 2`). `migrateSave()`
in `src/game/state.ts` validates every field, fills defaults for anything new,
drops unknown species, and never trusts a timestamp from the future.
