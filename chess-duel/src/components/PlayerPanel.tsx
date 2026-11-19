import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import type { Color, PieceSymbol } from '../game';
import { pieceImage, type PieceStyleId } from '../pieces';
import { IconFlag } from './Icons';
import { Pip, type PipMood } from './Pip';

export type PanelPrompt = 'none' | 'confirm-resign' | 'draw-offered-to-me' | 'draw-offered-by-me';

interface Props {
  color: Color;
  name: string;
  /** panel is turned 180° to face a player sitting opposite */
  turned: boolean;
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
  /** Pip sits on this panel */
  pip: { mood: PipMood; pulse: number; text: string | null } | null;
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

const POP = { type: 'spring', stiffness: 520, damping: 22 } as const;

function PlayerPanelImpl(p: Props) {
  const opp: Color = p.color === 'w' ? 'b' : 'w';
  const tab =
    p.outcome === 'won'
      ? 'Winner!'
      : p.outcome === 'lost'
        ? 'Good game'
        : p.outcome === 'draw'
          ? 'Draw'
          : p.gameOver
            ? null
            : p.prompt === 'draw-offered-by-me'
              ? 'Draw offered'
              : p.inCheck
                ? 'Check!'
                : p.active
                  ? 'Your move'
                  : null;
  const tabKind = p.outcome === 'won' ? 'won' : p.outcome === 'lost' || p.outcome === 'draw' || p.prompt === 'draw-offered-by-me' ? 'muted' : p.inCheck ? 'check' : '';
  const low = p.clockMs !== null && p.clockMs < 20_000;

  return (
    <motion.section
      className={`panel${p.active && !p.gameOver ? ' active' : ''}${p.inCheck && !p.gameOver ? ' in-check' : ''}`}
      initial={false}
      animate={{ rotate: p.turned ? 180 : 0, scale: p.active && !p.gameOver ? 1 : 0.97 }}
      transition={{ rotate: { type: 'spring', stiffness: 150, damping: 18 }, scale: POP }}
    >
      <AnimatePresence mode="popLayout">
        {tab && (
          <motion.span key={tab} className={`turn-tab ${tabKind}`} initial={{ scale: 0, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0, opacity: 0 }} transition={POP}>
            {tab}
          </motion.span>
        )}
      </AnimatePresence>

      <div className="avatar-slot">
        <AnimatePresence mode="popLayout" initial={false}>
          {p.pip ? (
            <motion.div key="pip" className="pip-seat" initial={{ y: 30, scale: 0.4, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 24, scale: 0.4, opacity: 0 }} transition={POP}>
              <Pip mood={p.pip.mood} pulse={p.pip.pulse} size={42} />
            </motion.div>
          ) : (
            <motion.div key="king" className={`avatar ${p.color}`} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={POP}>
              <span style={{ backgroundImage: pieceImage(p.pieceStyle, p.color, 'k') }} />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {p.pip?.text && (
            <motion.div
              key={p.pip.pulse}
              className="bubble"
              initial={{ scale: 0.3, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 20 }}
            >
              {p.pip.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {p.prompt === 'confirm-resign' || p.prompt === 'draw-offered-to-me' ? (
          <motion.div key="prompt" className="prompt" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <span>{p.prompt === 'confirm-resign' ? 'Resign?' : 'Accept draw?'}</span>
            <div className="prompt-actions">
              <button className="btn3d grey sm" onClick={p.onCancel}>
                {p.prompt === 'confirm-resign' ? 'No' : 'Decline'}
              </button>
              <button className={`btn3d sm ${p.prompt === 'confirm-resign' ? 'danger' : 'leaf'}`} onClick={p.onConfirm}>
                {p.prompt === 'confirm-resign' ? 'Resign' : 'Accept'}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="who" className="who" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
            <span className="name">{p.name}</span>
            <div className="captured">
              <AnimatePresence initial={false}>
                {p.captured.map((t, i) => (
                  <motion.span
                    key={`${t}${i}`}
                    className={`cap cap-${t}`}
                    style={{ backgroundImage: pieceImage(p.pieceStyle, opp, t) }}
                    initial={{ scale: 0, y: -14, rotate: -40 }}
                    animate={{ scale: 1, y: 0, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.35 }}
                  />
                ))}
              </AnimatePresence>
              {p.advantage > 0 && (
                <motion.span key={p.advantage} className="adv" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={POP}>
                  +{p.advantage}
                </motion.span>
              )}
              {p.captured.length === 0 && p.advantage <= 0 && <span className="none">No captures yet</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(p.prompt === 'none' || p.prompt === 'draw-offered-by-me') && (
        <div className="panel-actions">
          <button className="btn3d grey icon" disabled={!p.canAct || p.prompt === 'draw-offered-by-me'} onClick={p.onOfferDraw} aria-label="Offer draw">
            ½
          </button>
          <button className="btn3d grey icon" disabled={!p.canAct} onClick={p.onResign} aria-label="Resign">
            <IconFlag />
          </button>
        </div>
      )}

      {p.clockMs !== null && (
        <motion.div
          className={`clock${p.clockRunning ? ' running' : ''}${low ? ' low' : ''}${p.clockMs <= 0 ? ' flagged' : ''}`}
          animate={p.clockRunning && low ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={p.clockRunning && low ? { duration: 1, repeat: Infinity } : POP}
        >
          {formatClock(p.clockMs)}
        </motion.div>
      )}
    </motion.section>
  );
}

export const PlayerPanel = memo(PlayerPanelImpl);
