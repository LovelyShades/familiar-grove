// One-time tidy of MORE_IMAGES/: moves (never edits or deletes) each original into
// a folder by type with a consistent name, and writes RENAMES.md as a record.
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = 'MORE_IMAGES';
const MOVES = [
  ['familiar-grove-twilight-sky-layer-01.png', 'environment/sky-twilight.png'],
  ['Distant Twilight Mountain Silhouettes.png', 'environment/mountains-distant.png'],
  ['Distant moonlit fairy-gothic ruins.png', 'environment/ruins-distant.png'],
  ['Enchanted Distant Forest Silhouette.png', 'environment/forest-distant.png'],
  ['Moonlit Enchanted Forest Side Groves.png', 'environment/groves-side.png'],
  ['Moonlit Mossy Forest Ground Strip.png', 'environment/unused/ground-strip-sideview.png'],
  ['Moonlit Mossy Forest Clearing Sprite (1).png', 'environment/clearing-mossy.png'],
  ['Moonlit crystal stream with twin cascades.png', 'environment/stream-crystal-cascades.png'],
  ['Glowing Heartwood Tree Sprite.png', 'environment/heartwood-tree.png'],

  ['Moonmoth_Cat_Base.png', 'creatures/moonmoth-cat/moonmoth-cat_base.png'],
  ['Eclipse Moonmoth Sprite.png', 'creatures/moonmoth-cat/moonmoth-cat_rare_eclipse-moonmoth.png'],
  ['Opaline wyrmling teal dragon sprite.png', 'creatures/opaline-wyrmling/opaline-wyrmling_base.png'],
  ['Astral opaline wyrmling.png', 'creatures/opaline-wyrmling/opaline-wyrmling_rare_astral-opaline.png'],
  ['exec-bf359b1f-938d-40e7-a9fd-5698dda5c1fd.png', 'creatures/lunabloom-fawn/lunabloom-fawn_base.png'],
  ['Bloodmoon Lunabloom fawn sprite.png', 'creatures/lunabloom-fawn/lunabloom-fawn_rare_bloodmoon-lunabloom.png'],
  ['Fernwhorl Guardian with Crystal Glow.png', 'creatures/fernwhorl-guardian/fernwhorl-guardian_base.png'],
  ['Moonlit Mycelium Fernwhorl.png', 'creatures/fernwhorl-guardian/fernwhorl-guardian_rare_mycelium-fernwhorl.png'],
  ['new animals/Veilfin Drifter, Twilight Sky Familiar.png', 'creatures/veilfin-drifter/veilfin-drifter_base.png'],
  ['new animals/Pristine Nebula Veilfin Sprite.png', 'creatures/veilfin-drifter/veilfin-drifter_rare_nebula-veilfin.png'],
  ['new animals/Lanternshell Nimbi, luminous glass-shell snail.png', 'creatures/lanternshell-nimbi/lanternshell-nimbi_base.png'],
  ['new animals/Frostglass Nimbi.png', 'creatures/lanternshell-nimbi/lanternshell-nimbi_rare_frostglass-nimbi.png'],
  ['new animals/Arcveil Pangolith, Runed Woodland Guardian.png', 'creatures/arcveil-pangolith/arcveil-pangolith_base.png'],
  ['new animals/Aurora Pangolith in Opaline Armor.png', 'creatures/arcveil-pangolith/arcveil-pangolith_rare_aurora-pangolith.png'],
  ['new animals/Echoglass Pipbat, the Stained-Glass Bat.png', 'creatures/echoglass-pipbat/echoglass-pipbat_base.png'],
  ['new animals/Dreamglass Pipbat, moonstone stained-glass bat.png', 'creatures/echoglass-pipbat/echoglass-pipbat_rare_dreamglass-pipbat.png'],
  ['new animals/Runebloom axolume, moonlit rune familiar.png', 'creatures/runebloom-axolume/runebloom-axolume_base.png'],
  ['new animals/Pearldusk Axolume sprite (1).png', 'creatures/runebloom-axolume/runebloom-axolume_rare_pearldusk-axolume.png'],
  ['new animals/Starhollow Tapir, Crescent-Tailed Forest Spirit.png', 'creatures/starhollow-tapir/starhollow-tapir_base.png'],
  ['new animals/Astral_Hollow_Tapir.png', 'creatures/starhollow-tapir/starhollow-tapir_rare_astral-hollow-tapir.png'],

  ['familiar-grove-hanging-crystal-lantern.png', 'decorations/lantern-crystal-hanging.png'],
  ['familiar-grove-magical-crystal-cluster.png', 'decorations/crystal-cluster.png'],
  ['familiar-grove-magical-mushroom-cluster.png', 'decorations/mushroom-cluster.png'],
  ['familiar-grove-woodland-flower-bush.png', 'decorations/flower-bush.png'],

  ['familiar-grove-heart-click-pulse.png', 'effects/heart-click-pulse.png'],
  ['familiar-grove-aether-particle.png', 'effects/aether-particle.png'],
  ['familiar-grove-rare-encounter-aura.png', 'effects/rare-encounter-aura.png'],
  ['familiar-grove-familiar-summoning-portal.png', 'effects/summoning-portal.png'],

  ['familiar-grove-aether-currency-icon.png', 'ui/aether-currency-icon.png'],
  ['familiar-grove-dark-glass-ui-panel-frame.png', 'ui/glass-panel-frame.png'],
  ['familiar-grove-nav-grove.png', 'ui/nav-grove.png'],
  ['familiar-grove-nav-bestiary.png', 'ui/nav-bestiary.png'],
  ['familiar-grove-nav-summon.png', 'ui/nav-summon.png'],
  ['familiar-grove-nav-options.png', 'ui/nav-options.png'],

  ['Familiar_Grove_Refined_UI_Mockup_V2.png', 'reference/mockup-refined-v2_FINAL.png'],
  ['Familiar_Grove_Dark_Arcane_Glass_Mockup.png', 'reference/mockup-dark-arcane-glass_older.png'],
  ['Familiar Grove_ Heartwood and Four Familiars.png', 'reference/duplicates/mockup-refined-v2_identical-copy.png'],
];

const done = [];
for (const [from, to] of MOVES) {
  const src = path.join(DIR, from);
  const dst = path.join(DIR, to);
  if (!existsSync(src)) {
    if (existsSync(dst)) continue; // already moved
    console.warn(`missing: ${from}`);
    continue;
  }
  if (existsSync(dst)) throw new Error(`refusing to overwrite ${to}`);
  mkdirSync(path.dirname(dst), { recursive: true });
  renameSync(src, dst);
  done.push([from, to]);
}
const lines = MOVES.map(([from, to]) => `| \`${from}\` | \`${to}\` |`).join('\n');
writeFileSync(path.join(DIR, 'RENAMES.md'), `# Image index

Originals were moved into folders and renamed for clarity. File contents are unchanged.
The game reads these through \`scripts/asset-sources.mjs\` (run \`npm run assets\` after adding images).

- \`environment/\`: background layers (all 1672x941, stacked), terrain, stream, Heartwood Tree
- \`creatures/<species>/\`: \`<species>_base.png\` and \`<species>_rare_<mutation-name>.png\`
- \`decorations/\`, \`effects/\`, \`ui/\`: props, VFX and interface art
- \`reference/\`: mockups (\`_FINAL\` = Refined UI Mockup V2, the visual authority); \`duplicates/\` holds a byte-identical copy
- \`environment/unused/\`: kept but not used by the game

| Original name | New location |
|---|---|
${lines}
`);
console.log(`moved ${done.length} files`);
