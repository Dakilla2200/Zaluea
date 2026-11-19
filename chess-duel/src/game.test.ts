import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { boardResult, capturedBy, materialBalance, replay, timeoutResult, trackPieces, type MoveInput } from './game';

const san = (...list: string[]): MoveInput[] => {
  const c = new Chess();
  return list.map((s) => {
    const m = c.move(s);
    return { from: m.from, to: m.to, promotion: m.promotion };
  });
};

const at = (moves: MoveInput[], sq: string) => trackPieces(replay(moves).verbose).filter((p) => !p.ghost && p.square === sq);

describe('rules', () => {
  it("detects fool's mate as checkmate for black", () => {
    const { chess } = replay(san('f3', 'e5', 'g4', 'Qh4#'));
    expect(boardResult(chess)).toEqual({ kind: 'checkmate', winner: 'b' });
  });

  it('detects stalemate', () => {
    // Sam Loyd's 10-move stalemate
    const { chess } = replay(
      san('e3', 'a5', 'Qh5', 'Ra6', 'Qxa5', 'h5', 'h4', 'Rah6', 'Qxc7', 'f6', 'Qxd7+', 'Kf7', 'Qxb7', 'Qd3', 'Qxb8', 'Qh7', 'Qxc8', 'Kg6', 'Qe6'),
    );
    expect(boardResult(chess)).toEqual({ kind: 'stalemate' });
  });

  it('detects threefold repetition', () => {
    const { chess } = replay(san('Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'));
    expect(boardResult(chess)).toEqual({ kind: 'threefold' });
  });

  it('detects insufficient material', () => {
    const c = new Chess('8/8/8/4k3/8/8/3K4/8 w - - 0 1');
    expect(boardResult(c)).toEqual({ kind: 'insufficient' });
  });

  it('detects the 50-move rule', () => {
    const c = new Chess('8/8/8/4k3/8/8/3K4/R7 w - - 99 80');
    c.move('Ra2');
    expect(boardResult(c)).toEqual({ kind: 'fifty' });
  });

  it('timeout vs lone king is a draw, otherwise a win', () => {
    const c = new Chess('8/8/8/4k3/8/8/3K4/R7 w - - 0 1');
    expect(timeoutResult(c, 'w')).toEqual({ kind: 'timeout-insufficient' });
    expect(timeoutResult(c, 'b')).toEqual({ kind: 'timeout', winner: 'w' });
  });
});

describe('piece tracking', () => {
  it('moves the rook when castling kingside', () => {
    const moves = san('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O');
    expect(at(moves, 'g1')[0]).toMatchObject({ id: 'we1', type: 'k' });
    expect(at(moves, 'f1')[0]).toMatchObject({ id: 'wh1', type: 'r' });
  });

  it('moves the rook when castling queenside', () => {
    const moves = san('d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7', 'O-O-O', 'O-O-O');
    expect(at(moves, 'c1')[0]).toMatchObject({ id: 'we1' });
    expect(at(moves, 'd1')[0]).toMatchObject({ id: 'wa1' });
    expect(at(moves, 'c8')[0]).toMatchObject({ id: 'be8' });
    expect(at(moves, 'd8')[0]).toMatchObject({ id: 'ba8' });
  });

  it('removes the en-passant captured pawn and ghosts it', () => {
    const moves = san('e4', 'a6', 'e5', 'd5', 'exd6');
    const pieces = trackPieces(replay(moves).verbose);
    expect(pieces.find((p) => p.square === 'd5' && !p.ghost)).toBeUndefined();
    expect(pieces.find((p) => p.ghost)).toMatchObject({ id: 'bd7', square: 'd5' });
    expect(at(moves, 'd6')[0]).toMatchObject({ id: 'we2' });
  });

  it('handles promotion with a choice of piece', () => {
    const moves = san('h4', 'g5', 'hxg5', 'h6', 'gxh6', 'Nf6', 'h7', 'Ng8', 'hxg8=N');
    expect(at(moves, 'g8')[0]).toMatchObject({ id: 'wh2', type: 'n', color: 'w' });
    const { chess, verbose } = replay(moves);
    expect(capturedBy(verbose).w).toEqual(['n', 'p', 'p']);
    expect(materialBalance(chess)).toBe(7); // captured N+P+P (5) and the h-pawn became a knight (+2)
  });

  it('keeps exactly 32 pieces at start and stable ids after undo', () => {
    expect(trackPieces([])).toHaveLength(32);
    const a = trackPieces(replay(san('e4', 'd5', 'exd5')).verbose);
    expect(a.filter((p) => !p.ghost)).toHaveLength(31);
    const b = trackPieces(replay(san('e4', 'd5')).verbose);
    expect(b).toHaveLength(32);
    expect(b.find((p) => p.square === 'd5')?.id).toBe('bd7');
  });

  it('stops replay at an illegal stored move instead of crashing', () => {
    const { verbose } = replay([...san('e4'), { from: 'e4', to: 'e8' }]);
    expect(verbose).toHaveLength(1);
  });
});
