import type { Color, Move } from './game';
import type { EngineEval } from './engine';

export const moveUci = (m: Pick<Move, 'from' | 'to' | 'promotion'>) => m.from + m.to + (m.promotion ?? '');

export type MoveClass = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'forced';

export const CLASS_INFO: Record<MoveClass, { label: string; symbol: string; color: string }> = {
  best: { label: 'Best', symbol: '★', color: '#4cc264' },
  excellent: { label: 'Excellent', symbol: '!', color: '#7bcf5a' },
  good: { label: 'Good', symbol: '✓', color: '#14b8c4' },
  forced: { label: 'Forced', symbol: '→', color: '#a9a1cc' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#ffc93c' },
  mistake: { label: 'Mistake', symbol: '?', color: '#ff8a1f' },
  blunder: { label: 'Blunder', symbol: '??', color: '#ff4d5e' },
};

export const CLASS_ORDER: MoveClass[] = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];

/** White's winning chances 0..100 for an evaluation (lichess model). */
export function whiteWinPct(e: Pick<EngineEval, 'cp' | 'mate'>): number {
  if (e.mate !== undefined) return e.mate > 0 ? 100 : e.mate < 0 ? 0 : 50;
  const cp = Math.max(-1500, Math.min(1500, e.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Per-move accuracy from the drop in the mover's win chances (lichess formula). */
export function moveAccuracy(winLoss: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669));
}

export interface ReviewedMove {
  cls: MoveClass;
  /** mover's win% lost by this move */
  loss: number;
  accuracy: number;
  /** engine's preferred move in the position before, UCI */
  best: string | null;
  bestSan: string | null;
}

/**
 * Classifies a move. `before` is the engine's best line in the position before the move and
 * `played` the evaluation of the move actually played, searched from that same position
 * (so both share side to move and depth). `legalCount` = legal moves available (1 = forced).
 */
export function classify(move: Move, before: EngineEval, played: Pick<EngineEval, 'cp' | 'mate'>, legalCount: number, bestSan: string | null): ReviewedMove {
  const sign = move.color === 'w' ? 1 : -1;
  const pBefore = sign > 0 ? whiteWinPct(before) : 100 - whiteWinPct(before);
  const pAfter = sign > 0 ? whiteWinPct(played) : 100 - whiteWinPct(played);
  const loss = Math.max(0, pBefore - pAfter);
  const uci = moveUci(move);
  let cls: MoveClass;
  if (legalCount === 1) cls = 'forced';
  else if (before.best === uci || loss < 0.5) cls = 'best';
  else if (loss < 2.5) cls = 'excellent';
  else if (loss < 6) cls = 'good';
  else if (loss < 12) cls = 'inaccuracy';
  else if (loss < 22) cls = 'mistake';
  else cls = 'blunder';
  return { cls, loss, accuracy: moveAccuracy(loss), best: before.best, bestSan };
}

export function summarize(moves: Move[], reviewed: Array<ReviewedMove | undefined>) {
  const acc: Record<Color, number[]> = { w: [], b: [] };
  const counts: Record<Color, Record<MoveClass, number>> = {
    w: { best: 0, excellent: 0, good: 0, forced: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    b: { best: 0, excellent: 0, good: 0, forced: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
  };
  reviewed.forEach((r, i) => {
    if (!r) return;
    const c = moves[i].color;
    counts[c][r.cls]++;
    if (r.cls !== 'forced') acc[c].push(r.accuracy);
  });
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  return { accuracy: { w: avg(acc.w), b: avg(acc.b) }, counts };
}

/** Human-readable evaluation like "+1.4", "-0.3" or "M3". */
export function formatEval(e: Pick<EngineEval, 'cp' | 'mate'> | undefined): string {
  if (!e) return '…';
  if (e.mate !== undefined) return e.mate === 0 ? '#' : `${e.mate > 0 ? '' : '-'}M${Math.abs(e.mate)}`;
  const v = (e.cp ?? 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}
