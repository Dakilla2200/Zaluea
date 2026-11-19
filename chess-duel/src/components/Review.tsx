import { Chess } from 'chess.js';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Engine, type EngineEval } from '../engine';
import { findKing, squareToCoords, trackPieces, type Color, type Move, type Square } from '../game';
import type { PieceStyleId } from '../pieces';
import { CLASS_INFO, CLASS_ORDER, classify, formatEval, moveUci, summarize, whiteWinPct, type ReviewedMove } from '../review';
import type { SoundName } from '../sound';
import type { BoardTheme } from '../themes';
import { Board } from './Board';
import { IconClose, IconPause, IconPlay } from './Icons';
import { Pip, type PipMood } from './Pip';

interface Props {
  verbose: Move[];
  names: Record<Color, string>;
  theme: BoardTheme;
  pieceStyle: PieceStyleId;
  showCoords: boolean;
  sfx: (n: SoundName, file?: number) => void;
  onClose: () => void;
}

type Status = 'loading' | 'analyzing' | 'done' | 'failed';

/** Per position: the engine's best line, plus (when the game's move differs) the score of the move actually played. */
interface PosAnalysis {
  best: EngineEval;
  played?: EngineEval;
}
/** Analyses are kept for the session, so reopening a review is instant. */
const cache = new Map<string, Array<PosAnalysis | undefined>>();
const NO_TARGETS = new Map<Square, boolean>();
const noop = () => {};

function terminalEval(fen: string): EngineEval | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { mate: c.turn() === 'w' ? -1 : 1, best: null };
  if (c.isDraw() || c.isStalemate()) return { cp: 0, best: null };
  return null;
}

function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

function comment(idx: number, verbose: Move[], r: ReviewedMove | undefined, status: Status, acc: Record<Color, number | null>, names: Record<Color, string>): { text: string; mood: PipMood } {
  if (idx === 0) {
    if (status === 'failed') return { text: "I couldn't start the analyzer, but here's your full replay!", mood: 'worried' };
    if (status !== 'done') return { text: 'Analyzing your game… you can already step through the moves.', mood: 'idle' };
    const w = acc.w ?? 0;
    const b = acc.b ?? 0;
    const top = w === b ? null : w > b ? 'w' : 'b';
    return { text: top ? `${names[top]} played the sharper game with ${Math.max(w, b)}% accuracy! Tap ▶ to replay.` : `Neck and neck, both at ${w}% accuracy!`, mood: 'happy' };
  }
  const m = verbose[idx - 1];
  if (!r) return { text: status === 'failed' ? `${m.san}` : `${m.san}… thinking about this one.`, mood: 'idle' };
  const best = r.bestSan;
  switch (r.cls) {
    case 'best':
      return { text: `${m.san} is the best move!`, mood: 'happy' };
    case 'excellent':
      return { text: `${m.san}: excellent!`, mood: 'happy' };
    case 'good':
      return { text: `${m.san} is a good move.${best ? ` ${best} was a bit better.` : ''}`, mood: 'idle' };
    case 'forced':
      return { text: `${m.san} was the only legal move.`, mood: 'idle' };
    case 'inaccuracy':
      return { text: `${m.san} is an inaccuracy.${best ? ` ${best} was better.` : ''}`, mood: 'worried' };
    case 'mistake':
      return { text: `Mistake!${best ? ` ${best} was much stronger.` : ''}`, mood: 'worried' };
    case 'blunder':
      return { text: `Ouch, a blunder!${best ? ` ${best} was the move.` : ''}`, mood: 'surprised' };
  }
}

function Arrow({ uci }: { uci: string }) {
  const a = squareToCoords(uci.slice(0, 2) as Square);
  const b = squareToCoords(uci.slice(2, 4) as Square);
  const x1 = a.file + 0.5;
  const y1 = 7 - a.rank + 0.5;
  const x2 = b.file + 0.5;
  const y2 = 7 - b.rank + 0.5;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1) - 0.32;
  return (
    <svg className="arrow-layer" viewBox="0 0 8 8" aria-hidden>
      <g transform={`translate(${x1} ${y1}) rotate(${(ang * 180) / Math.PI})`}>
        <motion.path d={`M0 0 L${len - 0.2} 0`} fill="none" stroke="#4cc264" strokeWidth="0.2" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 } as never} animate={{ pathLength: 1, opacity: 0.9 } as never} transition={{ duration: 0.35, ease: 'easeOut' }} />
        <motion.path d={`M${len} 0 L${len - 0.42} -0.32 L${len - 0.42} 0.32 Z`} fill="#4cc264" initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} transition={{ delay: 0.3, duration: 0.15 }} />
      </g>
    </svg>
  );
}

