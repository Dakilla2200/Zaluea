import { Chess } from 'chess.js';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Engine, type EngineEval } from '../engine';
import { describeDanger, describeMove, describeSuggestion, scoreWord, VERDICT } from '../explain';
import { PIECE_VALUE, findKing, materialBalance, squareToCoords, trackPieces, type Color, type Move, type Square } from '../game';
import { signed, standing } from '../standing';
import type { PieceStyleId } from '../pieces';
import { classify, moveUci, summarize, type ReviewedMove } from '../review';
import type { SoundName } from '../sound';
import type { BoardTheme } from '../themes';
import { Board } from './Board';
import { IconClose } from './Icons';
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
const PIECE_NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const MAX_MOMENTS = 8;

/** Picks the moves worth stopping at: slips, big captures, promotions and the finish. */
function pickMoments(verbose: Move[], reviewed: Array<ReviewedMove | undefined>): number[] {
  const scored: Array<{ i: number; score: number }> = [];
  verbose.forEach((m, i) => {
    const r = reviewed[i];
    let score = 0;
    if (r?.cls === 'blunder') score = 100;
    else if (r?.cls === 'mistake') score = 80;
    if (m.captured && PIECE_VALUE[m.captured] >= 3) score = Math.max(score, 40 + PIECE_VALUE[m.captured]);
    if (m.promotion) score = Math.max(score, 60);
    if (i === verbose.length - 1 && new Chess(m.after).isGameOver()) score = Math.max(score, 90);
    if (score) scored.push({ i, score });
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MOMENTS)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}

/** What this move did to the points, in plain words. */
function pointsChange(m: Move, names: Record<Color, string>): string | null {
  if (m.captured) {
    const v = PIECE_VALUE[m.captured];
    const loser = m.color === 'w' ? 'b' : 'w';
    return `${names[loser]} lost a ${PIECE_NAME[m.captured]}: −${v} point${v === 1 ? '' : 's'}`;
  }
  if (m.promotion) {
    const v = PIECE_VALUE[m.promotion] - 1;
    return `${names[m.color]}'s pawn became a ${PIECE_NAME[m.promotion]}: +${v} points`;
  }
  return null;
}

function Scoreboard({ balance, names }: { balance: number; names: Record<Color, string> }) {
  const w = standing(balance);
  const b = standing(-balance);
  const pos = 50 - (Math.max(-10, Math.min(10, balance)) / 10) * 42; // knob slides toward whoever is ahead (White on the left)
  return (
    <div className="scoreboard" aria-label={`Points: ${names.w} ${signed(balance)}, ${names.b} ${signed(-balance)}`}>
      <span className="sb-side">
        <span className="dot-color w" />
        <b>{signed(balance)}</b>
      </span>
      <div className="sb-bar">
        <span className="sb-mid" />
        <motion.i className="sb-knob" animate={{ left: `${pos}%` }} transition={{ type: 'spring', stiffness: 160, damping: 26 }} />
      </div>
      <span className="sb-side right">
        <b>{signed(-balance)}</b>
        <span className="dot-color b" />
      </span>
      <span className={`standing ${w.tone}`}>{w.label}</span>
      <span />
      <span className={`standing ${b.tone} right`}>{b.label}</span>
    </div>
  );
}

const TONE_MOOD: Record<string, PipMood> = { great: 'cheer', good: 'happy', ok: 'idle', tip: 'idle' };

function terminalEval(fen: string): EngineEval | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { mate: c.turn() === 'w' ? -1 : 1, best: null };
  if (c.isDraw() || c.isStalemate()) return { cp: 0, best: null };
  return null;
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
        <motion.path
          d={`M0 0 L${len - 0.2} 0`}
          fill="none"
          stroke="#4cc264"
          strokeWidth="0.2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 } as never}
          animate={{ pathLength: 1, opacity: 0.9 } as never}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.4 }}
        />
        <motion.path d={`M${len} 0 L${len - 0.42} -0.32 L${len - 0.42} 0.32 Z`} fill="#4cc264" initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} transition={{ delay: 0.9, duration: 0.2 }} />
      </g>
    </svg>
  );
}

function Scores({ names, accuracy, great, failed }: { names: Record<Color, string>; accuracy: Record<Color, number | null>; great: Record<Color, number>; failed: boolean }) {
  return (
    <div className="rv-scores">
      {(['w', 'b'] as Color[]).map((c) => (
        <div key={c} className={`rv-score ${c}`}>
          <span className={`dot-color ${c}`} />
          <span className="rv-score-name">{names[c]}</span>
          {failed ? (
            <span className="rv-score-word">–</span>
          ) : (
            <>
              <span className="rv-score-word">{scoreWord(accuracy[c])}</span>
              {accuracy[c] !== null && <span className="rv-score-num">{accuracy[c]}%</span>}
            </>
          )}
          {!failed && great[c] > 0 && <span className="rv-score-great">{great[c]} great move{great[c] === 1 ? '' : 's'}</span>}
        </div>
      ))}
    </div>
  );
}

