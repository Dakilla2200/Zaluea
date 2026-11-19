import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

export type { Color, Move, PieceSymbol, Square };

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export interface TrackedPiece {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
  /** Piece was captured on the most recent move; rendered as a fading ghost. */
  ghost?: boolean;
}

export type ResultKind =
  | 'checkmate'
  | 'timeout'
  | 'resign'
  | 'stalemate'
  | 'insufficient'
  | 'threefold'
  | 'fifty'
  | 'agreement'
  | 'timeout-insufficient';

export interface GameResult {
  kind: ResultKind;
  /** Undefined for draws. */
  winner?: Color;
}

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** Replays a list of moves from the start position, keeping full chess.js history (needed for repetition detection). */
export function replay(moves: MoveInput[]): { chess: Chess; verbose: Move[] } {
  const chess = new Chess();
  for (const m of moves) {
    try {
      chess.move(m);
    } catch {
      break; // corrupt saved data: stop at the last legal move
    }
  }
  return { chess, verbose: chess.history({ verbose: true }) };
}

/** 0..7 file index and 0..7 rank index (rank 0 = rank 1). */
export function squareToCoords(sq: Square): { file: number; rank: number } {
  return { file: sq.charCodeAt(0) - 97, rank: Number(sq[1]) - 1 };
}

export function coordsToSquare(file: number, rank: number): Square {
  return (FILES[file] + (rank + 1)) as Square;
}

const START_ROWS: Array<[Color, number, string]> = [
  ['w', 0, 'rnbqkbnr'],
  ['w', 1, 'pppppppp'],
  ['b', 6, 'pppppppp'],
  ['b', 7, 'rnbqkbnr'],
];

/**
 * Tracks every piece with a stable identity (based on its starting square) through the move list,
 * so the UI can animate pieces sliding between squares — forward and on undo.
 */
export function trackPieces(verbose: Move[]): TrackedPiece[] {
  const bySquare = new Map<Square, TrackedPiece>();
  for (const [color, rank, row] of START_ROWS) {
    row.split('').forEach((t, file) => {
      const sq = coordsToSquare(file, rank);
      bySquare.set(sq, { id: color + sq, type: t as PieceSymbol, color, square: sq });
    });
  }
  let ghosts: TrackedPiece[] = [];
  verbose.forEach((m, i) => {
    const last = i === verbose.length - 1;
    if (m.captured) {
      const capSq = m.isEnPassant() ? ((m.to[0] + m.from[1]) as Square) : m.to;
      const victim = bySquare.get(capSq);
      bySquare.delete(capSq);
      if (last && victim) ghosts = [{ ...victim, ghost: true }];
    }
    const mover = bySquare.get(m.from);
    bySquare.delete(m.from);
    if (mover) {
      bySquare.set(m.to, { ...mover, square: m.to, type: m.promotion ?? mover.type });
    }
    if (m.isKingsideCastle() || m.isQueensideCastle()) {
      const rank = m.from[1];
      const [rf, rt] = m.isKingsideCastle() ? ['h', 'f'] : ['a', 'd'];
      const rook = bySquare.get((rf + rank) as Square);
      bySquare.delete((rf + rank) as Square);
      if (rook) bySquare.set((rt + rank) as Square, { ...rook, square: (rt + rank) as Square });
    }
  });
  return [...ghosts, ...bySquare.values()];
}

/** Result determined purely by the position on the board. */
export function boardResult(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: other(chess.turn()) };
  if (chess.isStalemate()) return { kind: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { kind: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { kind: 'threefold' };
  if (chess.isDrawByFiftyMoves()) return { kind: 'fifty' };
  return null;
}

/**
 * FIDE 6.9: if a player's flag falls but the opponent cannot possibly checkmate
 * (lone king, or king + single minor piece), the game is drawn.
 */
export function canEverMate(chess: Chess, color: Color): boolean {
  const pieces = chess
    .board()
    .flat()
    .filter((p): p is NonNullable<typeof p> => !!p && p.color === color && p.type !== 'k');
  if (pieces.length === 0) return false;
  if (pieces.length === 1 && (pieces[0].type === 'n' || pieces[0].type === 'b')) return false;
  return true;
}

export function timeoutResult(chess: Chess, flagged: Color): GameResult {
  const opp = other(flagged);
  return canEverMate(chess, opp) ? { kind: 'timeout', winner: opp } : { kind: 'timeout-insufficient' };
}

/** Pieces captured BY each color, sorted by value (highest first). */
export function capturedBy(verbose: Move[]): Record<Color, PieceSymbol[]> {
  const out: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  for (const m of verbose) if (m.captured) out[m.color].push(m.captured);
  const order: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
  out.w.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  out.b.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return out;
}

/** Material balance from white's point of view (accounts for promotions). */
export function materialBalance(chess: Chess): number {
  let score = 0;
  for (const row of chess.board()) for (const p of row) if (p) score += (p.color === 'w' ? 1 : -1) * PIECE_VALUE[p.type];
  return score;
}

export function findKing(chess: Chess, color: Color): Square | null {
  for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return null;
}

export function resultTitle(r: GameResult): string {
  switch (r.kind) {
    case 'checkmate':
      return 'Checkmate';
    case 'timeout':
      return 'Time out';
    case 'resign':
      return 'Resignation';
    case 'stalemate':
      return 'Stalemate';
    case 'insufficient':
      return 'Insufficient material';
    case 'threefold':
      return 'Threefold repetition';
    case 'fifty':
      return '50-move rule';
    case 'agreement':
      return 'Draw by agreement';
    case 'timeout-insufficient':
      return 'Time out vs. insufficient material';
  }
}

export function pgnResult(r: GameResult | null): string {
  if (!r) return '*';
  if (!r.winner) return '1/2-1/2';
  return r.winner === 'w' ? '1-0' : '0-1';
}

export function buildPgn(verbose: Move[], result: GameResult | null, names: Record<Color, string>): string {
  const d = new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const res = pgnResult(result);
  const headers = [
    `[Event "Chess Duel"]`,
    `[Site "Local"]`,
    `[Date "${date}"]`,
    `[White "${names.w.replace(/"/g, '')}"]`,
    `[Black "${names.b.replace(/"/g, '')}"]`,
    `[Result "${res}"]`,
  ];
  const parts: string[] = [];
  verbose.forEach((m, i) => {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(m.san);
  });
  parts.push(res);
  return headers.join('\n') + '\n\n' + parts.join(' ');
}
