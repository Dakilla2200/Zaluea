import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { resultTitle, type Color, type GameResult, type PieceSymbol } from '../game';
import { pipLine } from '../mascot';
import { pieceImage, type PieceStyleId } from '../pieces';
import { IconClose } from './Icons';
import { Pip } from './Pip';

const SPRING = { type: 'spring', stiffness: 380, damping: 32 } as const;

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="sheet" role="dialog" aria-modal aria-label={title} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={SPRING}>
        <div className="grabber" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <motion.button className="icon-btn" onClick={onClose} aria-label="Close" whileTap={{ scale: 0.85, rotate: 90 }}>
            <IconClose />
          </motion.button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}

export function ConfirmDialog(p: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div className="scrim center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && p.onCancel()}>
      <motion.div className="dialog" role="alertdialog" aria-modal initial={{ scale: 0.6, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: 'spring', stiffness: 460, damping: 22 }}>
        <div className="dialog-pip">
          <Pip mood="worried" pulse={1} size={58} />
        </div>
        <h3>{p.title}</h3>
        <p>{p.message}</p>
        <div className="dialog-actions">
          <button className="btn3d grey" onClick={p.onCancel}>
            Keep playing
          </button>
          <button className={`btn3d ${p.danger ? 'danger' : ''}`} onClick={p.onConfirm}>
            {p.confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function PromotionPicker(p: { color: Color; pieceStyle: PieceStyleId; rotate: boolean; onPick: (t: PieceSymbol) => void; onCancel: () => void }) {
  const choices: PieceSymbol[] = ['q', 'r', 'b', 'n'];
  const names: Record<string, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
  return (
    <motion.div
      className="promo-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) p.onCancel();
      }}
    >
      <motion.div className="promo" style={{ rotate: p.rotate ? 180 : 0 }} initial={{ scale: 0.5, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
        <div className="promo-title">Promote your pawn!</div>
        <div className="promo-row">
          {choices.map((t, i) => (
            <motion.button
              key={t}
              className="promo-btn"
              onClick={() => p.onPick(t)}
              aria-label={names[t]}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.05 + i * 0.05 }}
              whileTap={{ scale: 0.88 }}
            >
              <span style={{ backgroundImage: pieceImage(p.pieceStyle, p.color, t) }} />
              <small>{names[t]}</small>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Canvas confetti: two cannons firing from the sides, then gentle flutter. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    g.scale(dpr, dpr);
    const COLORS = ['#FFFFFF', '#14B8C4', '#FFC93C', '#4CC264', '#FF4D5E', '#6C5CA8', '#FF8A1F'];
    type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string; d: number; round: boolean };
    const parts: P[] = [];
    const fire = (count: number, delay: number) => {
      for (let i = 0; i < count; i++) {
        const left = i % 2 === 0;
        parts.push({
          x: left ? -10 : W + 10,
          y: H * (0.5 + Math.random() * 0.35),
          vx: (left ? 1 : -1) * (4 + Math.random() * 10),
          vy: -(9 + Math.random() * 12),
          w: 6 + Math.random() * 7,
          h: 9 + Math.random() * 9,
          r: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.35,
          c: COLORS[i % COLORS.length],
          d: delay + Math.random() * 14,
          round: i % 5 === 0,
        });
      }
    };
    fire(170, 0);
    fire(90, 55);
    let frame = 0;
    let raf = 0;
    const tick = () => {
      g.clearRect(0, 0, W, H);
      frame++;
      let alive = 0;
      for (const p of parts) {
        if (frame < p.d) {
          alive++;
          continue;
        }
        p.vy += 0.3;
        p.vx *= 0.985;
        p.vy = Math.min(p.vy, 5.5);
        p.x += p.vx + Math.sin((frame + p.d) * 0.08) * 0.6;
        p.y += p.vy;
        p.r += p.vr;
        if (p.y < H + 30) alive++;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.c;
        if (p.round) {
          g.beginPath();
          g.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          g.fill();
        } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(frame * 0.18 + p.r)) + 1);
        g.restore();
      }
      if (alive > 0 && frame < 600) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden />;
}

function CountUp({ to, delay }: { to: number; delay: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay * 1000;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 800));
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return <>{v}</>;
}

function ResultHalf(p: { me: Color; result: GameResult; names: Record<Color, string>; turned: boolean; stats: { moves: number; captures: Record<Color, number> }; children: ReactNode }) {
  const draw = !p.result.winner;
  const won = p.result.winner === p.me;
  const [line] = useState(() => (draw ? pipLine.drawLine() : won ? pipLine.winLine() : pipLine.loserLine()));
  const headline = draw ? "It's a draw!" : won ? 'Victory!' : 'Defeat';
  const sub = draw ? resultTitle(p.result) : `${p.names[p.result.winner!]} wins by ${resultTitle(p.result).toLowerCase()}`;
  return (
    <motion.div
      className={`result-half ${draw ? 'draw' : won ? 'won' : 'lost'}`}
      style={{ rotate: p.turned ? 180 : 0 }}
      initial={{ opacity: 0, y: p.turned ? -40 : 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.25 }}
    >
      <div className="result-pip">
        <Pip mood={draw ? 'happy' : won ? 'cheer' : 'sad'} pulse={won ? 3 : 1} size={won ? 86 : 64} />
        <motion.div className="bubble static" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.7 }}>
          {line}
        </motion.div>
      </div>
      <motion.h1 className="result-headline" initial={{ scale: 0.2, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.4 }}>
        {headline}
      </motion.h1>
      <p className="result-sub">{sub}</p>
      <motion.div className="stats" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
        <div className="stat">
          <small>Moves</small>
          <strong>
            <CountUp to={p.stats.moves} delay={0.7} />
          </strong>
        </div>
        <div className="stat">
          <small>Your captures</small>
          <strong>
            <CountUp to={p.stats.captures[p.me]} delay={0.8} />
          </strong>
        </div>
      </motion.div>
      <motion.div className="result-actions" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }}>
        {p.children}
      </motion.div>
    </motion.div>
  );
}

export function GameOverOverlay(p: {
  result: GameResult;
  names: Record<Color, string>;
  turnTop: boolean;
  stats: { moves: number; captures: Record<Color, number> };
  onRematch: () => void;
  onReview: () => void;
  onNewMatch: () => void;
}) {
  const actions = (
    <>
      <button className="btn3d white-ghost" onClick={p.onReview}>
        View board
      </button>
      <button className="btn3d white" onClick={p.onRematch}>
        Rematch
      </button>
    </>
  );
  return (
    <motion.div
      className={`gameover ${p.result.winner ? 'win' : 'draw'}`}
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: [0.2, 0.9, 0.3, 1] }}
    >
      <Confetti />
      <ResultHalf me="b" result={p.result} names={p.names} turned={p.turnTop} stats={p.stats}>
        {actions}
      </ResultHalf>
      <div className="result-divider">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.5 }}>
          {p.result.winner ? (p.result.winner === 'w' ? '1 – 0' : '0 – 1') : '½ – ½'}
        </motion.span>
      </div>
      <ResultHalf me="w" result={p.result} names={p.names} turned={false} stats={p.stats}>
        {actions}
        <button className="btn3d link" onClick={p.onNewMatch}>
          New match
        </button>
      </ResultHalf>
    </motion.div>
  );
}
