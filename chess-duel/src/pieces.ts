import { CBURNETT } from './pieceArt';
import type { Color, PieceSymbol } from './game';

export type PieceStyleId = 'playful' | 'classic' | 'royal' | 'midnight';

interface Palette {
  /** body fill for white pieces (solid or gradient stops) */
  wFill: [string, string];
  wStroke: string;
  /** body fill for black pieces */
  bFill: [string, string];
  bStroke: string;
  /** inner detail lines on black pieces */
  bDetail: string;
}

export const PIECE_STYLES: Array<{ id: PieceStyleId; name: string; palette: Palette | null }> = [
  {
    id: 'playful',
    name: 'Playful',
    palette: {
      wFill: ['#ffffff', '#ffe3bd'],
      wStroke: '#3b3355',
      bFill: ['#6c5ca8', '#2c2448'],
      bStroke: '#231c3a',
      bDetail: '#ffd166',
    },
  },
  { id: 'classic', name: 'Classic', palette: null },
  {
    id: 'royal',
    name: 'Royal',
    palette: {
      wFill: ['#fffdf6', '#e9d6ae'],
      wStroke: '#3d2914',
      bFill: ['#4a3a2c', '#120c08'],
      bStroke: '#0b0705',
      bDetail: '#e2b857',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    palette: {
      wFill: ['#ffffff', '#d6e0ee'],
      wStroke: '#1d2a3c',
      bFill: ['#3b4f74', '#0f1626'],
      bStroke: '#070b14',
      bDetail: '#c9d6ea',
    },
  },
];

function restyle(svg: string, color: Color, p: Palette): string {
  const defs = (stops: [string, string]) =>
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient></defs>`;
  let out: string;
  if (color === 'w') {
    out = svg
      .replace(/fill="#fff"/g, 'fill="url(#g)"')
      .replace(/fill="#000"/g, `fill="${p.wStroke}"`)
      .replace(/stroke="#000"/g, `stroke="${p.wStroke}"`);
    out = out.replace(/(<svg[^>]*>)/, `$1${defs(p.wFill)}`);
  } else {
    out = svg
      .replace(/fill="#000"/g, 'fill="url(#g)"')
      .replace(/stroke="#000"/g, `stroke="${p.bStroke}"`)
      .replace(/#ececec/g, p.bDetail);
    out = out.replace(/(<svg[^>]*>)/, `$1${defs(p.bFill)}`);
  }
  return out;
}

const toUri = (svg: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('width="45" height="45"', 'viewBox="0 0 45 45"'))}")`;

const cache = new Map<string, string>();

/** CSS `url(...)` for a piece image in the given style. */
export function pieceImage(style: PieceStyleId, color: Color, type: PieceSymbol): string {
  const key = style + color + type;
  let v = cache.get(key);
  if (!v) {
    const base = CBURNETT[color + type];
    const pal = PIECE_STYLES.find((s) => s.id === style)?.palette;
    v = toUri(pal ? restyle(base, color, pal) : base);
    cache.set(key, v);
  }
  return v;
}
