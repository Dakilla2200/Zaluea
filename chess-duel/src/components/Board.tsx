import { AnimatePresence, motion, type MotionStyle } from "framer-motion";
import { memo, useEffect, useRef, type ReactNode } from "react";
import { FILES, coordsToSquare, squareToCoords, type Color, type Square, type TrackedPiece } from '../game';
import { pieceImage, type PieceStyleId } from '../pieces';
import type { Orientation } from '../settings';
import type { BoardTheme } from '../themes';

export interface BoardProps {
  pieces: TrackedPiece[];
  theme: BoardTheme;
  pieceStyle: PieceStyleId;
  selected: Square | null;
  /** legal destinations of the selected piece; value = is capture */
  targets: Map<Square, boolean>;
  lastMove: { from: Square; to: Square } | null;
  lastMoverId: string | null;
  checkSquare: Square | null;
  /** changes whenever a new check happens (retriggers the warning flash) */
  checkKey: number;
  /** capture square + unique key for the spark burst */
  burst: { square: Square; key: number } | null;
  showCoords: boolean;
  orientation: Orientation;
  turn: Color;
  onSquare: (sq: Square) => void;
  size: number;
  children?: ReactNode;
}

const SLIDE = { type: 'spring', stiffness: 320, damping: 36, mass: 0.9 } as const;
const CALM = { type: 'spring', stiffness: 300, damping: 32 } as const;

/** Soft fading ring where a piece was captured. */
function Burst({ square }: { square: Square }) {
  const { file, rank } = squareToCoords(square);
  return (
    <div className="burst" style={{ left: `${file * 12.5 + 6.25}%`, top: `${(7 - rank) * 12.5 + 6.25}%` }}>
      <motion.b initial={{ scale: 0.5, opacity: 0.6 }} animate={{ scale: 1.15, opacity: 0 }} transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }} />
    </div>
  );
}

function BoardImpl(p: BoardProps) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  const boardTurned = p.orientation === 'pass' && p.turn === 'b';
  const glyphTurned = (c: Color) => (p.orientation === 'fixed' ? c === 'b' : p.turn === 'b');

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    let file = Math.floor(((e.clientX - r.left) / r.width) * 8);
    let row = Math.floor(((e.clientY - r.top) / r.height) * 8);
    if (file < 0 || file > 7 || row < 0 || row > 7) return;
    if (boardTurned) {
      file = 7 - file;
      row = 7 - row;
    }
    p.onSquare(coordsToSquare(file, 7 - row));
  };

  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let file = 0; file < 8; file++) {
      const sq = coordsToSquare(file, 7 - row);
      const light = (file + row) % 2 === 0;
      const cls = ['sq', light ? 'light' : 'dark'];
      if (p.lastMove && (p.lastMove.from === sq || p.lastMove.to === sq)) cls.push('last');
      if (p.selected === sq) cls.push('selected');
      if (p.checkSquare === sq) cls.push('check');
      const target = p.targets.get(sq);
      const coordTurn = p.orientation === 'pass' ? boardTurned : p.orientation === 'follow' && p.turn === 'b';
      squares.push(
        <div key={sq} className={cls.join(' ')}>
          <span className="sq-hl" />
          {target !== undefined && (
            <motion.span
              className={target ? 'hint capture' : 'hint'}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            />
          )}
          {p.showCoords && file === 0 && <span className={`coord rank ${light ? 'on-light' : 'on-dark'}${coordTurn ? ' turned' : ''}`}>{8 - row}</span>}
          {p.showCoords && row === 7 && <span className={`coord file ${light ? 'on-light' : 'on-dark'}${coordTurn ? ' turned' : ''}`}>{FILES[file]}</span>}
        </div>,
      );
    }
  }

  const style = {
    '--light': p.theme.light,
    '--dark': p.theme.dark,
    '--coord-light': p.theme.coordLight,
    '--coord-dark': p.theme.coordDark,
    '--texture': p.theme.texture,
    '--rim': p.theme.rim,
    '--rim-edge': p.theme.rimEdge,
    width: p.size + 16,
    height: p.size + 16,
  } as unknown as MotionStyle;

  return (
    <div className="board-shake">
      <motion.div
        className="board-frame"
        style={style}
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotate: boardTurned ? 180 : 0 }}
        transition={{ scale: CALM, opacity: { duration: 0.3 }, rotate: { type: 'spring', stiffness: 90, damping: 22, delay: 0.35 } }}
      >
        <div className="board" onPointerDown={handlePointer} style={{ width: p.size, height: p.size }}>
          <div className="squares">{squares}</div>
          <div className="texture" />
          <div className="pieces">
            <AnimatePresence>
              {p.pieces.map((pc) => {
                const { file, rank } = squareToCoords(pc.square);
                const x = `${file * 100}%`;
                const y = `${(7 - rank) * 100}%`;
                const lifted = p.selected === pc.square;
                return (
                  <motion.div
                    key={pc.id}
                    className="piece"
                    style={{ zIndex: pc.id === p.lastMoverId ? 3 : 2 }}
                    initial={mounted.current ? { x, y, scale: 0.9, opacity: 0 } : false}
                    animate={{ x, y, scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.25, delay: 0.15 } }}
                    transition={{ x: SLIDE, y: SLIDE, scale: CALM, opacity: { duration: 0.2 } }}
                  >
                    <motion.div
                      className="piece-lift"
                      animate={lifted ? { y: boardTurned ? '4%' : '-4%', scale: 1.05 } : { y: '0%', scale: 1 }}
                      transition={CALM}
                    >
                      <motion.div
                        className="piece-rot"
                        initial={false}
                        animate={{ rotate: glyphTurned(pc.color) ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 120, damping: 22, delay: p.orientation === 'follow' ? 0.3 : 0 }}
                      >
                        <div
                          key={pc.type}
                          className="piece-img"
                          style={{ backgroundImage: pieceImage(p.pieceStyle, pc.color, pc.type) }}
                        />
                      </motion.div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          {p.burst && <Burst key={p.burst.key} square={p.burst.square} />}
          {p.checkKey > 0 && p.checkSquare && <span key={p.checkKey} className="check-flash" />}
          {p.children}
        </div>
      </motion.div>
    </div>
  );
}

export const Board = memo(BoardImpl);
