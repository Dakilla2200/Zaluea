import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { buildPgn, type Color, type GameResult, type Move } from '../game';
import { PIECE_STYLES, pieceImage } from '../pieces';
import { tcLabel, type Orientation, type Settings, type TimeControl } from '../settings';
import { BOARD_THEMES } from '../themes';
import { IconCopy, IconShare } from './Icons';
import { Sheet } from './Overlays';

const KNOB = { type: 'spring', stiffness: 600, damping: 26 } as const;

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="row toggle-row" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <span className="row-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <span className={`switch${value ? ' on' : ''}`}>
        <motion.i layout transition={KNOB} />
      </span>
    </button>
  );
}

function Slider({ id, label, value, disabled, onChange }: { id: string; label: string; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div className={`row slider-row${disabled ? ' disabled' : ''}`}>
      <label htmlFor={id} className="row-text">
        <span>{label}</span>
      </label>
      <input id={id} type="range" min={0} max={100} value={Math.round(value * 100)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) / 100)} style={{ '--v': `${value * 100}%` } as React.CSSProperties} />
    </div>
  );
}

function SelRing() {
  return <motion.span className="sel-ring" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }} />;
}

/** Segmented control with a pill that springs to the selected option. */
function Segmented<T extends string | number>({ options, value, disabled, onChange }: { options: Array<{ id: T; label: string }>; value: T | null; disabled?: boolean; onChange: (v: T) => void }) {
  const idx = options.findIndex((o) => o.id === value);
  return (
    <div className={`segmented${disabled ? ' disabled' : ''}`}>
      {idx >= 0 && !disabled && (
        <motion.span className="seg-pill" style={{ width: `calc((100% - 8px) / ${options.length})` }} initial={false} animate={{ x: `${idx * 100}%` }} transition={{ type: 'spring', stiffness: 500, damping: 34 }} />
      )}
      {options.map((o) => (
        <button key={o.id} disabled={disabled} className={o.id === value ? 'sel' : ''} onClick={() => onChange(o.id)}>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

const ORIENTATIONS: Array<{ id: Orientation; label: string; hint: string }> = [
  { id: 'follow', label: 'Follow turn', hint: 'Pieces flip to face whoever is moving. For players sitting opposite.' },
  { id: 'fixed', label: 'Face owners', hint: "Each side's pieces always face their owner." },
  { id: 'pass', label: 'Pass & play', hint: 'The whole board spins to the player to move. For passing the phone.' },
];

export function SettingsSheet({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const orientationHint = ORIENTATIONS.find((o) => o.id === settings.orientation)!.hint;
  return (
    <Sheet title="Settings" onClose={onClose}>
      <h4 className="section">Board</h4>
      <div className="swatches">
        {BOARD_THEMES.map((t) => (
          <motion.button key={t.id} className={`swatch${settings.theme === t.id ? ' sel' : ''}`} onClick={() => set('theme', t.id)} whileTap={{ scale: 0.9 }}>
            {settings.theme === t.id && <SelRing />}
            <span className="swatch-board" style={{ background: t.rim, boxShadow: `0 3px 0 ${t.rimEdge}` }}>
              <span style={{ background: `conic-gradient(${t.dark} 0 25%, ${t.light} 0 50%, ${t.dark} 0 75%, ${t.light} 0)` }} />
            </span>
            <small>{t.name}</small>
          </motion.button>
        ))}
      </div>

      <h4 className="section">Pieces</h4>
      <div className="piece-styles">
        {PIECE_STYLES.map((s) => (
          <motion.button key={s.id} className={`piece-style${settings.pieces === s.id ? ' sel' : ''}`} onClick={() => set('pieces', s.id)} whileTap={{ scale: 0.9 }}>
            {settings.pieces === s.id && <SelRing />}
            <span className="ps-preview">
              <i style={{ backgroundImage: pieceImage(s.id, 'w', 'n') }} />
              <i style={{ backgroundImage: pieceImage(s.id, 'b', 'q') }} />
            </span>
            <small>{s.name}</small>
          </motion.button>
        ))}
      </div>

      <h4 className="section">Piece direction</h4>
      <Segmented options={ORIENTATIONS} value={settings.orientation} onChange={(v) => set('orientation', v)} />
      <motion.p key={settings.orientation} className="note" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
        {orientationHint}
      </motion.p>

      <h4 className="section">Players</h4>
      <div className="names">
        {(['w', 'b'] as Color[]).map((c) => (
          <label key={c} className="name-field">
            <span className={`dot-color ${c}`} />
            <input
              id={`name-${c}`}
              value={settings.names[c]}
              maxLength={16}
              placeholder={c === 'w' ? 'White' : 'Black'}
              onChange={(e) => set('names', { ...settings.names, [c]: e.target.value })}
              onBlur={(e) => !e.target.value.trim() && set('names', { ...settings.names, [c]: c === 'w' ? 'White' : 'Black' })}
            />
          </label>
        ))}
      </div>

      <h4 className="section">Sound</h4>
      <div className="rows">
        <Toggle label="Sound effects" hint="Stereo: pans with the piece's file" value={settings.sound} onChange={(v) => set('sound', v)} />
        <Slider id="fx-vol" label="Effects volume" value={settings.fxVolume} disabled={!settings.sound} onChange={(v) => set('fxVolume', v)} />
        <Toggle label="Background music" value={settings.music} onChange={(v) => set('music', v)} />
        <Slider id="music-vol" label="Music volume" value={settings.musicVolume} disabled={!settings.music} onChange={(v) => set('musicVolume', v)} />
      </div>

      <h4 className="section">Game</h4>
      <div className="rows">
        <Toggle label="Pip the pawn" hint="Your cheerful mascot" value={settings.mascot} onChange={(v) => set('mascot', v)} />
        <Toggle label="Vibration" hint="On supported devices" value={settings.haptics} onChange={(v) => set('haptics', v)} />
        <Toggle label="Show legal moves" value={settings.showLegal} onChange={(v) => set('showLegal', v)} />
        <Toggle label="Board coordinates" value={settings.showCoords} onChange={(v) => set('showCoords', v)} />
      </div>
      <p className="credits">Piece artwork based on “cburnett” by Colin M.L. Burnett (CC BY-SA 3.0).</p>
    </Sheet>
  );
}

export function HistorySheet({ verbose, result, names, onClose, onReview }: { verbose: Move[]; result: GameResult | null; names: Record<Color, string>; onClose: () => void; onReview: () => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState('');
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 250);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const rows = [];
  for (let i = 0; i < verbose.length; i += 2) rows.push([verbose[i], verbose[i + 1]] as const);
  const pgn = buildPgn(verbose, result, names);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pgn);
      setToast('PGN copied!');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = pgn;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      setToast(ok ? 'PGN copied!' : 'Copying is not available here');
    }
  };
  const canShare = typeof navigator.share === 'function';
  const share = async () => {
    try {
      await navigator.share({ title: 'Chess Duel game', text: pgn });
    } catch {
      /* cancelled or not allowed */
    }
  };

  return (
    <Sheet
      title="Move history"
      onClose={onClose}
      footer={
        <div className="foot-actions">
          <button className="btn3d" disabled={!verbose.length} onClick={onReview}>
            ★ Review
          </button>
          <button className="btn3d teal" disabled={!verbose.length} onClick={copy}>
            <IconCopy /> PGN
          </button>
          {canShare && (
            <button className="btn3d grey" disabled={!verbose.length} onClick={share}>
              <IconShare /> Share
            </button>
          )}
        </div>
      }
    >
      {verbose.length === 0 ? (
        <div className="empty">No moves yet. White, you're up!</div>
      ) : (
        <div className="moves" ref={listRef}>
          {rows.map(([w, b], i) => (
            <motion.div key={i} className="move-row" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 14) * 0.025 }}>
              <span className="num">{i + 1}</span>
              <span className={`san${i * 2 === verbose.length - 1 ? ' cur' : ''}`}>{w.san}</span>
              <span className={`san${b && i * 2 + 1 === verbose.length - 1 ? ' cur' : ''}`}>{b?.san ?? ''}</span>
            </motion.div>
          ))}
        </div>
      )}
      {toast && (
        <motion.div className="toast" initial={{ y: 20, scale: 0.8, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}>
          {toast}
        </motion.div>
      )}
    </Sheet>
  );
}

const MINUTES: Array<number | null> = [null, 1, 3, 5, 10, 15];
const INCREMENTS = [0, 2, 5, 10];

export function NewMatchSheet({ current, inProgress, onStart, onClose }: { current: TimeControl; inProgress: boolean; onStart: (tc: TimeControl) => void; onClose: () => void }) {
  const [tc, setTc] = useState<TimeControl>(current);
  return (
    <Sheet
      title="New match"
      onClose={onClose}
      footer={
        <button className="btn3d wide" onClick={() => onStart(tc)}>
          Start · {tcLabel(tc)}
        </button>
      }
    >
      <h4 className="section">Time control</h4>
      <div className="chips">
        {MINUTES.map((m, i) => (
          <motion.button
            key={String(m)}
            className={`chip${tc.minutes === m ? ' sel' : ''}`}
            onClick={() => setTc({ minutes: m, increment: m === null ? 0 : tc.increment })}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: tc.minutes === m ? 1.04 : 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: i * 0.03 }}
            whileTap={{ scale: 0.92 }}
          >
            <strong>{m === null ? '∞' : m}</strong>
            <small>{m === null ? 'No timer' : m === 1 ? 'minute' : 'minutes'}</small>
          </motion.button>
        ))}
      </div>
      <h4 className="section">Bonus time per move</h4>
      <Segmented options={INCREMENTS.map((inc) => ({ id: inc, label: inc === 0 ? 'None' : `+${inc}s` }))} value={tc.increment} disabled={tc.minutes === null} onChange={(v) => setTc({ ...tc, increment: v })} />
      <p className="note">
        {tc.minutes === null ? 'Play at your own pace, no clocks.' : 'Each player gets their own clock. Clocks start once White makes the first move.'}
        {inProgress && ' Starting a new match ends the current game.'}
      </p>
    </Sheet>
  );
}