function EvalGraph({ evals, reviewed, idx, n, onPick }: { evals: Array<EngineEval | undefined>; reviewed: Array<ReviewedMove | undefined>; idx: number; n: number; onPick: (i: number) => void }) {
  const W = Math.max(n, 1);
  const pts: string[] = [];
  evals.forEach((e, i) => e && pts.push(`${i},${(100 - whiteWinPct(e)).toFixed(2)}`));
  const lastX = pts.length ? Number(pts[pts.length - 1].split(',')[0]) : 0;
  const area = pts.length ? `M0,100 L${pts.join(' L')} L${lastX},100 Z` : '';
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onPick(Math.max(0, Math.min(n, Math.round(((e.clientX - r.left) / r.width) * W))));
  };
  return (
    <div className="eval-graph" onPointerDown={pick} role="slider" aria-label="Evaluation graph" aria-valuemin={0} aria-valuemax={n} aria-valuenow={idx}>
      <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none">
        <rect x="0" y="0" width={W} height="100" className="eg-black" />
        {area && <path d={area} className="eg-white" />}
        <line x1="0" x2={W} y1="50" y2="50" className="eg-mid" vectorEffect="non-scaling-stroke" />
        <line x1={idx} x2={idx} y1="0" y2="100" className="eg-cursor" vectorEffect="non-scaling-stroke" />
      </svg>
      {reviewed.map((r, i) =>
        r && (r.cls === 'blunder' || r.cls === 'mistake') && evals[i + 1] ? (
          <i key={i} className="eg-dot" style={{ left: `${((i + 1) / W) * 100}%`, top: `${100 - whiteWinPct(evals[i + 1]!)}%`, background: CLASS_INFO[r.cls].color }} />
        ) : null,
      )}
    </div>
  );
}

