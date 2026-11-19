import { describe, expect, it } from 'vitest';
import { signed, standing } from './standing';

describe('standing labels', () => {
  it('maps point gaps to labels for each side', () => {
    expect(standing(0).label).toBe('Fair');
    expect(standing(1).label).toBe('Low advantage');
    expect(standing(-2).label).toBe('Low disadvantage');
    expect(standing(3).label).toBe('Advantage');
    expect(standing(-5).label).toBe('Disadvantage');
    expect(standing(6).label).toBe('High advantage');
    expect(standing(-9).label).toBe('High disadvantage');
  });
  it('formats signed points', () => {
    expect(signed(9)).toBe('+9');
    expect(signed(-9)).toBe('−9');
    expect(signed(0)).toBe('0');
  });
});
