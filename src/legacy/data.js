// All game balance numbers and content live here so they are easy to tweak.

export const SAVE_KEY = 'familiarGrove.save.v1';
export const AUTOSAVE_MS = 5000;
export const OFFLINE_CAP_SEC = 8 * 60 * 60;
export const FAMILIAR_COST_GROWTH = 1.15;

// Time-flow options shown in the Options menu (multiplies passive income).
export const SPEEDS = [0.25, 0.5, 1, 2, 3, 5, 10];

// Click upgrade.
export const SPELL = {
  id: 'arcane_touch',
  name: 'Arcane Touch',
  desc: 'Draw a surge of Aether from the Heartwood Tree.',
  baseCost: 10,
  growth: 1.45,
};

// Passive upgrades. `cap` = how many of this creature are drawn in the grove at once.
// `height` = drawn height in world pixels. `pngHeight` overrides it when a PNG is used.
export const FAMILIARS = [
  {
    id: 'moonpaw_cat', name: 'Moonpaw Cat', baseCost: 15, baseRate: 0.5,
    behavior: 'walk', cap: 10, height: 64, speed: 42,
    lore: 'Star-speckled cats that nap in moonbeams and purr Aether into the roots.',
  },
  {
    id: 'starlit_owl', name: 'Starlit Owl', baseCost: 110, baseRate: 3,
    behavior: 'perch', cap: 6, height: 58,
    lore: 'Silent watchers that gather starlight from the Heartwood\'s highest branches.',
  },
  {
    id: 'mossling', name: 'Mossling', baseCost: 1200, baseRate: 16,
    behavior: 'hop', cap: 10, height: 46, speed: 34,
    lore: 'Bouncy moss sprites. Wherever they land, tiny glowcaps sprout.',
  },
  {
    id: 'flutterdrake', name: 'Flutterdrake', baseCost: 13000, baseRate: 90,
    behavior: 'fly', cap: 6, height: 70,
    lore: 'Pocket-sized dragons that weave little spells on the night wind.',
  },
  {
    id: 'spirit_stag', name: 'Spirit Stag', baseCost: 140000, baseRate: 520,
    behavior: 'walk', cap: 4, height: 150, speed: 26,
    lore: 'Ancient deer crowned in glowing mushrooms. The forest blooms where they step.',
  },
  {
    id: 'mossback_bear', name: 'Mossback Bear', baseCost: 1.6e6, baseRate: 3200,
    behavior: 'roam', cap: 3, height: 140, speed: 16,
    lore: 'Gentle giants with whole gardens growing on their backs.',
  },
  {
    id: 'astral_wyrm', name: 'Astral Wyrm', baseCost: 2.2e7, baseRate: 22000,
    behavior: 'wyrm', cap: 2, height: 46, pngHeight: 240,
    lore: 'A serpent of living starlight that coils endlessly through the night sky.',
  },
];

// Every familiar you summon rolls a rarity. Rarer = more Aether and a glowing aura.
export const RARITIES = [
  { id: 'common', name: 'Common', mult: 1, weight: 70, color: '#d6dccb' },
  { id: 'uncommon', name: 'Uncommon', mult: 1.5, weight: 20, color: '#62d68f' },
  { id: 'rare', name: 'Rare', mult: 3, weight: 7, color: '#5cb4ff' },
  { id: 'epic', name: 'Epic', mult: 6, weight: 2.5, color: '#c47bff' },
  { id: 'legendary', name: 'Legendary', mult: 15, weight: 0.5, color: '#ffc94d' },
];

export const GROVE_UPGRADES = [
  {
    id: 'crystal_springs', name: 'Crystal Springs', icon: 'spring',
    desc: '+50% click power (stacks)', baseCost: 250, growth: 3,
  },
  {
    id: 'luminous_canopy', name: 'Luminous Canopy', icon: 'canopy',
    desc: '+20% Aether per second (stacks)', baseCost: 600, growth: 2.6,
  },
  {
    id: 'familiar_haven', name: 'Familiar Haven', icon: 'paw',
    desc: 'Rare familiars appear more often', baseCost: 2000, growth: 3.5, max: 10,
  },
  {
    id: 'star_attunement', name: 'Star Attunement', icon: 'star',
    desc: 'Each click also channels 2% of your Aether/sec', baseCost: 7500, growth: 4,
  },
];

// Grove level comes from lifetime Aether. Each level unlocks scenery.
export function levelThreshold(n) {
  return n <= 1 ? 0 : 50 * Math.pow(3.2, n - 2);
}

export const GROVE_UNLOCKS = [
  { level: 2, text: 'Glowcaps sprout around the roots' },
  { level: 3, text: 'Lanterns light up the Heartwood' },
  { level: 4, text: 'Wildflowers bloom across the grove' },
  { level: 5, text: 'Aether crystals rise from the earth' },
  { level: 6, text: 'The Crystal Falls begin to flow' },
  { level: 7, text: 'Elven treehouses appear in the branches' },
  { level: 8, text: 'Ancient runestones awaken' },
  { level: 9, text: 'An aurora ripples across the sky' },
  { level: 10, text: 'Elves settle on the cliffs' },
  { level: 12, text: 'Forest spirits come out to play' },
  { level: 15, text: 'Stars begin to fall over the grove' },
  { level: 18, text: 'The Heartwood radiates a mythic aura' },
];
