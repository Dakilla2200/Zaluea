# Chess Duel — face-to-face chess for two players on one phone

A playful, animation-rich mobile PWA (React + TypeScript + Vite + Framer Motion) for two people sharing one phone.
Meet **Pip the pawn**, the mascot who hops to whichever player he's cheering for and reacts to every capture, check and checkmate.

**Piece direction** (Settings):
- *Follow turn* (default): all pieces flip with a spring wave to face whoever is moving (players sit opposite each other).
- *Face owners*: each side's pieces always face their owner.
- *Pass & play*: the whole board spins so the side to move is at the bottom.

## Features
- Full rules via [chess.js](https://github.com/jhlywa/chess.js): check, checkmate, castling, en passant, promotion (picker), stalemate,
  insufficient material, threefold repetition, 50-move rule. Timeouts vs. a lone king/minor piece are scored as draws (FIDE 6.9).
- Tap to select → legal moves shown → tap to move. Pieces slide (also on undo); captured pieces fade out.
- Last-move highlight, pulsing check highlight, captured pieces + material advantage per player.
- Chess clock: no timer, 1 / 3 / 5 / 10 / 15 min, optional +2/+5/+10s increment, pause/resume, low-time warning, auto-pause when the app is backgrounded.
- Undo, Restart (confirmation), New match, resign (inline confirmation) and draw offer/accept per player.
- Victory/defeat/draw screen split for both players; move history in SAN with Copy/Share PGN.
- **Game review**: a calm, step-by-step look back at the game. Tap Continue to go one move at a time; each move is
  explained in plain English ("Sam's queen took a pawn"), rated in friendly words (Perfect move! … Oops, a slip),
  and slips come with a tip and a green arrow showing the better move. Stockfish rates the moves on the device
  (offline) in the background; if it can't start, the review is a plain replay.
- Settings: 6 board themes, 4 piece styles, piece direction, sound/music with volumes, Pip on/off, vibration, legal-move hints, coordinates, player names.
- Stereo sound effects that pan with the piece's file, plus generative background music (on by default, starts on first tap). Separate volume controls. All synthesized with Web Audio, so nothing to download.
- Spring animations everywhere: sliding/landing pieces, hopping selection, popping legal-move dots, capture sparks and screen shake, check flash, sliding sheets, confetti victory screen.
- Game + settings persist across reloads.
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
Game analysis by [Stockfish 10](https://github.com/nmrugg/stockfish.js) (GPL-3.0). Because the engine is bundled, anyone you distribute the built app to is entitled to its source under the GPL; this repository provides it.

Piece artwork based on "cburnett" by Colin M.L. Burnett (CC BY-SA 3.0), recoloured for the Playful, Royal and Midnight sets.