export function Review(p: Props) {
  const n = p.verbose.length;
  const key = p.verbose.map((m) => m.lan).join(' ');
  const [analysis, setAnalysis] = useState<Array<PosAnalysis | undefined>>(() => cache.get(key) ?? []);
  const [status, setStatus] = useState<Status>(() => (cache.get(key)?.filter(Boolean).length === n + 1 ? 'done' : 'loading'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [burst, setBurst] = useState<{ square: Square; key: number } | null>(null);

  const fens = useMemo(() => (n ? [...p.verbose.map((m) => m.before), p.verbose[n - 1].after] : [new Chess().fen()]), [p.verbose, n]);

  // ---------- engine analysis (progressive) ----------
  useEffect(() => {
    if (status === 'done') return;
    let cancelled = false;
    let engine: Engine | null = null;
    const results = [...(cache.get(key) ?? [])];
    (async () => {
      try {
        engine = await Engine.create();
        if (cancelled) return;
        setStatus('analyzing');
        const movetime = Math.max(250, Math.min(700, Math.round(40000 / (n + 1))));
        for (let i = 0; i <= n; i++) {
          if (cancelled) return;
          if (results[i]) continue;
          const term = terminalEval(fens[i]);
          if (term) results[i] = { best: term };
          else {
            const best = await engine.analyse(fens[i], movetime);
            const m = p.verbose[i];
            const played = m && best.best !== moveUci(m) ? await engine.analyse(fens[i], movetime, 13, moveUci(m)) : undefined;
            results[i] = { best, played };
          }
          cache.set(key, [...results]);
          if (!cancelled) setAnalysis([...results]);
        }
        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
      engine?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const evals = useMemo(() => analysis.map((a) => a?.best), [analysis]);
  const reviewed = useMemo(
    () =>
      p.verbose.map((m, i) => {
        const a = analysis[i];
        if (!a) return undefined;
        const played = a.best.best === moveUci(m) ? a.best : a.played;
        if (!played) return undefined;
        return classify(m, a.best, played, new Chess(m.before).moves().length, uciToSan(m.before, a.best.best));
      }),
    [p.verbose, analysis],
  );
  const summary = useMemo(() => summarize(p.verbose, reviewed), [p.verbose, reviewed]);
  const progress = n === 0 ? 1 : evals.filter(Boolean).length / (n + 1);

  // ---------- navigation ----------
  const idxRef = useRef(0);
  idxRef.current = idx;
  const { sfx, verbose, onClose } = p;
  const go = useCallback(
    (to: number) => {
      const cur = idxRef.current;
      const next = Math.max(0, Math.min(n, to));
      if (next === cur) return;
      if (next === cur + 1) {
        const m = verbose[cur];
        const f = m.to.charCodeAt(0) - 97;
        if (m.captured) {
          setBurst({ square: m.isEnPassant() ? ((m.to[0] + m.from[1]) as Square) : m.to, key: Date.now() });
          sfx('capture', f);
        } else if (m.isKingsideCastle() || m.isQueensideCastle()) sfx('castle', f);
        else sfx('move', f);
      } else sfx('undo');
      idxRef.current = next;
      setIdx(next);
    },
    [n, verbose, sfx],
  );

  useEffect(() => {
    if (!playing) return;
    if (idx >= n) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => go(idx + 1), 1100);
    return () => clearTimeout(t);
  }, [playing, idx, n, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(idx + 1);
      else if (e.key === 'ArrowLeft') go(idx - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, idx, onClose]);

  // keep the current move chip in view
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [idx]);

  // ---------- board sizing ----------
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const s = Math.min(el.clientWidth - 16 - 22, el.clientHeight - 22);
      setSize(Math.max(160, Math.floor(s / 8) * 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- current position view ----------
  const pieces = useMemo(() => trackPieces(p.verbose.slice(0, idx)).filter((x) => !x.ghost), [p.verbose, idx]);
  const posChess = useMemo(() => new Chess(fens[idx]), [fens, idx]);
  const checkSquare = posChess.isCheck() ? findKing(posChess, posChess.turn()) : null;
  const lastM = idx > 0 ? p.verbose[idx - 1] : null;
  const lastMoverId = useMemo(() => (lastM ? (pieces.find((x) => x.square === lastM.to)?.id ?? null) : null), [pieces, lastM]);
  const cur = idx > 0 ? reviewed[idx - 1] : undefined;
  const showArrow = cur && cur.best && cur.cls !== 'best' && cur.cls !== 'forced' ? cur.best : null;
  const curEval = evals[idx];
  const whitePct = curEval ? whiteWinPct(curEval) : 50;
  const say = comment(idx, p.verbose, cur, status, summary.accuracy, p.names);

  return (
    <motion.div className="review" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
      <header className="rv-head">
        <motion.button className="icon-btn" onClick={p.onClose} aria-label="Close review" whileTap={{ scale: 0.85, rotate: 90 }}>
          <IconClose />
        </motion.button>
        <h2>Game review</h2>
        <span className={`rv-status ${status}`}>{status === 'done' ? 'Analyzed' : status === 'failed' ? 'Replay only' : `${Math.round(progress * 100)}%`}</span>
      </header>
      {status !== 'done' && status !== 'failed' && (
        <div className="rv-progress">
          <motion.i animate={{ width: `${Math.max(4, progress * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      )}

      <div className="rv-players">
        {(['w', 'b'] as Color[]).map((c) => (
          <div key={c} className={`rv-player ${c}`}>
            <div className="rv-acc">
              <small>{p.names[c]}</small>
              <strong>{status === 'failed' ? '–' : summary.accuracy[c] === null ? '…' : `${summary.accuracy[c]}%`}</strong>
            </div>
            <div className="rv-counts">
              {CLASS_ORDER.slice(3).map((k) => (
                <span key={k} title={CLASS_INFO[k].label} style={{ '--c': CLASS_INFO[k].color } as React.CSSProperties}>
                  <b>{CLASS_INFO[k].symbol}</b>
                  {summary.counts[c][k]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rv-pip">
        <Pip mood={say.mood} pulse={idx + 1} size={40} />
        <AnimatePresence mode="popLayout">
          <motion.div key={`${idx}-${say.text}`} className="bubble static rv-bubble" initial={{ scale: 0.6, opacity: 0, x: -10 }} animate={{ scale: 1, opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 24 }}>
            {cur && (
              <span className="cls-badge" style={{ background: CLASS_INFO[cur.cls].color }}>
                {CLASS_INFO[cur.cls].symbol} {CLASS_INFO[cur.cls].label}
              </span>
            )}
            {say.text}
          </motion.div>
        </AnimatePresence>
      </div>

      {status !== 'failed' && <EvalGraph evals={evals} reviewed={reviewed} idx={idx} n={n} onPick={(i) => go(i)} />}

      <div className="rv-board" ref={areaRef}>
        {status !== 'failed' && (
          <div className="eval-bar" style={{ height: size + 16 }} aria-label={`Evaluation ${formatEval(curEval)}`}>
            <motion.i animate={{ height: `${whitePct}%` }} transition={{ type: 'spring', stiffness: 140, damping: 20 }} />
            <span className={whitePct >= 50 ? 'low' : 'high'}>{formatEval(curEval)}</span>
          </div>
        )}
        {size > 0 && (
          <Board
            pieces={pieces}
            theme={p.theme}
            pieceStyle={p.pieceStyle}
            selected={null}
            targets={NO_TARGETS}
            lastMove={lastM ? { from: lastM.from, to: lastM.to } : null}
            lastMoverId={lastMoverId}
            checkSquare={checkSquare}
            checkKey={0}
            burst={burst}
            showCoords={p.showCoords}
            orientation="pass"
            turn="w"
            onSquare={noop}
            size={size}
          >
            {showArrow && <Arrow key={`${idx}${showArrow}`} uci={showArrow} />}
            {cur && lastM && (
              <motion.span
                key={`b${idx}`}
                className="sq-badge"
                style={{ left: `${(squareToCoords(lastM.to).file + 1) * 12.5}%`, top: `${(7 - squareToCoords(lastM.to).rank) * 12.5}%`, background: CLASS_INFO[cur.cls].color }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 14, delay: 0.25 }}
              >
                {CLASS_INFO[cur.cls].symbol}
              </motion.span>
            )}
          </Board>
        )}
      </div>

      <div className="rv-strip" ref={stripRef}>
        <button data-i={0} className={`mv-chip start${idx === 0 ? ' cur' : ''}`} onClick={() => go(0)}>
          Start
        </button>
        {p.verbose.map((m, i) => {
          const r = reviewed[i];
          return (
            <button key={i} data-i={i + 1} className={`mv-chip${idx === i + 1 ? ' cur' : ''}`} onClick={() => go(i + 1)}>
              {i % 2 === 0 && <span className="mv-num">{i / 2 + 1}.</span>}
              {m.san}
              {r && r.cls !== 'good' && r.cls !== 'excellent' && r.cls !== 'forced' && (
                <i className="mv-cls" style={{ background: CLASS_INFO[r.cls].color }}>
                  {CLASS_INFO[r.cls].symbol}
                </i>
              )}
            </button>
          );
        })}
      </div>

      <div className="rv-controls">
        <button className="btn3d grey" onClick={() => go(0)} disabled={idx === 0} aria-label="First move">
          ⏮
        </button>
        <button className="btn3d grey" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous move">
          ◀
        </button>
        <button
          className="btn3d play"
          onClick={() => {
            if (idx >= n) go(0);
            setPlaying((v) => !v || idx >= n);
          }}
          disabled={n === 0}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="btn3d grey" onClick={() => go(idx + 1)} disabled={idx >= n} aria-label="Next move">
          ▶
        </button>
        <button className="btn3d grey" onClick={() => go(n)} disabled={idx >= n} aria-label="Last move">
          ⏭
        </button>
      </div>
      <p className="rv-credit">Analysis by Stockfish 10 (GPL-3.0), running on your device.</p>
    </motion.div>
  );
}
