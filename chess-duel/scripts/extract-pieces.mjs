import fs from 'node:fs';
const css = fs.readFileSync(process.argv[2], 'utf8');
const re = /piece\.(\w+)\.(white|black)\s*\{\s*background-image:\s*url\('data:image\/svg\+xml;base64,([^']+)'\)/g;
const map = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
const out = {};
let m;
while ((m = re.exec(css))) out[(m[2] === 'white' ? 'w' : 'b') + map[m[1]]] = Buffer.from(m[3], 'base64').toString('utf8');
fs.writeFileSync(process.argv[3], '// Piece artwork: "cburnett" set by Colin M.L. Burnett (CC BY-SA 3.0), via lichess/chessground.\n// Auto-extracted by scripts/extract-pieces.mjs\nexport const CBURNETT: Record<string, string> = ' + JSON.stringify(out, null, 2) + ';\n');
console.log(Object.keys(out));
