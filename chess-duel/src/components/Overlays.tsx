import type { ReactNode } from 'react';
import { resultTitle, type Color, type GameResult, type PieceSymbol } from '../game';
import { pieceImage, type PieceStyleId } from '../pieces';
import { IconClose, IconCrown } from './Icons';

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal aria-label={title}>
        <div className="grabber" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog(p: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="scrim center" onPointerDown={(e) => e.target === e.currentTarget && p.onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal>
        <h3>{p.title}</h3>
        <p>{p.message}</p>
        <div className="dialog-actions">
          <button className="btn secondary" onClick={p.onCancel}>
            Cancel
          </button>
          <button className={`btn ${p.danger ? 'danger' : 'primary'}`} onClick={p.onConfirm}>
            {p.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromotionPicker(p: { color: Color; pieceStyle: PieceStyleId; rotate: boolean; onPick: (t: PieceSymbol) => void; onCancel: () => void }) {
  const choices: PieceSymbol[] = ['q', 'r', 'b', 'n'];
  const names: Record<string, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
  return (
    <div
      className="promo-scrim"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) p.onCancel();
      }}
    >
      <div className={`promo${p.rotate ? ' flip' : ''}`}>
        <div className="promo-title">Promote pawn</div>
        <div className="promo-row">
          {choices.map((t) => (
            <button key={t} className="promo-btn" onClick={() => p.onPick(t)} aria-label={names[t]}>
              <span style={{ backgroundImage: pieceImage(p.pieceStyle, p.color, t) }} />
              <small>{names[t]}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultHalf(p: { me: Color; result: GameResult; names: Record<Color, string>; pieceStyle: PieceStyleId; flip: boolean; actions: ReactNode }) {
  const draw = !p.result.winner;
  const won = p.result.winner === p.me;
  const headline = draw ? 'Draw' : won ? 'Victory' : 'Defeat';
  const sub = draw ? resultTitle(p.result) : `${p.names[p.result.winner!]} wins · ${resultTitle(p.result)}`;
  return (
    <div className={`result-half ${draw ? 'draw' : won ? 'won' : 'lost'}${p.flip ? ' flip' : ''}`}>
      <div className="result-emblem">
        {won && (
          <span className="crown">
            <IconCrown />
          </span>
        )}
        <span className="emblem-piece" style={{ backgroundImage: pieceImage(p.pieceStyle, p.me, 'k') }} />
      </div>
      <h1 className="result-headline">{headline}</h1>
      <p className="result-sub">{sub}</p>
      <div className="result-actions">{p.actions}</div>
    </div>
  );
}

export function GameOverOverlay(p: {
  result: GameResult;
  names: Record<Color, string>;
  pieceStyle: PieceStyleId;
  rotateTop: boolean;
  onRematch: () => void;
  onReview: () => void;
  onNewMatch: () => void;
}) {
  const actions = (
    <>
      <button className="btn secondary" onClick={p.onReview}>
        View board
      </button>
      <button className="btn primary" onClick={p.onRematch}>
        Rematch
      </button>
    </>
  );
  return (
    <div className="gameover">
      {p.result.winner && <div className="confetti" aria-hidden>{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>}
      <ResultHalf me="b" result={p.result} names={p.names} pieceStyle={p.pieceStyle} flip={p.rotateTop} actions={actions} />
      <div className="result-divider">
        <span>{p.result.winner ? (p.result.winner === 'w' ? '1 – 0' : '0 – 1') : '½ – ½'}</span>
      </div>
      <ResultHalf
        me="w"
        result={p.result}
        names={p.names}
        pieceStyle={p.pieceStyle}
        flip={false}
        actions={
          <>
            {actions}
            <button className="btn link" onClick={p.onNewMatch}>
              New match
            </button>
          </>
        }
      />
    </div>
  );
}

