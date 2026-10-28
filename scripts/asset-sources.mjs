// Maps every original artwork file in MORE_IMAGES/ to its role in the game.
// The build script reads the originals and writes processed copies; it never
// modifies anything in MORE_IMAGES/.
//
// region: optional [x, y, width, height] — use only that piece of the original
//         (for icons cut from larger artwork; the original file is untouched).
//
// process:
//   'layer'  - full-canvas background layer: kept at its exact canvas size so
//              all layers stay aligned (no trim, no resize).
//   'sprite' - transparent padding trimmed, then scaled down to fit `maxSize`.

export const SOURCE_DIR = 'MORE_IMAGES';
export const OUTPUT_DIR = 'public/assets/grove';
export const MANIFEST_FILE = 'src/generated/assetManifest.json';

export const SOURCES = [
  // ---- environment layers (all 1672 x 941, stacked back to front)
  { id: 'env.sky', src: 'environment/sky-twilight.png', role: 'environment', process: 'layer' },
  { id: 'env.mountains', src: 'environment/mountains-distant.png', role: 'environment', process: 'layer' },
  { id: 'env.ruins', src: 'environment/ruins-distant.png', role: 'environment', process: 'layer' },
  { id: 'env.distantForest', src: 'environment/forest-distant.png', role: 'environment', process: 'layer' },
  { id: 'env.sideGroves', src: 'environment/groves-side.png', role: 'environment', process: 'layer' },
  { id: 'env.groundStrip', src: 'environment/unused/ground-strip-sideview.png', role: 'environment', process: 'layer', note: 'Side-view ground. Superseded by env.clearing; kept for reference.' },

  // ---- terrain and scenery sprites
  { id: 'env.clearing', src: 'environment/clearing-mossy.png', role: 'terrain', process: 'sprite', maxSize: 1672 },
  { id: 'env.stream', src: 'environment/stream-crystal-cascades.png', role: 'environment', process: 'sprite', maxSize: 1400 },
  { id: 'env.heartwood', src: 'environment/heartwood-tree.png', role: 'environment', process: 'sprite', maxSize: 1200 },

  // ---- familiars: one entry per species + variant
  { id: 'familiar.moonmoth_cat.base', src: 'creatures/moonmoth-cat/moonmoth-cat_base.png', role: 'familiar', species: 'moonmoth_cat', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.moonmoth_cat.rare', src: 'creatures/moonmoth-cat/moonmoth-cat_rare_eclipse-moonmoth.png', role: 'familiar', species: 'moonmoth_cat', variant: 'rare', process: 'sprite', maxSize: 800 },
  { id: 'familiar.opaline_wyrmling.base', src: 'creatures/opaline-wyrmling/opaline-wyrmling_base.png', role: 'familiar', species: 'opaline_wyrmling', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.opaline_wyrmling.rare', src: 'creatures/opaline-wyrmling/opaline-wyrmling_rare_astral-opaline.png', role: 'familiar', species: 'opaline_wyrmling', variant: 'rare', process: 'sprite', maxSize: 800 },
  { id: 'familiar.lunabloom_fawn.base', src: 'creatures/lunabloom-fawn/lunabloom-fawn_base.png', role: 'familiar', species: 'lunabloom_fawn', variant: 'base', process: 'sprite', maxSize: 800, note: 'Original has an auto-generated filename.' },
  { id: 'familiar.lunabloom_fawn.rare', src: 'creatures/lunabloom-fawn/lunabloom-fawn_rare_bloodmoon-lunabloom.png', role: 'familiar', species: 'lunabloom_fawn', variant: 'rare', process: 'sprite', maxSize: 800 },
  { id: 'familiar.fernwhorl.base', src: 'creatures/fernwhorl-guardian/fernwhorl-guardian_base.png', role: 'familiar', species: 'fernwhorl', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.fernwhorl.rare', src: 'creatures/fernwhorl-guardian/fernwhorl-guardian_rare_mycelium-fernwhorl.png', role: 'familiar', species: 'fernwhorl', variant: 'rare', process: 'sprite', maxSize: 800 },

  // ---- familiars added in the "new animals" folder
  { id: 'familiar.veilfin_drifter.base', src: 'creatures/veilfin-drifter/veilfin-drifter_base.png', role: 'familiar', species: 'veilfin_drifter', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.veilfin_drifter.rare', src: 'creatures/veilfin-drifter/veilfin-drifter_rare_nebula-veilfin.png', role: 'familiar', species: 'veilfin_drifter', variant: 'rare', process: 'sprite', maxSize: 800, note: 'Filename says "Pristine Nebula Veilfin"; treated as the Nebula Veilfin mutation.' },
  { id: 'familiar.lanternshell_nimbi.base', src: 'creatures/lanternshell-nimbi/lanternshell-nimbi_base.png', role: 'familiar', species: 'lanternshell_nimbi', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.lanternshell_nimbi.rare', src: 'creatures/lanternshell-nimbi/lanternshell-nimbi_rare_frostglass-nimbi.png', role: 'familiar', species: 'lanternshell_nimbi', variant: 'rare', process: 'sprite', maxSize: 800 },
  { id: 'familiar.arcveil_pangolith.base', src: 'creatures/arcveil-pangolith/arcveil-pangolith_base.png', role: 'familiar', species: 'arcveil_pangolith', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.arcveil_pangolith.rare', src: 'creatures/arcveil-pangolith/arcveil-pangolith_rare_aurora-pangolith.png', role: 'familiar', species: 'arcveil_pangolith', variant: 'rare', process: 'sprite', maxSize: 800 },
  { id: 'familiar.echoglass_pipbat.base', src: 'creatures/echoglass-pipbat/echoglass-pipbat_base.png', role: 'familiar', species: 'echoglass_pipbat', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.echoglass_pipbat.rare', src: 'creatures/echoglass-pipbat/echoglass-pipbat_rare_dreamglass-pipbat.png', role: 'familiar', species: 'echoglass_pipbat', variant: 'rare', process: 'sprite', maxSize: 800 },
  { id: 'familiar.runebloom_axolume.base', src: 'creatures/runebloom-axolume/runebloom-axolume_base.png', role: 'familiar', species: 'runebloom_axolume', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.runebloom_axolume.rare', src: 'creatures/runebloom-axolume/runebloom-axolume_rare_pearldusk-axolume.png', role: 'familiar', species: 'runebloom_axolume', variant: 'rare', process: 'sprite', maxSize: 800 },
  { id: 'familiar.starhollow_tapir.base', src: 'creatures/starhollow-tapir/starhollow-tapir_base.png', role: 'familiar', species: 'starhollow_tapir', variant: 'base', process: 'sprite', maxSize: 800 },
  { id: 'familiar.starhollow_tapir.rare', src: 'creatures/starhollow-tapir/starhollow-tapir_rare_astral-hollow-tapir.png', role: 'familiar', species: 'starhollow_tapir', variant: 'rare', process: 'sprite', maxSize: 800 },

  // ---- decorations
  { id: 'decor.lantern', src: 'decorations/lantern-crystal-hanging.png', role: 'decoration', process: 'sprite', maxSize: 600 },
  { id: 'decor.crystals', src: 'decorations/crystal-cluster.png', role: 'decoration', process: 'sprite', maxSize: 500 },
  { id: 'decor.mushrooms', src: 'decorations/mushroom-cluster.png', role: 'decoration', process: 'sprite', maxSize: 500 },
  { id: 'decor.moonlitBlossoms', src: 'ui/upgrade-icons/moonlit-blossoms.png', role: 'decoration', process: 'sprite', maxSize: 420, note: 'World-size copy of the Moonlit Blossoms art, used for the upgrade flower clusters.' },
  { id: 'decor.flowerBush', src: 'decorations/flower-bush.png', role: 'decoration', process: 'sprite', maxSize: 700 },

  // ---- effects
  { id: 'fx.heartPulse', src: 'effects/heart-click-pulse.png', role: 'effect', process: 'sprite', maxSize: 700 },
  { id: 'fx.aetherParticle', src: 'effects/aether-particle.png', role: 'effect', process: 'sprite', maxSize: 128 },
  { id: 'fx.rareAura', src: 'effects/rare-encounter-aura.png', role: 'effect', process: 'sprite', maxSize: 700 },
  { id: 'fx.summonPortal', src: 'effects/summoning-portal.png', role: 'effect', process: 'sprite', maxSize: 700 },

  // ---- interface
  { id: 'ui.aether', src: 'ui/aether-currency-icon.png', role: 'ui', process: 'sprite', maxSize: 256 },
  { id: 'ui.glassPanel', src: 'ui/glass-panel-frame.png', role: 'ui', process: 'sprite', maxSize: 1983 },
  { id: 'ui.nav.grove', src: 'ui/nav-grove.png', role: 'ui', process: 'sprite', maxSize: 256 },
  { id: 'ui.nav.bestiary', src: 'ui/nav-bestiary.png', role: 'ui', process: 'sprite', maxSize: 256 },
  { id: 'ui.nav.summon', src: 'ui/nav-summon.png', role: 'ui', process: 'sprite', maxSize: 256 },
  { id: 'ui.upgrade.moonlitBlossoms', src: 'ui/upgrade-icons/moonlit-blossoms.png', role: 'ui', process: 'sprite', maxSize: 256 },
  { id: 'ui.upgrade.whisperingRoots', src: 'environment/heartwood-tree.png', region: [500, 800, 360, 330], role: 'ui', process: 'sprite', maxSize: 256, note: 'The Heartwood roots, cut from the tree art, as the Whispering Roots icon.' },
  { id: 'ui.nav.options', src: 'ui/nav-options.png', role: 'ui', process: 'sprite', maxSize: 256 },
];

// Reference images: checked for presence but never shipped in the game.
export const REFERENCE_ONLY = [
  'reference/mockup-refined-v2_FINAL.png',
  'reference/mockup-dark-arcane-glass_older.png',
  'reference/duplicates/mockup-refined-v2_identical-copy.png',
];
