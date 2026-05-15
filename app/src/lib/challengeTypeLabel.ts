import type { TFunction } from 'i18next';

const KNOWN = new Set(['food', 'fitness', 'shopping', 'game']);

export function challengeTypeLabel(t: TFunction, challengeType: string): string {
  if (KNOWN.has(challengeType)) {
    return t(`challengeTypes.${challengeType}`);
  }
  return challengeType;
}
