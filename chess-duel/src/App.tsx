import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from './components/Board';
import { IconHistory, IconNew, IconPause, IconPlay, IconRestart, IconSettings, IconUndo } from './components/Icons';
import { ConfirmDialog, GameOverOverlay, PromotionPicker } from './components/Overlays';
import { PlayerPanel, type PanelPrompt } from './components/PlayerPanel';
import { Review } from './components/Review';
import { HistorySheet, NewMatchSheet, SettingsSheet } from './components/Sheets';
import {
  boardResult,
  capturedBy,
  findKing,
  materialBalance,
  other,
  replay,
  timeoutResult,
  trackPieces,
  type Color,
  type GameResult,
  type MoveInput,
  type PieceSymbol,
  type Square,
} from './game';
import { pipLine, reactToMove, type PipState } from './mascot';
import { initialClocks, loadGame, loadSettings, saveGame, saveSettings, tcLabel, type Settings, type TimeControl } from './settings';
import { playSound, setFxVolume, setMusic, setMusicVolume, suspendAudio, unlockAudio, type SoundName } from './sound';
import { themeById } from './themes';

type Modal = null | 'settings' | 'history' | 'new' | 'restart';

const saved = loadGame();
const fileOf = (sq: Square) => sq.charCodeAt(0) - 97;

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [moves, setMoves] = useState<MoveInput[]>(saved?.moves ?? []);
  const [tc, setTc] = useState<TimeControl>(saved?.tc ?? { minutes: null, increment: 0 });
  const [clocks, setClocks] = useState<Record<Color, number>>(saved?.clocks ?? initialClocks({ minutes: null, increment: 0 }));
  const [manualResult, setManualResult] = useState<GameResult | null>(
    saved?.result && ['timeout', 'timeout-insufficient', 'resign', 'agreement'].includes(saved.result.kind) ? saved.result : null,
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [modal, setModal] = useState<Modal>(saved ? null : 'new');
  // a restored timed game starts paused so nobody loses time while the app was closed
  const [paused, setPaused] = useState<boolean>(!!saved && saved.tc.minutes !== null && saved.moves.length > 0 && !saved.result);
  const [overlayHidden, setOverlayHidden] = useState(!!saved?.result);
  const [drawOfferBy, setDrawOfferBy] = useState<Color | null>(null);
  const [resignAsk, setResignAsk] = useState<Color | null>(null);
  const [pip, setPip] = useState<PipState>(() => pipLine.start('w', 1));
  const [burst, setBurst] = useState<{ square: Square; key: number } | null>(null);
  const [checkKey, setCheckKey] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const { chess, verbose } = useMemo(() => replay(moves), [moves]);
  const pieces = useMemo(() => trackPieces(verbose).filter((p) => !p.ghost), [verbose]);
  const turn = chess.turn();
  const result = manualResult ?? boardResult(chess);
  const timed = tc.minutes !== null;
  const clockRunning = timed && !result && !paused && moves.length > 0 && modal === null && !reviewOpen;

  const sfx = useCallback((name: SoundName, file?: number) => {
    if (settingsRef.current.sound) playSound(name, file);
  }, []);
  const buzz = useCallback((ms: number | number[]) => {
    if (settingsRef.current.haptics && 'vibrate' in navigator) navigator.vibrate?.(ms);
  }, []);
  const react = useCallback((fn: (pulse: number) => PipState) => setPip((p) => fn(p.pulse + 1)), []);

  // ---------- audio settings ----------
  useEffect(() => setFxVolume(settings.fxVolume), [settings.fxVolume]);
  useEffect(() => setMusicVolume(settings.musicVolume), [settings.musicVolume]);
  useEffect(() => setMusic(settings.music), [settings.music]);

  // speech bubbles disappear after a moment
  useEffect(() => {
    if (!pip.text) return;
    const t = setTimeout(() => setPip((p) => (p.pulse === pip.pulse ? { ...p, text: null, mood: p.mood === 'cheer' && !result ? 'idle' : p.mood } : p)), 2600);
    return () => clearTimeout(t);
  }, [pip.pulse, pip.text, result]);

  // ---------- persistence ----------
  useEffect(() => saveSettings(settings), [settings]);
  const clocksRef = useRef(clocks);
  clocksRef.current = clocks;
  const persist = useCallback(() => saveGame({ moves, tc, clocks: clocksRef.current, result }), [moves, tc, result]);
  useEffect(() => persist(), [persist]);
  useEffect(() => {
    const onVis = () => {
      const hidden = document.visibilityState === 'hidden';
      suspendAudio(hidden);
      if (hidden) {
        persist();
        if (timed && moves.length > 0 && !result) setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', persist);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', persist);
    };
  }, [persist, timed, moves.length, result]);

  // ---------- game end ----------
  const prevResult = useRef(result);
  useEffect(() => {
    if (result && !prevResult.current) {
      setOverlayHidden(false);
      setSelected(null);
      setDrawOfferBy(null);
      setResignAsk(null);
      react((n) => pipLine.result(result, n));
      setTimeout(() => sfx(result.winner ? 'win' : 'draw'), 450);
      buzz(result.winner ? [30, 60, 30, 60, 90] : [40, 80, 40]);
    }
    prevResult.current = result;
  }, [result, sfx, buzz, react]);

  // ---------- chess clock ----------
  useEffect(() => {
    if (!clockRunning) return;
    let last = performance.now();
    let lastWhole = Math.ceil(clocksRef.current[turn] / 1000);
    const id = window.setInterval(() => {
      const now = performance.now();
      const left = Math.max(0, clocksRef.current[turn] - (now - last));
      last = now;
      const whole = Math.ceil(left / 1000);
      if (left > 0 && left < 10_000 && whole !== lastWhole) {
        sfx('lowtime', turn === 'w' ? 2 : 5);
        if (whole === 9) react((n) => pipLine.lowTime(turn, n));
      }
      lastWhole = whole;
      setClocks((c) => ({ ...c, [turn]: left }));
      if (left <= 0) setManualResult(timeoutResult(chess, turn));
    }, 100);
    return () => window.clearInterval(id);
  }, [clockRunning, turn, chess, sfx, react]);

  // ---------- moves ----------
  const commitMove = useCallback(
    (input: MoveInput) => {
      const next = [...moves, input];
      const { chess: after, verbose: v } = replay(next);
      if (v.length !== next.length) return;
      const m = v[v.length - 1];
      setMoves(next);
      setSelected(null);
      setDrawOfferBy(null);
      setResignAsk(null);
      if (timed && moves.length > 0 && tc.increment) setClocks((c) => ({ ...c, [m.color]: c[m.color] + tc.increment * 1000 }));
      const f = fileOf(m.to);
      if (m.captured) setBurst({ square: m.isEnPassant() ? ((m.to[0] + m.from[1]) as Square) : m.to, key: Date.now() });
      if (after.isCheck()) setCheckKey((k) => k + 1);
      if (after.isCheck() && !after.isCheckmate()) {
        sfx(m.captured ? 'capture' : 'move', f);
        setTimeout(() => sfx('check'), 140);
      } else if (m.promotion) sfx('promote', f);
      else if (m.captured) sfx('capture', f);
      else if (m.isKingsideCastle() || m.isQueensideCastle()) sfx('castle', f);
      else sfx('move', f);
      buzz(m.captured || after.isCheck() ? 24 : 10);
      setPip((p) => reactToMove(m, after, p));
    },
    [moves, timed, tc.increment, sfx, buzz],
  );

  const legal = useMemo(() => (selected ? chess.moves({ square: selected, verbose: true }) : []), [chess, selected]);
  const targets = useMemo(() => {
    const map = new Map<Square, boolean>();
    if (settings.showLegal) for (const m of legal) map.set(m.to, !!m.captured);
    return map;
  }, [legal, settings.showLegal]);

  const interactive = !result && !paused && !promo;

  const onSquare = useCallback(
    (sq: Square) => {
      unlockAudio();
      if (!interactive) {
        if (paused && !result) {
          setPaused(false);
          sfx('tap');
        }
        return;
      }
      const piece = chess.get(sq);
      if (selected) {
        const cands = legal.filter((m) => m.to === sq);
        if (cands.length) {
          if (cands.some((m) => m.promotion)) {
            setPromo({ from: selected, to: sq });
            sfx('select', fileOf(sq));
          } else commitMove({ from: selected, to: sq });
          return;
        }
        if (piece && piece.color === turn && sq !== selected) {
          setSelected(sq);
          sfx('select', fileOf(sq));
          buzz(6);
          return;
        }
        setSelected(null);
        if (sq !== selected) sfx('illegal', fileOf(sq));
        return;
      }
      if (piece && piece.color === turn) {
        setSelected(sq);
        sfx('select', fileOf(sq));
        buzz(6);
      } else if (piece) sfx('illegal', fileOf(sq));
    },
    [interactive, paused, result, chess, selected, legal, turn, commitMove, sfx, buzz],
  );

  const onPromote = (t: PieceSymbol) => {
    if (promo) commitMove({ ...promo, promotion: t });
    setPromo(null);
  };

  // ---------- commands ----------
  const canUndo = moves.length > 0 && !manualResult;
  const undo = () => {
    if (!canUndo) return;
    const next = moves.slice(0, -1);
    setMoves(next);
    setSelected(null);
    setPromo(null);
    setDrawOfferBy(null);
    setResignAsk(null);
    setOverlayHidden(false);
    sfx('undo');
    react((n) => pipLine.undo(next.length % 2 === 0 ? 'w' : 'b', n));
    if (next.length === 0 && timed) setClocks(initialClocks(tc));
  };

  const startGame = (nextTc: TimeControl) => {
    setTc(nextTc);
    setMoves([]);
    setClocks(initialClocks(nextTc));
    setManualResult(null);
    setSelected(null);
    setPromo(null);
    setDrawOfferBy(null);
    setResignAsk(null);
    setPaused(false);
    setOverlayHidden(false);
    setModal(null);
    prevResult.current = null;
    sfx('whoosh');
    react((n) => pipLine.start('w', n));
  };

  const openModal = (m: Modal) => {
    sfx('tap');
    setModal(m);
  };

  const panelPrompt = (c: Color): PanelPrompt => {
    if (resignAsk === c) return 'confirm-resign';
    if (drawOfferBy === other(c)) return 'draw-offered-to-me';
    if (drawOfferBy === c) return 'draw-offered-by-me';
    return 'none';
  };
  const onPanelConfirm = (c: Color) => {
    if (resignAsk === c) {
      setResignAsk(null);
      setManualResult({ kind: 'resign', winner: other(c) });
    } else if (drawOfferBy === other(c)) {
      setDrawOfferBy(null);
      setManualResult({ kind: 'agreement' });
    }
  };
  const onPanelCancel = (c: Color) => {
    sfx('tap');
    if (resignAsk === c) setResignAsk(null);
    else if (drawOfferBy === other(c)) setDrawOfferBy(null);
  };

  // ---------- responsive board sizing ----------
  const stageRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const st = stageRef.current;
      const t = topRef.current;
      const bt = bottomRef.current;
      if (!st || !t || !bt) return;
      const gaps = 2 * 14; // .stage gap
      const frame = 16 + 6; // board rim + its 3D edge
      const availH = st.clientHeight - t.offsetHeight - bt.offsetHeight - gaps - frame;
      const availW = st.clientWidth - 16;
      setBoardSize(Math.max(160, Math.floor(Math.min(availW, availH) / 8) * 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    [stageRef, topRef, bottomRef].forEach((r) => r.current && ro.observe(r.current));
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  // ---------- derived view data ----------
  const caps = useMemo(() => capturedBy(verbose), [verbose]);
  const balance = useMemo(() => materialBalance(chess), [chess]);
  const checkSquare = chess.isCheck() ? findKing(chess, turn) : null;
  const last = verbose[verbose.length - 1];
  const lastMove = last ? { from: last.from, to: last.to } : null;
  const lastMoverId = useMemo(() => (last ? (pieces.find((p) => p.square === last.to)?.id ?? null) : null), [pieces, last]);
  const theme = themeById(settings.theme);
  const gameOver = !!result;
  const canAct = !result && moves.length > 0;
  const pass = settings.orientation === 'pass';
  const topColor: Color = pass && turn === 'b' ? 'w' : 'b';
  const bottomColor = other(topColor);
  const boardTurned = pass && turn === 'b';

  const panel = (c: Color) => (
    <PlayerPanel
      color={c}
      name={settings.names[c] || (c === 'w' ? 'White' : 'Black')}
      turned={!pass && c === 'b'}
      active={turn === c}
      inCheck={turn === c && !!checkSquare}
      gameOver={gameOver}
      outcome={!result ? null : !result.winner ? 'draw' : result.winner === c ? 'won' : 'lost'}
      captured={caps[c]}
      advantage={c === 'w' ? balance : -balance}
      pieceStyle={settings.pieces}
      clockMs={timed ? clocks[c] : null}
      clockRunning={clockRunning && turn === c}
      prompt={panelPrompt(c)}
      canAct={canAct}
      pip={settings.mascot && pip.side === c ? { mood: pip.mood, pulse: pip.pulse, text: pip.text } : null}
      onResign={() => {
        sfx('tap');
        setDrawOfferBy(null);
        setResignAsk(c);
      }}
      onOfferDraw={() => {
        sfx('tap');
        setResignAsk(null);
        setDrawOfferBy(c);
        react((n) => pipLine.drawOffer(other(c), n));
      }}
      onConfirm={() => onPanelConfirm(c)}
      onCancel={() => onPanelCancel(c)}
    />
  );

  return (
    <div className="app" onPointerDownCapture={unlockAudio}>
      <LayoutGroup>
        <div className="stage" ref={stageRef}>
          <div className="top-slot" ref={topRef}>
            <motion.div key={topColor} layoutId={`panel-${topColor}`} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
              {panel(topColor)}
            </motion.div>
          </div>

          <main className="board-area">
            <Board
              pieces={pieces}
              theme={theme}
              pieceStyle={settings.pieces}
              selected={selected}
              targets={targets}
              lastMove={lastMove}
              lastMoverId={lastMoverId}
              checkSquare={checkSquare}
              checkKey={checkKey}
              burst={burst}
              showCoords={settings.showCoords}
              orientation={settings.orientation}
              turn={turn}
              onSquare={onSquare}
              size={boardSize}
            >
              <AnimatePresence>
                {promo && <PromotionPicker key="promo" color={turn} pieceStyle={settings.pieces} rotate={turn === 'b' && !pass} onPick={onPromote} onCancel={() => setPromo(null)} />}
                {paused && !result && !promo && (
                  <motion.div key="paused" className={`paused${boardTurned ? ' turned' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className="paused-card" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                      <IconPlay />
                      <span>Paused · tap to resume</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Board>
          </main>

          <div className="bottom-slot" ref={bottomRef}>
            <motion.div key={bottomColor} layoutId={`panel-${bottomColor}`} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
              {panel(bottomColor)}
            </motion.div>
          </div>
        </div>
      </LayoutGroup>

      <nav className="toolbar">
        <ToolButton label="Undo" onClick={undo} disabled={!canUndo}>
          <IconUndo />
        </ToolButton>
        <ToolButton label="Restart" onClick={() => openModal('restart')} disabled={moves.length === 0 && !result}>
          <IconRestart />
        </ToolButton>
        {timed && (
          <ToolButton
            label={paused ? 'Resume' : 'Pause'}
            onClick={() => {
              sfx('tap');
              setPaused((p) => !p);
            }}
            disabled={!!result || moves.length === 0}
            kind={paused ? 'sun' : undefined}
          >
            {paused ? <IconPlay /> : <IconPause />}
          </ToolButton>
        )}
        <ToolButton label="Moves" onClick={() => openModal('history')}>
          <IconHistory />
        </ToolButton>
        <ToolButton label="New" onClick={() => openModal('new')} kind="primary">
          <IconNew />
        </ToolButton>
        <ToolButton label="Settings" onClick={() => openModal('settings')}>
          <IconSettings />
        </ToolButton>
      </nav>

      <AnimatePresence>
        {result && !overlayHidden && (
          <GameOverOverlay
            key="gameover"
            result={result}
            names={settings.names}
            turnTop={!pass}
            stats={{ moves: Math.ceil(verbose.length / 2), captures: { w: caps.w.length, b: caps.b.length } }}
            onRematch={() => startGame(tc)}
            onReview={() => {
              sfx('tap');
              setOverlayHidden(true);
            }}
            onReviewGame={() => {
              sfx('whoosh');
              setOverlayHidden(true);
              setReviewOpen(true);
            }}
            onNewMatch={() => {
              setOverlayHidden(true);
              openModal('new');
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewOpen && (
          <Review
            key="review"
            verbose={verbose}
            names={settings.names}
            theme={theme}
            pieceStyle={settings.pieces}
            showCoords={settings.showCoords}
            sfx={sfx}
            onClose={() => {
              sfx('tap');
              setReviewOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === 'settings' && <SettingsSheet key="settings" settings={settings} onChange={setSettings} onClose={() => setModal(null)} />}
        {modal === 'history' && (
          <HistorySheet
            key="history"
            verbose={verbose}
            result={result}
            names={settings.names}
            onClose={() => setModal(null)}
            onReview={() => {
              sfx('whoosh');
              setModal(null);
              setReviewOpen(true);
            }}
          />
        )}
        {modal === 'new' && <NewMatchSheet key="new" current={tc} inProgress={moves.length > 0 && !result} onStart={startGame} onClose={() => setModal(null)} />}
        {modal === 'restart' && (
          <ConfirmDialog
            key="restart"
            title="Restart game?"
            message={`This game will be lost and a fresh one starts with the same clock (${tcLabel(tc)}).`}
            confirmLabel="Restart"
            danger
            onConfirm={() => startGame(tc)}
            onCancel={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolButton({ label, onClick, disabled, kind, children }: { label: string; onClick: () => void; disabled?: boolean; kind?: 'primary' | 'sun'; children: ReactNode }) {
  return (
    <motion.button className={`tool${kind ? ' ' + kind : ''}`} onClick={onClick} disabled={disabled} aria-label={label} whileTap={disabled ? undefined : { scale: 0.88, y: 3 }} transition={{ type: 'spring', stiffness: 700, damping: 20 }}>
      <span className="tool-icon">{children}</span>
      <span className="tool-label">{label}</span>
    </motion.button>
  );
}
