// Renders the app icons (PNG) from the king artwork using the preinstalled Playwright Chromium.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW_PATH || 'playwright');
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/pieceArt.ts', import.meta.url), 'utf8');
const art = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const knight = art.wn.replace('width="45" height="45"', 'viewBox="0 0 45 45"')
  .replace(/fill="#fff"/g, 'fill="url(#g)"').replace(/stroke="#000"/g, 'stroke="#3d2914"').replace(/fill="#000"/g, 'fill="#3d2914"')
  .replace(/(<svg[^>]*>)/, '$1<defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#e2c48c"/></linearGradient></defs>');
const page = (size, pad) => `<html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:
radial-gradient(70% 60% at 50% 30%, rgba(220,179,106,.35), transparent 70%),
conic-gradient(from 45deg at 50% 50%, #241c1f, #120e10, #241c1f, #120e10, #241c1f);">
<div style="width:${size * (1 - pad)}px;height:${size * (1 - pad)}px;filter:drop-shadow(0 ${size / 40}px ${size / 30}px rgba(0,0,0,.6))">${knight}</div></div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0.3], ['icon-512.png', 512, 0.3], ['icon-maskable-512.png', 512, 0.45], ['apple-touch-icon.png', 180, 0.3]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(page(size, pad));
  await p.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: false });
}
await b.close();
console.log('icons done');
