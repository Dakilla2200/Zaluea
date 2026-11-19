# Chess Duel — face-to-face chess for two players on one phone

A mobile-first PWA (React + TypeScript + Vite) for two people sitting opposite each other with one phone between them.
White plays from the bottom; Black's pieces, player panel, promotion picker and result screen are rotated 180° toward the top player.

## Features
- Full rules via [chess.js](https://github.com/jhlywa/chess.js): check, checkmate, castling, en passant, promotion (picker), stalemate,
  insufficient material, threefold repetition, 50-move rule. Timeouts vs. a lone king/minor piece are scored as draws (FIDE 6.9).
- Tap to select → legal moves shown → tap to move. Pieces slide (also on undo); captured pieces fade out.
- Last-move highlight, pulsing check highlight, captured pieces + material advantage per player.
- Chess clock: no timer, 1 / 3 / 5 / 10 / 15 min, optional +2/+5/+10s increment, pause/resume, low-time warning, auto-pause when the app is backgrounded.
- Undo, Restart (confirmation), New match, resign (inline confirmation) and draw offer/accept per player.
- Victory/defeat/draw screen split for both players; move history in SAN with Copy/Share PGN.
- Settings: 5 board themes, 3 piece styles, sound, vibration, legal-move hints, coordinates, face-to-face mode, player names.
- Synthesized sound effects (Web Audio — no files), game + settings persist across reloads.
- Installable PWA, fully offline after first load. Zoom/scroll gestures are blocked during play.

## Develop
```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
npm test           # rules/piece-tracking unit tests
npm run build      # production build + service worker in dist/
npm run preview
```
Deploy `dist/` to any static host (Vercel, Netlify, GitHub Pages). Open on the phone and use "Add to Home Screen" to install.

## Credits
Piece artwork based on "cburnett" by Colin M.L. Burnett (CC BY-SA 3.0), recoloured for the Royal and Midnight sets.
