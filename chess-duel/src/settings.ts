import type { Color, GameResult, MoveInput } from './game';
import type { PieceStyleId } from './pieces';
import type { BoardThemeId } from './themes';

/**
 * follow: every piece turns to face the player whose turn it is (players sit opposite each other)
 * fixed:  each side's pieces always face their owner
 * pass:   the whole board spins so the side to move is at the bottom (players pass the phone)
 */
export type Orientation = 'follow' | 'fixed' | 'pass';

export interface Settings {
  theme: BoardThemeId;
  pieces: PieceStyleId;
  sound: boolean;
  fxVolume: number;
  music: boolean;
  musicVolume: number;
  haptics: boolean;
  showLegal: boolean;
  showCoords: boolean;
  orientation: Orientation;
  mascot: boolean;
  names: Record<Color, string>;
}

export interface TimeControl {
  /** null = untimed */
  minutes: number | null;
  increment: number;
}

export interface SavedGame {
  moves: MoveInput[];
  tc: TimeControl;
  clocks: Record<Color, number>;
  result: GameResult | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'tangerine',
  pieces: 'playful',
  sound: true,
  fxVolume: 0.8,
  music: true,
  musicVolume: 0.4,
  haptics: true,
  showLegal: true,
  showCoords: true,
  orientation: 'follow',
  mascot: true,
  names: { w: 'White', b: 'Black' },
};

const SETTINGS_KEY = 'chessduel.settings.v2';
const GAME_KEY = 'chessduel.game.v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — the game still works, it just won't persist */
  }
}

export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...s, names: { ...DEFAULT_SETTINGS.names, ...(s?.names ?? {}) } };
}
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

export function loadGame(): SavedGame | null {
  const g = read<SavedGame>(GAME_KEY);
  if (!g || !Array.isArray(g.moves) || !g.tc || !g.clocks) return null;
  return g;
}
export const saveGame = (g: SavedGame) => write(GAME_KEY, g);

export const initialClocks = (tc: TimeControl): Record<Color, number> => {
  const ms = (tc.minutes ?? 0) * 60_000;
  return { w: ms, b: ms };
};

export const tcLabel = (tc: TimeControl) => (tc.minutes === null ? 'No timer' : `${tc.minutes} min${tc.increment ? ` + ${tc.increment}s` : ''}`);
