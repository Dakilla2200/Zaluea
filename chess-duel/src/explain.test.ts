import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { describeDanger, describeMove, describeSuggestion, scoreWord } from './explain';

const names = { w: 'Alex', b: 'Sam' };
const play = (...sans: string[]) => {
  const c = new Chess();
  sans.forEach((s) => c.move(s));
  return c.history({ verbose: true });
};

describe('plain-English moves', () => {
  it('describes quiet moves, captures and checks without notation', () => {
    const h = play('e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qe5+');
    expect(describeMove(h[0], names)).toBe('Alex moved a pawn forward.');
    expect(describeMove(h[2], names)).toBe("Alex's pawn took a pawn.");
    expect(describeMove(h[3], names)).toBe("Sam's queen took a pawn.");
    expect(describeMove(h[4], names)).toBe('Alex moved the knight.');
    expect(describeMove(h[5], names)).toBe('Sam moved the queen. Check: the king is under attack.');
  });

  it('describes castling, checkmate and promotion', () => {
    const castle = play('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O');
    expect(describeMove(castle[6], names)).toBe('Alex tucked the king away to safety (castling).');
    const mate = play('f3', 'e5', 'g4', 'Qh4#');
    expect(describeMove(mate[3], names)).toBe('Sam moved the queen. Checkmate, game over!');
    const promo = play('h4', 'g5', 'hxg5', 'h6', 'gxh6', 'Nf6', 'h7', 'Ng8', 'hxg8=Q');
    expect(describeMove(promo[8], names)).toBe("Alex's pawn took a knight and it turned into a queen!");
  });

  it('describes the better move as a friendly tip', () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    expect(describeSuggestion(fen, 'h5f7')).toBe('taking the pawn with your queen for checkmate');
    expect(describeSuggestion(new Chess().fen(), 'g1f3')).toBe('moving your knight');
    expect(describeSuggestion(new Chess().fen(), null)).toBeNull();
  });

  it('explains when a move allowed checkmate next move', () => {
    const h = play('e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6');
    expect(describeDanger(h[5], names)).toBe('This let Alex checkmate on the very next move.');
    expect(describeDanger(h[0], names)).toBeNull();
  });

  it('keeps score words encouraging', () => {
    expect(scoreWord(95)).toBe('Amazing');
    expect(scoreWord(20)).toBe('Learning');
    expect(scoreWord(null)).toBe('…');
  });
});
