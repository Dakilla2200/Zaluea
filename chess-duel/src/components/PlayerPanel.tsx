import { memo } from 'react';
import type { Color, PieceSymbol } from '../game';
import { pieceImage, type PieceStyleId } from '../pieces';
import { IconClock, IconFlag } from './Icons';

export type PanelPrompt = 'none' | 'confirm-resign' | 'draw-offered-to-me' | 'draw-offered-by-me';

interface Props {
  color: Color;
  name: string;
  top: boolean;
  active: boolean;
  inCheck: boolean;
  gameOver: boolean;
  outcome: 'won' | 'lost' | 'draw' | null;
  captured: PieceSymbol[];
  advantage: number;
  pieceStyle: PieceStyleId;
  clockMs: number | null;
  clockRunning: boolean;
  prompt: PanelPrompt;
  canAct: boolean;
  onResign: () => void;
  onOfferDraw: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    const s = Math.floor(clamped / 1000);
    const tenths = Math.floor((clamped % 1000) / 100);
    return `0:0${s}.${tenths}`;
  }
  const total = Math.ceil(clamped / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function PlayerPanelImpl(p: Props) {
  const opp: Color = p.color === 'w' ? 'b' : 'w';
  const tab = p.outcome === 'won' ? 'Winner' : p.outcome === 'lost' ? 'Defeated' : p.outcome === 'draw' ? 'Draw' : p.gameOver ? null : p.prompt === 'draw-offered-by-me' ? 'Draw offered' : p.inCheck ? 'Check!' : p.active ? 'Your move' : null;
  const low = p.clockMs !== null && p.clockMs < 20_000;

  let middle;
  if (p.prompt === 'confirm-resign') {
    middle = (
      <div className="prompt">
        <span>Resign this game?</span>
        <div className="prompt-actions">
          <button className="pill ghost" onClick={p.onCancel}>
            Cancel
          </button>
          <button className="pill danger" onClick={p.onConfirm}>
            Resign
          </button>
        </div>
      </div>
    );
  } else if (p.prompt === 'draw-offered-to-me') {
    middle = (
      <div className="prompt">
        <span>Draw offered</span>
        <div className="prompt-actions">
          <button className="pill ghost" onClick={p.onCancel}>
            Decline
          </button>
          <button className="pill gold" onClick={p.onConfirm}>
            Accept
          </button>
        </div>
      </div>
    );
  } else {
    middle = (
      <div className="who">
        <div className="name-row">
          <span className="name">{p.name}</span>
        </div>
        <div className="captured">
          {p.captured.map((t, i) => (
            <span key={i} className={`cap cap-${t}`} style={{ backgroundImage: pieceImage(p.pieceStyle, opp, t) }} />
          ))}
          {p.advantage > 0 && <span className="adv">+{p.advantage}</span>}
          {p.captured.length === 0 && p.advantage <= 0 && <span className="none">No captures</span>}
        </div>
      </div>
    );
  }

  return (
    <section className={`panel${p.top ? ' top' : ''}${p.active && !p.gameOver ? ' active' : ''}${p.inCheck && !p.gameOver ? ' in-check' : ''}`}>
      <div className={`avatar ${p.color}`}>
        <span style={{ backgroundImage: pieceImage(p.pieceStyle, p.color, 'k') }} />
      </div>
      {tab && (
        <span key={tab} className={`turn-tab${p.inCheck && !p.gameOver ? ' check' : ''}${p.prompt === 'draw-offered-by-me' || p.outcome === 'draw' ? ' muted' : ''}${p.outcome === 'lost' ? ' lost' : ''}`}>
          <i />
          {tab}
        </span>
      )}
      {middle}
      {p.prompt === 'none' || p.prompt === 'draw-offered-by-me' ? (
        <div className="panel-actions">
          <button className="mini" disabled={!p.canAct || p.prompt === 'draw-offered-by-me'} onClick={p.onOfferDraw} aria-label="Offer draw">
            ½
          </button>
          <button className="mini" disabled={!p.canAct} onClick={p.onResign} aria-label="Resign">
            <IconFlag />
          </button>
        </div>
      ) : null}
      {p.clockMs !== null && (
        <div className={`clock${p.clockRunning ? ' running' : ''}${low ? ' low' : ''}${p.clockMs <= 0 ? ' flagged' : ''}`}>
          <IconClock />
          <span>{formatClock(p.clockMs)}</span>
        </div>
      )}
    </section>
  );
}

export const PlayerPanel = memo(PlayerPanelImpl);
