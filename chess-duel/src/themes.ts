export type BoardThemeId = 'tangerine' | 'mint' | 'walnut' | 'marble' | 'emerald' | 'ocean';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  light: string;
  dark: string;
  /** chunky board rim and its darker "3D" underside */
  rim: string;
  rimEdge: string;
  /** optional texture overlay (CSS background) */
  texture: string;
  coordLight: string;
  coordDark: string;
}

const wood =
  'repeating-linear-gradient(92deg, rgba(255,255,255,0.035) 0 2px, rgba(0,0,0,0.04) 2px 3px, transparent 3px 7px), repeating-linear-gradient(88deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 11px)';
const none = 'linear-gradient(transparent, transparent)';

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'tangerine', name: 'Tangerine', light: '#fff1dc', dark: '#ffb46b', rim: '#f0913a', rimEdge: '#c96a17', texture: none, coordLight: '#e08a3a', coordDark: '#fff1dc' },
  { id: 'mint', name: 'Mint', light: '#e9fbf6', dark: '#5fcfc0', rim: '#25b3a3', rimEdge: '#16877a', texture: none, coordLight: '#25b3a3', coordDark: '#e9fbf6' },
  { id: 'walnut', name: 'Walnut', light: '#ecd3a7', dark: '#a8703f', rim: '#7a4a22', rimEdge: '#4e2c10', texture: wood, coordLight: '#a8703f', coordDark: '#f3dfbb' },
  { id: 'marble', name: 'Marble', light: '#eeedf3', dark: '#a39fb8', rim: '#7d7896', rimEdge: '#57526f', texture: 'radial-gradient(120% 60% at 20% 10%, rgba(255,255,255,0.2), transparent 60%)', coordLight: '#8f8aa8', coordDark: '#f2f1f6' },
  { id: 'emerald', name: 'Club', light: '#eeeed2', dark: '#769656', rim: '#5a7a3c', rimEdge: '#3e5726', texture: none, coordLight: '#769656', coordDark: '#eeeed2' },
  { id: 'ocean', name: 'Ocean', light: '#e3f1fb', dark: '#5fa3d6', rim: '#3a7fb5', rimEdge: '#255a85', texture: none, coordLight: '#3a7fb5', coordDark: '#e3f1fb' },
];

export const themeById = (id: string) => BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
