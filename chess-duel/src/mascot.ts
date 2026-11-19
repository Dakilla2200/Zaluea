import type { Chess } from 'chess.js';
import { PIECE_VALUE, type Color, type GameResult, type Move } from './game';
import type { PipMood } from './components/Pip';

export interface PipState {
  /** which player Pip is sitting with / talking to */
  side: Color;
  mood: PipMood;
  /** speech bubble text; null hides the bubble */
  text: string | null;
  /** bumps on every reaction to retrigger animations */
  pulse: number;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const L = {
  capture: ['Gotcha!', 'Snack time!', 'Off the board you go!', 'Clean capture!', 'Yoink!'],
  bigCapture: ['Whoa, what a steal!', "Didn't see that coming!", 'Huge capture!', 'That one hurt!'],
  queenCapture: ['THE QUEEN?! Wow!', 'Bye bye, queen!'],
  castle: ['Castled! King is safe and cozy.', 'Tucked the king away. Smart!'],
  check: ['Check! Watch your king!', 'Uh oh, your king is in check!', 'Yikes! Protect the king!'],
  givesCheck: ['Check! Keep the pressure on!', 'Ooh, check!'],
  promote: ['A new queen is born!', 'Promotion party!', 'From pawn to royalty!'],
  underpromote: ['A {p}?! Bold choice!', 'Underpromotion! Fancy.'],
  enPassant: ['En passant?! Very fancy!', 'The secret pawn move! Nice.'],
  nice: ['Nice move!', 'Ooh, smooth.', 'Love that square.', 'Solid!', 'Good one!', 'Sneaky...'],
  yourTurn: ['Your move!', "You've got this!", 'Take your time.', 'What will you play?'],
  undo: ['Rewind! Try another idea.', 'Take-back time.'],
  start: ['Let the duel begin!', 'Good luck, both of you!', "I'm Pip! I'll cheer you on."],
  lowTime: ['Hurry, the clock!', 'Tick tock! Quick!'],
  win: ['CHECKMATE! You did it!', 'Champion moves!', 'Victory dance time!'],
  lose: ['Good game! Rematch?', "So close! You'll get them next time."],
  draw: ['A draw! Well played, both of you.', 'Evenly matched!'],
  drawOffer: ['Draw offered. Your call!'],
  timeoutWin: ["Out of time! The win is yours."],
};

const NAMES: Record<string, string> = { n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };

/** Decides how Pip reacts to the move just played. `after` is the position after the move. */
export function reactToMove(m: Move, after: Chess, prev: PipState): PipState {
  const mover = m.color;
  const opp: Color = mover === 'w' ? 'b' : 'w';
  const pulse = prev.pulse + 1;
  if (after.isCheckmate()) return { side: mover, mood: 'cheer', text: pick(L.win), pulse };
  if (after.isCheck()) return { side: opp, mood: 'worried', text: pick(L.check), pulse };
  if (m.promotion) {
    if (m.promotion !== 'q') return { side: mover, mood: 'surprised', text: pick(L.underpromote).replace('{p}', NAMES[m.promotion]), pulse };
    return { side: mover, mood: 'cheer', text: pick(L.promote), pulse };
  }
  if (m.isEnPassant()) return { side: mover, mood: 'surprised', text: pick(L.enPassant), pulse };
  if (m.captured === 'q') return { side: mover, mood: 'surprised', text: pick(L.queenCapture), pulse };
  if (m.captured && PIECE_VALUE[m.captured] > PIECE_VALUE[m.piece] && m.piece !== 'k') return { side: mover, mood: 'surprised', text: pick(L.bigCapture), pulse };
  if (m.captured) return { side: mover, mood: 'happy', text: pick(L.capture), pulse };
  if (m.isKingsideCastle() || m.isQueensideCastle()) return { side: mover, mood: 'happy', text: pick(L.castle), pulse };
  // quiet move: Pip hops over to the player whose turn it is; sometimes he comments
  const talk = Math.random() < 0.18;
  return { side: opp, mood: 'idle', text: talk ? pick(L.yourTurn) : null, pulse };
}

export const pipLine = {
  start: (side: Color, pulse: number): PipState => ({ side, mood: 'happy', text: pick(L.start), pulse }),
  undo: (side: Color, pulse: number): PipState => ({ side, mood: 'idle', text: pick(L.undo), pulse }),
  lowTime: (side: Color, pulse: number): PipState => ({ side, mood: 'worried', text: pick(L.lowTime), pulse }),
  drawOffer: (side: Color, pulse: number): PipState => ({ side, mood: 'surprised', text: pick(L.drawOffer), pulse }),
  result: (r: GameResult, pulse: number): PipState =>
    r.winner ? { side: r.winner, mood: 'cheer', text: pick(r.kind === 'timeout' ? L.timeoutWin : L.win), pulse } : { side: 'w', mood: 'happy', text: pick(L.draw), pulse },
  loserLine: () => pick(L.lose),
  winLine: () => pick(L.win),
  drawLine: () => pick(L.draw),
};
