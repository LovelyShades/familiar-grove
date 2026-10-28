import { SPECIES } from './registry';

/** What reaching a grove level brings, for toasts and the level preview. */
export function levelReward(level: number): { short: string; long: string } {
  const unlocked = SPECIES.filter((s) => s.unlock.groveLevel === level);
  if (unlocked.length) {
    const names = unlocked.map((s) => s.name).join(', ');
    return { short: `${names} can be called`, long: `New familiars answer the call: ${names}.` };
  }
  return { short: 'A brighter Heartwood', long: 'The Heartwood glows a little brighter.' };
}
