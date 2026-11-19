import { useEffect, useRef, useState } from 'react';
import { buildPgn, type Color, type GameResult, type Move } from '../game';
import { PIECE_STYLES, pieceImage } from '../pieces';
import { tcLabel, type Settings, type TimeControl } from '../settings';
import { BOARD_THEMES } from '../themes';
import { IconCopy, IconShare } from './Icons';
import { Sheet } from './Overlays';

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="row toggle-row" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <span className="row-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <span className={`switch${value ? ' on' : ''}`}>
        <i />
      </span>
    </button>
  );
}

export function SettingsSheet({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  return (
    <Sheet title="Settings" onClose={onClose}>
      <h4 className="section">Board</h4>
      <div className="swatches">
        {BOARD_THEMES.map((t) => (
          <button key={t.id} className={`swatch${settings.theme === t.id ? ' sel' : ''}`} onClick={() => set('theme', t.id)}>
            <span className="swatch-board" style={{ background: t.frame }}>
              <span style={{ background: `conic-gradient(${t.dark} 0 25%, ${t.light} 0 50%, ${t.dark} 0 75%, ${t.light} 0)` }} />
            </span>
            <small>{t.name}</small>
          </button>
        ))}
      </div>

      <h4 className="section">Pieces</h4>
      <div className="piece-styles">
        {PIECE_STYLES.map((s) => (
          <button key={s.id} className={`piece-style${settings.pieces === s.id ? ' sel' : ''}`} onClick={() => set('pieces', s.id)}>
            <span className="ps-preview">
              <i style={{ backgroundImage: pieceImage(s.id, 'w', 'n') }} />
              <i style={{ backgroundImage: pieceImage(s.id, 'b', 'q') }} />
            </span>
            <small>{s.name}</small>
          </button>
        ))}
      </div>

      <h4 className="section">Players</h4>
      <div className="names">
        {(['w', 'b'] as Color[]).map((c) => (
          <label key={c} className="name-field">
            <span className={`dot-color ${c}`} />
            <input
              value={settings.names[c]}
              maxLength={16}
              placeholder={c === 'w' ? 'White' : 'Black'}
              onChange={(e) => set('names', { ...settings.names, [c]: e.target.value })}
              onBlur={(e) => !e.target.value.trim() && set('names', { ...settings.names, [c]: c === 'w' ? 'White' : 'Black' })}
            />
          </label>
        ))}
      </div>

      <h4 className="section">Game</h4>
      <div className="rows">
        <Toggle label="Sound effects" value={settings.sound} onChange={(v) => set('sound', v)} />
        <Toggle label="Vibration" hint="On supported devices" value={settings.haptics} onChange={(v) => set('haptics', v)} />
        <Toggle label="Show legal moves" value={settings.showLegal} onChange={(v) => set('showLegal', v)} />
        <Toggle label="Board coordinates" value={settings.showCoords} onChange={(v) => set('showCoords', v)} />
        <Toggle label="Face-to-face mode" hint="Black's pieces & panel face the top player" value={settings.rotateTop} onChange={(v) => set('rotateTop', v)} />
      </div>
      <p className="credits">Piece artwork based on “cburnett” by Colin M.L. Burnett (CC BY-SA 3.0).</p>
    </Sheet>
  );
}

export function HistorySheet({ verbose, result, names, onClose }: { verbose: Move[]; result: GameResult | null; names: Record<Color, string>; onClose: () => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState('');
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
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
      setToast('PGN copied');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = pgn;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      setToast(ok ? 'PGN copied' : 'Copy not available');
    }
  };
  const canShare = typeof navigator.share === 'function';
  const share = async () => {
    try {
      await navigator.share({ title: 'Chess Duel game', text: pgn });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Sheet
      title="Move history"
      onClose={onClose}
      footer={
        <div className="foot-actions">
          <button className="btn secondary" disabled={!verbose.length} onClick={copy}>
            <IconCopy /> Copy PGN
          </button>
          {canShare && (
            <button className="btn secondary" disabled={!verbose.length} onClick={share}>
              <IconShare /> Share
            </button>
          )}
        </div>
      }
    >
      {verbose.length === 0 ? (
        <div className="empty">No moves yet. White to play.</div>
      ) : (
        <div className="moves" ref={listRef}>
          {rows.map(([w, b], i) => (
            <div key={i} className="move-row">
              <span className="num">{i + 1}.</span>
              <span className={`san${i * 2 === verbose.length - 1 ? ' cur' : ''}`}>{w.san}</span>
              <span className={`san${b && i * 2 + 1 === verbose.length - 1 ? ' cur' : ''}`}>{b?.san ?? ''}</span>
            </div>
          ))}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
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
        <button className="btn primary wide" onClick={() => onStart(tc)}>
          Start match · {tcLabel(tc)}
        </button>
      }
    >
      <h4 className="section">Time control</h4>
      <div className="chips">
        {MINUTES.map((m) => (
          <button key={String(m)} className={`chip${tc.minutes === m ? ' sel' : ''}`} onClick={() => setTc({ minutes: m, increment: m === null ? 0 : tc.increment })}>
            <strong>{m === null ? '∞' : m}</strong>
            <small>{m === null ? 'No timer' : m === 1 ? 'minute' : 'minutes'}</small>
          </button>
        ))}
      </div>
      <h4 className="section">Increment per move</h4>
      <div className="segmented">
        {INCREMENTS.map((inc) => (
          <button key={inc} disabled={tc.minutes === null} className={tc.increment === inc && tc.minutes !== null ? 'sel' : ''} onClick={() => setTc({ ...tc, increment: inc })}>
            {inc === 0 ? 'None' : `+${inc}s`}
          </button>
        ))}
      </div>
      <p className="note">
        {tc.minutes === null
          ? 'Play at your own pace — no clocks.'
          : "Each player gets their own clock. Clocks start once White makes the first move."}
        {inProgress && ' Starting a new match ends the current game.'}
      </p>
    </Sheet>
  );
}
