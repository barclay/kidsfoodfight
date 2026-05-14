/** Replace `glyph` with PNG `Image` sources when assets are ready; keep `id` stable for the API. */
export const CHALLENGE_STICKER_PALETTE = [
  { id: 'sticker_a', glyph: '🎭' },
  { id: 'sticker_b', glyph: '🦄' },
  { id: 'sticker_c', glyph: '🦸' },
] as const;

export type ChallengeStickerId = (typeof CHALLENGE_STICKER_PALETTE)[number]['id'];

export function glyphForStickerId(id: string): string {
  const row = CHALLENGE_STICKER_PALETTE.find((s) => s.id === id);
  return row?.glyph ?? '⭐';
}