export function Review(p: Props) {
  const n = p.verbose.length;
  const key = p.verbose.map((m) => m.lan).join(' ');
  const [analysis, setAnalysis] = useState<Array<PosAnalysis | undefined>>(() => cache.get(key) ?? []);
  const [status, setStatus] = useState<Status>(() => (cache.get(key)?.filter(Boolean).length === n + 1 ? 'done' : 'loading'));
  /** 0 = intro, 1..L = the chosen moves, L+1 = the end summary */
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'key' | 'all'>('key');
  const [burst, setBurst] = useState<{ square: Square; key: number } | null>(null);

  const fens = useMemo(() => (n ? [...p.verbose.map((m) => m.before), p.verbose[n - 1].after] : [new Chess().fen()]), [p.verbose, n]);

  // ---------- engine analysis runs quietly in the background ----------
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

  const reviewed = useMemo(
    () =>
      p.verbose.map((m, i): ReviewedMove | undefined => {
        const a = analysis[i];
        if (!a) return undefined;
        const played = a.best.best === moveUci(m) ? a.best : a.played;
        if (!played) return undefined;
        return classify(m, a.best, played, new Chess(m.before).moves().length, null);
      }),
    [p.verbose, analysis],
  );
  const summary = useMemo(() => summarize(p.verbose, reviewed), [p.verbose, reviewed]);
  const great = { w: summary.counts.w.best + summary.counts.w.excellent, b: summary.counts.b.best + summary.counts.b.excellent };
  const progress = n === 0 ? 1 : analysis.filter(Boolean).length / (n + 1);
  const ready = status === 'done' || status === 'failed';
  const balances = useMemo(() => p.verbose.map((m) => materialBalance(new Chess(m.after))), [p.verbose]);
  const moments = useMemo(() => (ready ? pickMoments(p.verbose, reviewed) : []), [ready, p.verbose, reviewed]);
  const list = useMemo(() => (mode === 'key' ? moments : p.verbose.map((_, i) => i)), [mode, moments, p.verbose]);
  const L = list.length;

  // ---------- stepping ----------
  const { sfx, verbose, onClose } = p;
  const stepRef = useRef(0);
  stepRef.current = step;
  const go = useCallback(
    (to: number) => {
      const cur = stepRef.current;
      const next = Math.max(0, Math.min(L + 1, to));
      if (next === cur) return;
      if (next === cur + 1 && next <= L) {
        const m = verbose[list[next - 1]];
        const f = m.to.charCodeAt(0) - 97;
        if (m.captured) {
          setBurst({ square: m.isEnPassant() ? ((m.to[0] + m.from[1]) as Square) : m.to, key: Date.now() });
          sfx('capture', f);
        } else if (m.isKingsideCastle() || m.isQueensideCastle()) sfx('castle', f);
        else sfx('move', f);
      } else sfx('tap');
      stepRef.current = next;
      setStep(next);
    },
    [L, list, verbose, sfx],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') go(stepRef.current + 1);
      else if (e.key === 'ArrowLeft') go(stepRef.current - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // ---------- board sizing ----------
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const s = Math.min(el.clientWidth - 16, el.clientHeight - 22);
      setSize(Math.max(120, Math.floor(s / 8) * 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- what to show ----------
  const moveIndex = step >= 1 && step <= L ? list[step - 1] : null;
  const idx = step === 0 ? 0 : step > L ? n : moveIndex! + 1; // moves applied to the board
  const skipped = moveIndex === null ? 0 : moveIndex - (step >= 2 ? list[step - 2] : -1) - 1;
  const pieces = useMemo(() => trackPieces(p.verbose.slice(0, idx)).filter((x) => !x.ghost), [p.verbose, idx]);
  const posChess = useMemo(() => new Chess(fens[idx]), [fens, idx]);
  const checkSquare = posChess.isCheck() ? findKing(posChess, posChess.turn()) : null;
  const lastM = idx > 0 ? p.verbose[idx - 1] : null;
  const lastMoverId = useMemo(() => (lastM ? (pieces.find((x) => x.square === lastM.to)?.id ?? null) : null), [pieces, lastM]);
  const cur = moveIndex !== null ? reviewed[moveIndex] : undefined;
  const verdict = cur ? VERDICT[cur.cls] : null;
  const wantsTip = cur && (cur.cls === 'inaccuracy' || cur.cls === 'mistake' || cur.cls === 'blunder');
  const suggestion = wantsTip && lastM ? describeSuggestion(lastM.before, cur.best) : null;
  const showArrow = suggestion && cur?.best ? cur.best : null;

  const isIntro = step === 0;
  const isEnd = step === L + 1 && (L > 0 || n === 0);
  const pipMood: PipMood = isIntro || isEnd ? 'happy' : verdict ? TONE_MOOD[verdict.tone] : 'idle';

  let card;
  if (isIntro) {
    card = (
      <>
        <h3 className="rv-title">Let's look back at your game!</h3>
        <p className="rv-text">
          {ready && mode === 'key' && L === 0
            ? 'This game was calm, with no big moments to look at. Tap “Show every move” below to replay it.'
            : !ready
            ? "I'm finding the most important moments…"
            : mode === 'key'
              ? `I picked the ${L} most important moment${L === 1 ? '' : 's'}. Tap Start whenever you're ready.`
              : `We'll go through all ${n} moves, one at a time.`}
        </p>
        {status !== 'done' && status !== 'failed' && (
          <div className="rv-thinking">
            <span>Pip is studying the game… {Math.round(progress * 100)}%</span>
            <div className="rv-progress">
              <motion.i animate={{ width: `${Math.max(6, progress * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
            </div>
          </div>
        )}
        {status === 'failed' && <p className="rv-note">I couldn't rate the moves on this device, but you can still replay the game.</p>}
      </>
    );
  } else if (isEnd) {
    card = (
      <>
        <h3 className="rv-title">That's the whole game!</h3>
        <p className="rv-text">Nice work, both of you. Every game makes you a little stronger.</p>
        <Scores names={p.names} accuracy={summary.accuracy} great={great} failed={status === 'failed'} />
      </>
    );
  } else if (lastM) {
    card = (
      <>
        <div className="rv-verdict-row">
          {verdict ? (
            <span className={`rv-verdict ${verdict.tone}`}>{verdict.title}</span>
          ) : status === 'failed' ? null : (
            <span className="rv-verdict waiting">Pip is thinking…</span>
          )}
          {skipped > 0 && <span className="rv-skip">{step === 1 ? `After ${skipped} move${skipped === 1 ? '' : 's'}` : `${skipped} move${skipped === 1 ? '' : 's'} later`}</span>}
        </div>
        <p className="rv-text">
          {describeMove(lastM, p.names)}
          {wantsTip && cur && cur.cls !== 'inaccuracy' && describeDanger(lastM, p.names) && <> {describeDanger(lastM, p.names)}</>}
        </p>
        {lastM && pointsChange(lastM, p.names) && <span className="rv-points">{pointsChange(lastM, p.names)}</span>}
        {suggestion && (
          <p className="rv-tip">
            <b>Tip:</b> {suggestion.charAt(0).toUpperCase() + suggestion.slice(1)} was even better. Follow the green arrow.
          </p>
        )}
      </>
    );
  }

  return (
    <motion.div className="review" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
      <header className="rv-head">
        <h2>Game review</h2>
        {L > 0 && !isIntro && !isEnd && (
          <span className="rv-count">
            {mode === 'key' ? `Moment ${step} of ${L}` : `Move ${step} of ${L}`}
          </span>
        )}
        <motion.button className="icon-btn" onClick={p.onClose} aria-label="Close review" whileTap={{ scale: 0.88 }}>
          <IconClose />
        </motion.button>
      </header>
      <div className="rv-steps" aria-hidden>
        <motion.i animate={{ width: `${L ? (Math.min(step, L) / L) * 100 : 0}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
      </div>

      <div className="rv-board" ref={areaRef}>
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
            {showArrow && !isEnd && <Arrow key={`${step}${showArrow}`} uci={showArrow} />}
          </Board>
        )}
      </div>

      {(moveIndex !== null || isEnd) && n > 0 && <Scoreboard balance={moveIndex !== null ? balances[moveIndex] : balances[n - 1]} names={p.names} />}

      <div className="rv-card-row">
        <div className="rv-pip">
          <Pip mood={pipMood} pulse={step + 1} size={46} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${step}-${verdict?.title ?? ''}-${status === 'failed'}`}
            className="rv-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {card}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="rv-actions">
        {isEnd ? (
          <>
            <button className="btn3d grey" onClick={() => go(0)}>
              Replay
            </button>
            <button className="btn3d leaf" onClick={p.onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <button className="btn3d grey" onClick={() => go(step - 1)} disabled={isIntro}>
              Back
            </button>
            <button className="btn3d leaf" onClick={() => go(step + 1)} disabled={n === 0 || (isIntro && mode === 'key' && (!ready || L === 0))}>
              {isIntro ? (ready || mode === 'all' ? 'Start' : 'Getting ready…') : 'Continue'}
            </button>
          </>
        )}
      </div>
      {(isIntro || isEnd) && n > 0 && (
        <button
          className="rv-mode"
          onClick={() => {
            sfx('tap');
            setMode((m) => (m === 'key' ? 'all' : 'key'));
            stepRef.current = 0;
            setStep(0);
          }}
        >
          {mode === 'key' ? 'Show every move instead' : 'Show only the key moments'}
        </button>
      )}
      <p className="rv-credit">Move ratings by Stockfish 10 (GPL-3.0), running on your device.</p>
    </motion.div>
  );
}
