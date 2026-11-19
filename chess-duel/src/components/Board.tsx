import { memo, type CSSProperties, type ReactNode } from 'react';
import { FILES, coordsToSquare, squareToCoords, type Square, type TrackedPiece } from '../game';
import { pieceImage, type PieceStyleId } from '../pieces';
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
  showCoords: boolean;
  rotateTop: boolean;
  onSquare: (sq: Square) => void;
  /** Inner board size in px (multiple of 8). */
  size: number;
  children?: ReactNode;
}

function BoardImpl(p: BoardProps) {
  const size = p.size;

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const file = Math.floor(((e.clientX - r.left) / r.width) * 8);
    const row = Math.floor(((e.clientY - r.top) / r.height) * 8);
    if (file < 0 || file > 7 || row < 0 || row > 7) return;
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
      squares.push(
        <div key={sq} className={cls.join(' ')}>
          {target !== undefined && <span className={target ? 'hint capture' : 'hint'} />}
          {p.showCoords && file === 0 && <span className={`coord rank ${light ? 'on-light' : 'on-dark'}`}>{8 - row}</span>}
          {p.showCoords && row === 7 && <span className={`coord file ${light ? 'on-light' : 'on-dark'}`}>{FILES[file]}</span>}
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
    '--frame': p.theme.frame,
    width: size + 12,
    height: size + 12,
  } as CSSProperties;

  return (
    <div className="board-wrap">
      {size > 0 && (
        <div className="board-frame" style={style}>
          <div className="board" onPointerDown={handlePointer} style={{ width: size, height: size }}>
            <div className="squares">{squares}</div>
            <div className="texture" />
            <div className="pieces">
              {p.pieces.map((pc) => {
                const { file, rank } = squareToCoords(pc.square);
                const flip = p.rotateTop && pc.color === 'b';
                return (
                  <div
                    key={pc.id}
                    className={`piece${pc.ghost ? ' ghost' : ''}${pc.id === p.lastMoverId ? ' moved' : ''}${p.selected === pc.square && !pc.ghost ? ' lifted' : ''}`}
                    style={{ transform: `translate(${file * 100}%, ${(7 - rank) * 100}%)` }}
                  >
                    <div className={`piece-img${flip ? ' flip' : ''}`} style={{ backgroundImage: pieceImage(p.pieceStyle, pc.color, pc.type) }} />
                  </div>
                );
              })}
            </div>
            {p.children}
          </div>
        </div>
      )}
    </div>
  );
}

export const Board = memo(BoardImpl);
