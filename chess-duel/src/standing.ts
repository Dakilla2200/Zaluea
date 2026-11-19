/**
 * Material "points" (pawn 1, knight 3, bishop 3, rook 5, queen 9) and the friendly
 * standing label derived from the point gap, from one player's point of view.
 */
export type StandingTone = 'high-adv' | 'adv' | 'low-adv' | 'fair' | 'low-dis' | 'dis' | 'high-dis';

export function standing(diff: number): { label: string; tone: StandingTone } {
  const d = Math.abs(diff);
  if (d === 0) return { label: 'Fair', tone: 'fair' };
  const ahead = diff > 0;
  if (d <= 2) return ahead ? { label: 'Low advantage', tone: 'low-adv' } : { label: 'Low disadvantage', tone: 'low-dis' };
  if (d <= 5) return ahead ? { label: 'Advantage', tone: 'adv' } : { label: 'Disadvantage', tone: 'dis' };
  return ahead ? { label: 'High advantage', tone: 'high-adv' } : { label: 'High disadvantage', tone: 'high-dis' };
}

/** "+3", "−9" or "0" with a real minus sign. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
