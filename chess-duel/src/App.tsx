import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Board } from './components/Board';
import { IconHistory, IconNew, IconPause, IconPlay, IconRestart, IconSettings, IconUndo } from './components/Icons';
import { ConfirmDialog, GameOverOverlay, PromotionPicker } from './components/Overlays';
import { PlayerPanel, type PanelPrompt } from './components/PlayerPanel';
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
import { initialClocks, loadGame, loadSettings, saveGame, saveSettings, tcLabel, type Settings, type TimeControl } from './settings';
import { playSound, unlockAudio, type SoundName } from './sound';
import { themeById } from './themes';

type Modal = null | 'settings' | 'history' | 'new' | 'restart';

const saved = loadGame();

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
  // a game restored from storage starts paused so nobody loses time while the app was closed
  const [paused, setPaused] = useState<boolean>(!!saved && saved.tc.minutes !== null && saved.moves.length > 0);
  const [overlayHidden, setOverlayHidden] = useState(!!saved?.result);
  const [drawOfferBy, setDrawOfferBy] = useState<Color | null>(null);
  const [resignAsk, setResignAsk] = useState<Color | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const { chess, verbose } = useMemo(() => replay(moves), [moves]);
  const pieces = useMemo(() => trackPieces(verbose), [verbose]);
  const turn = chess.turn();
  const result = manualResult ?? boardResult(chess);
  const timed = tc.minutes !== null;
  const clockRunning = timed && !result && !paused && moves.length > 0 && modal === null;

  const sfx = useCallback((name: SoundName) => {
    if (settingsRef.current.sound) playSound(name);
  }, []);
  const buzz = useCallback((ms: number | number[]) => {
    if (settingsRef.current.haptics && 'vibrate' in navigator) navigator.vibrate?.(ms);
  }, []);

  // ---------- persistence ----------
  useEffect(() => saveSettings(settings), [settings]);
  const clocksRef = useRef(clocks);
  clocksRef.current = clocks;
  const persist = useCallback(() => saveGame({ moves, tc, clocks: clocksRef.current, result }), [moves, tc, result]);
  useEffect(() => persist(), [persist]);
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        persist();
        if (timed) setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', persist);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', persist);
    };
  }, [persist, timed]);

  // ---------- result sounds ----------
  const prevResult = useRef(result);
  useEffect(() => {
    if (result && !prevResult.current) {
      setOverlayHidden(false);
      setSelected(null);
      setDrawOfferBy(null);
      setResignAsk(null);
      setTimeout(() => sfx(result.winner ? 'win' : 'draw'), 350);
      buzz(result.winner ? [30, 60, 30, 60, 80] : [40, 80, 40]);
    }
    prevResult.current = result;
  }, [result, sfx, buzz]);

  // ---------- chess clock ----------
  useEffect(() => {
    if (!clockRunning) return;
    let last = performance.now();
    let lastWhole = Math.ceil(clocksRef.current[turn] / 1000);
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const left = Math.max(0, clocksRef.current[turn] - dt);
      const whole = Math.ceil(left / 1000);
      if (left > 0 && left < 10_000 && whole !== lastWhole) sfx('lowtime');
      lastWhole = whole;
      setClocks((c) => ({ ...c, [turn]: left }));
      if (left <= 0) setManualResult(timeoutResult(chess, turn));
    }, 100);
    return () => window.clearInterval(id);
  }, [clockRunning, turn, chess, sfx]);

  // ---------- moves ----------
  const commitMove = useCallback(
    (input: MoveInput) => {
      const next = [...moves, input];
      const { chess: after, verbose: v } = replay(next);
      if (v.length !== next.length) return; // illegal; should never happen
      const m = v[v.length - 1];
      setMoves(next);
      setSelected(null);
      setDrawOfferBy(null);
      setResignAsk(null);
      if (timed && moves.length > 0 && tc.increment) {
        setClocks((c) => ({ ...c, [m.color]: c[m.color] + tc.increment * 1000 }));
      }
      if (after.isCheck()) sfx('check');
      else if (m.promotion) sfx('promote');
      else if (m.captured) sfx('capture');
      else if (m.isKingsideCastle() || m.isQueensideCastle()) sfx('castle');
      else sfx('move');
      buzz(m.captured || after.isCheck() ? 22 : 10);
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
        if (paused && !result) setPaused(false);
        return;
      }
      const piece = chess.get(sq);
      if (selected) {
        const cands = legal.filter((m) => m.to === sq);
        if (cands.length) {
          if (cands.some((m) => m.promotion)) setPromo({ from: selected, to: sq });
          else commitMove({ from: selected, to: sq });
          return;
        }
        if (piece && piece.color === turn) {
          setSelected(sq === selected ? null : sq);
          if (sq !== selected) sfx('select');
          return;
        }
        if (!settings.showLegal && sq !== selected) sfx('illegal');
        setSelected(null);
        return;
      }
      if (piece && piece.color === turn) {
        setSelected(sq);
        sfx('select');
      }
    },
    [interactive, paused, result, chess, selected, legal, turn, commitMove, sfx, settings.showLegal],
  );

  const onPromote = (t: PieceSymbol) => {
    if (promo) commitMove({ ...promo, promotion: t });
    setPromo(null);
  };

  // ---------- commands ----------
  const canUndo = moves.length > 0 && !manualResult;
  const undo = () => {
    if (!canUndo) return;
    setMoves((m) => m.slice(0, -1));
    setSelected(null);
    setPromo(null);
    setDrawOfferBy(null);
    setResignAsk(null);
    setOverlayHidden(false);
    sfx('move');
    if (moves.length === 1 && timed) setClocks(initialClocks(tc));
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
      const st = stageRef.current, t = topRef.current, bt = bottomRef.current;
      if (!st || !t || !bt) return;
      const gaps = 2 * 10; // stage row gap (see .stage)
      const frame = 12; // board frame padding
      const availH = st.clientHeight - t.offsetHeight - bt.offsetHeight - gaps - frame;
      const availW = st.clientWidth - frame;
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
  const lastMoverId = useMemo(() => (last ? (pieces.find((p) => !p.ghost && p.square === last.to)?.id ?? null) : null), [pieces, last]);
  const theme = themeById(settings.theme);
  const gameOver = !!result;
  const canAct = !result && moves.length > 0;

  const panel = (c: Color) => (
    <PlayerPanel
      color={c}
      name={settings.names[c] || (c === 'w' ? 'White' : 'Black')}
      top={c === 'b' && settings.rotateTop}
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
      onResign={() => {
        setDrawOfferBy(null);
        setResignAsk(c);
      }}
      onOfferDraw={() => {
        setResignAsk(null);
        setDrawOfferBy(c);
        sfx('select');
      }}
      onConfirm={() => onPanelConfirm(c)}
      onCancel={() => onPanelCancel(c)}
    />
  );

  return (
    <div className={`app theme-${settings.theme}`} onPointerDownCapture={unlockAudio}>
      <div className="stage" ref={stageRef}>
      <div className="top-slot" ref={topRef}>{panel('b')}</div>

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
          showCoords={settings.showCoords}
          rotateTop={settings.rotateTop}
          onSquare={onSquare}
          size={boardSize}
        >
          {promo ? (
            <PromotionPicker color={turn} pieceStyle={settings.pieces} rotate={turn === 'b' && settings.rotateTop} onPick={onPromote} onCancel={() => setPromo(null)} />
          ) : paused && !result ? (
            <div className="paused">
              <div className="paused-card">
                <IconPlay />
                <span>Paused · tap to resume</span>
              </div>
            </div>
          ) : undefined}
        </Board>
      </main>

      <div className="bottom-slot" ref={bottomRef}>{panel('w')}</div>
      </div>

      <nav className="toolbar">
        <ToolButton label="Undo" onClick={undo} disabled={!canUndo}>
          <IconUndo />
        </ToolButton>
        <ToolButton label="Restart" onClick={() => setModal('restart')} disabled={moves.length === 0 && !result}>
          <IconRestart />
        </ToolButton>
        {timed && (
          <ToolButton label={paused ? 'Resume' : 'Pause'} onClick={() => setPaused((p) => !p)} disabled={!!result || moves.length === 0} accent={paused}>
            {paused ? <IconPlay /> : <IconPause />}
          </ToolButton>
        )}
        <ToolButton label="Moves" onClick={() => setModal('history')}>
          <IconHistory />
        </ToolButton>
        <ToolButton label="New" onClick={() => setModal('new')}>
          <IconNew />
        </ToolButton>
        <ToolButton label="Settings" onClick={() => setModal('settings')}>
          <IconSettings />
        </ToolButton>
      </nav>

      {result && !overlayHidden && (
        <GameOverOverlay
          result={result}
          names={settings.names}
          pieceStyle={settings.pieces}
          rotateTop={settings.rotateTop}
          onRematch={() => startGame(tc)}
          onReview={() => setOverlayHidden(true)}
          onNewMatch={() => {
            setOverlayHidden(true);
            setModal('new');
          }}
        />
      )}

      {modal === 'settings' && <SettingsSheet settings={settings} onChange={setSettings} onClose={() => setModal(null)} />}
      {modal === 'history' && <HistorySheet verbose={verbose} result={result} names={settings.names} onClose={() => setModal(null)} />}
      {modal === 'new' && <NewMatchSheet current={tc} inProgress={moves.length > 0 && !result} onStart={startGame} onClose={() => setModal(null)} />}
      {modal === 'restart' && (
        <ConfirmDialog
          title="Restart game?"
          message={`The current game will be lost and a fresh game starts with the same settings (${tcLabel(tc)}).`}
          confirmLabel="Restart"
          danger
          onConfirm={() => startGame(tc)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

function ToolButton({ label, onClick, disabled, accent, children }: { label: string; onClick: () => void; disabled?: boolean; accent?: boolean; children: React.ReactNode }) {
  return (
    <button className={`tool${accent ? ' accent' : ''}`} onClick={onClick} disabled={disabled} aria-label={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}
