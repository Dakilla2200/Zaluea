import { Chess } from 'chess.js';
import type { Color, Move, PieceSymbol } from './game';
import type { MoveClass } from './review';

const PIECE: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** One plain-English sentence for a move, no chess notation. */
export function describeMove(m: Move, names: Record<Color, string>, after?: Chess): string {
  const who = names[m.color];
  let s: string;
  if (m.isKingsideCastle() || m.isQueensideCastle()) s = `${who} tucked the king away to safety (castling).`;
  else if (m.isEnPassant()) s = `${who}'s pawn took a pawn with a special move called “en passant”.`;
  else if (m.captured) s = `${who}'s ${PIECE[m.piece]} took a ${PIECE[m.captured]}.`;
  else if (m.piece === 'p') s = `${who} moved a pawn forward.`;
  else s = `${who} moved the ${PIECE[m.piece]}.`;
  if (m.promotion) s = s.replace(/\.$/, '') + ` and it turned into a ${PIECE[m.promotion]}!`;
  const pos = after ?? new Chess(m.after);
  if (pos.isCheckmate()) s += ' Checkmate, game over!';
  else if (pos.isCheck()) s += ' Check: the king is under attack.';
  return s;
}

/** Plain-English suggestion for the engine's better move, e.g. "taking the knight with your bishop". */
export function describeSuggestion(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  let m: Move;
  try {
    m = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
  const after = new Chess(m.after);
  let s: string;
  if (m.isKingsideCastle() || m.isQueensideCastle()) s = 'castling to keep your king safe';
  else if (m.captured) s = `taking the ${PIECE[m.captured]} with your ${PIECE[m.piece]}`;
  else if (m.promotion) s = `pushing your pawn to the end to make a ${PIECE[m.promotion]}`;
  else s = m.piece === 'p' ? 'moving a pawn' : `moving your ${PIECE[m.piece]}`;
  if (after.isCheckmate()) s += ' for checkmate';
  else if (after.isCheck()) s += ' with check';
  return s;
}

/** Friendly, never-scary wording for each move rating. */
export const VERDICT: Record<MoveClass, { title: string; tone: 'great' | 'good' | 'ok' | 'tip' }> = {
  best: { title: 'Perfect move!', tone: 'great' },
  excellent: { title: 'Great move!', tone: 'great' },
  good: { title: 'Good move', tone: 'good' },
  forced: { title: 'The only move', tone: 'good' },
  inaccuracy: { title: 'Not bad', tone: 'ok' },
  mistake: { title: 'There was a better move', tone: 'tip' },
  blunder: { title: 'Oops, a slip', tone: 'tip' },
};

/** Words for an accuracy score, kept encouraging. */
export function scoreWord(acc: number | null): string {
  if (acc === null) return '…';
  if (acc >= 90) return 'Amazing';
  if (acc >= 75) return 'Great';
  if (acc >= 60) return 'Good';
  if (acc >= 40) return 'Getting there';
  return 'Learning';
}

/** If the move let the opponent checkmate immediately, a gentle explanation; otherwise null. */
export function describeDanger(m: Move, names: Record<Color, string>): string | null {
  const after = new Chess(m.after);
  if (after.isGameOver()) return null;
  for (const reply of after.moves({ verbose: true })) {
    const c = new Chess(m.after);
    c.move(reply);
    if (c.isCheckmate()) return `This let ${names[after.turn()]} checkmate on the very next move.`;
  }
  return null;
}
