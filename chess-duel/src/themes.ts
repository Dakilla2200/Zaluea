export type BoardThemeId = 'walnut' | 'ebony' | 'marble' | 'emerald' | 'ocean';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  light: string;
  dark: string;
  /** Overlay texture applied to the whole board (CSS background). */
  texture: string;
  frame: string;
  coordLight: string;
  coordDark: string;
}

const wood =
  'repeating-linear-gradient(92deg, rgba(255,255,255,0.035) 0 2px, rgba(0,0,0,0.04) 2px 3px, transparent 3px 7px), repeating-linear-gradient(88deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 11px)';

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'walnut',
    name: 'Walnut',
    light: '#ecd3a7',
    dark: '#a8703f',
    texture: wood,
    frame: 'linear-gradient(145deg, #5a3417, #2e1909 55%, #4a2a12)',
    coordLight: '#a8703f',
    coordDark: '#f3dfbb',
  },
  {
    id: 'ebony',
    name: 'Ebony',
    light: '#b9b2a6',
    dark: '#4e4740',
    texture: wood,
    frame: 'linear-gradient(145deg, #2a2622, #0f0d0b 55%, #24201c)',
    coordLight: '#4e4740',
    coordDark: '#c9c2b6',
  },
  {
    id: 'marble',
    name: 'Marble',
    light: '#e8e6e1',
    dark: '#8f8b84',
    texture:
      'radial-gradient(120% 60% at 20% 10%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(80% 50% at 80% 90%, rgba(0,0,0,0.1), transparent 60%), repeating-linear-gradient(35deg, transparent 0 18px, rgba(255,255,255,0.05) 18px 19px, transparent 19px 41px)',
    frame: 'linear-gradient(145deg, #6b6862, #34322f 55%, #57544f)',
    coordLight: '#8f8b84',
    coordDark: '#ecebe7',
  },
  {
    id: 'emerald',
    name: 'Tournament',
    light: '#eeeed2',
    dark: '#769656',
    texture: 'linear-gradient(transparent, transparent)',
    frame: 'linear-gradient(145deg, #3d5229, #1b2612 55%, #33461f)',
    coordLight: '#769656',
    coordDark: '#eeeed2',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: '#dfe6ee',
    dark: '#5d7fa3',
    texture: 'radial-gradient(140% 90% at 50% 0%, rgba(255,255,255,0.12), transparent 70%)',
    frame: 'linear-gradient(145deg, #2c4460, #101c2b 55%, #24384f)',
    coordLight: '#5d7fa3',
    coordDark: '#e6edf4',
  },
];

export const themeById = (id: string) => BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
