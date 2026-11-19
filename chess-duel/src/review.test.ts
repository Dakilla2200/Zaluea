import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { classify, formatEval, moveAccuracy, summarize, whiteWinPct } from './review';

const mv = (fen: string, san: string) => new Chess(fen).move(san);
const START = new Chess().fen();

describe('review maths', () => {
  it('maps evaluations to win chances', () => {
    expect(whiteWinPct({ cp: 0 })).toBeCloseTo(50);
    expect(whiteWinPct({ cp: 300 })).toBeGreaterThan(75);
    expect(whiteWinPct({ cp: -300 })).toBeLessThan(25);
    expect(whiteWinPct({ mate: 2 })).toBe(100);
    expect(whiteWinPct({ mate: -1 })).toBe(0);
  });

  it('gives 100% accuracy for a lossless move and less for bigger losses', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0);
    expect(moveAccuracy(10)).toBeLessThan(moveAccuracy(2));
    expect(moveAccuracy(80)).toBeGreaterThanOrEqual(0);
  });

  it('marks the engine move as best and big drops as blunders, for either colour', () => {
    const e4 = mv(START, 'e4');
    expect(classify(e4, { cp: 30, best: 'e2e4' }, { cp: 30 }, 20, 'e4').cls).toBe('best');
    expect(classify(e4, { cp: 30, best: 'd2d4' }, { cp: 25 }, 20, 'd4').cls).toBe('best'); // < 0.5% loss
    expect(classify(e4, { cp: 30, best: 'd2d4' }, { cp: -400 }, 20, 'd4').cls).toBe('blunder');
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
    const nf6 = mv(fen, 'Nf6');
    // for Black, a jump in White's favour is a loss
    expect(classify(nf6, { cp: -50, best: 'g7g6' }, { mate: 1 }, 30, 'g6').cls).toBe('blunder');
    expect(classify(nf6, { cp: 20, best: 'd8e7' }, { cp: 120 }, 30, 'Qe7').cls).toBe('inaccuracy');
    expect(classify(nf6, { cp: 20, best: 'd8e7' }, { cp: 250 }, 30, 'Qe7').cls).toBe('mistake');
  });

  it('marks moves with a single legal option as forced and excludes them from accuracy', () => {
    const fen = 'k7/8/2K5/8/8/8/8/1R6 b - - 0 1'; // Black king's only move is Ka7
    expect(new Chess(fen).moves()).toEqual(['Ka7']);
    const m = mv(fen, 'Ka7');
    const r = classify(m, { cp: -900, best: 'a8a7' }, { cp: -900 }, 1, 'Ka7');
    expect(r.cls).toBe('forced');
    expect(summarize([m], [r]).accuracy.b).toBeNull();
  });

  it('formats evaluations', () => {
    expect(formatEval({ cp: 140 })).toBe('+1.4');
    expect(formatEval({ cp: -35 })).toBe('-0.3');
    expect(formatEval({ mate: 3 })).toBe('M3');
    expect(formatEval({ mate: -2 })).toBe('-M2');
  });
});
