/**
 * Stockfish 10 (GPL-3.0, https://github.com/nmrugg/stockfish.js) running in a Web Worker.
 * The asm.js build is bundled as text and started from a Blob URL, so it works offline,
 * in the PWA and in the single-file build alike. Loaded lazily — only when a review opens.
 */
export interface EngineEval {
  /** centipawns from White's point of view (undefined when a mate score is given) */
  cp?: number;
  /** mate in N from White's point of view (positive = White mates) */
  mate?: number;
  /** best move in UCI notation, e.g. "e2e4" */
  best: string | null;
}

export class Engine {
  private worker: Worker;
  private url: string;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(src: string) {
    this.url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    this.worker = new Worker(this.url);
    this.worker.postMessage('uci');
    this.worker.postMessage('setoption name Hash value 16');
    this.worker.postMessage('ucinewgame');
  }

  static async create(): Promise<Engine> {
    const mod = await import('stockfish/src/stockfish.asm.js?raw');
    return new Engine(mod.default);
  }

  /**
   * Evaluates a position. Calls are serialized.
   * With `searchmoves`, only that move is searched — its score is directly comparable with the
   * unrestricted search of the same position (same side to move, same depth).
   */
  analyse(fen: string, movetime = 600, depth = 13, searchmoves?: string): Promise<EngineEval> {
    const run = () =>
      new Promise<EngineEval>((resolve, reject) => {
        const whiteToMove = fen.split(' ')[1] === 'w';
        let cp: number | undefined;
        let mate: number | undefined;
        const timeout = window.setTimeout(() => {
          this.worker.removeEventListener('message', onMsg);
          reject(new Error('engine timeout'));
        }, movetime + 8000);
        const onMsg = (e: MessageEvent) => {
          const line = String(e.data);
          if (line.startsWith('info') && line.includes(' score ') && !line.includes('lowerbound') && !line.includes('upperbound')) {
            const m = line.match(/score (cp|mate) (-?\d+)/);
            if (m) {
              const v = Number(m[2]) * (whiteToMove ? 1 : -1);
              if (m[1] === 'cp') {
                cp = v;
                mate = undefined;
              } else {
                mate = v;
                cp = undefined;
              }
            }
          } else if (line.startsWith('bestmove')) {
            window.clearTimeout(timeout);
            this.worker.removeEventListener('message', onMsg);
            const best = line.split(' ')[1];
            resolve({ cp, mate, best: best && best !== '(none)' ? best : null });
          }
        };
        this.worker.addEventListener('message', onMsg);
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${depth} movetime ${movetime}${searchmoves ? ` searchmoves ${searchmoves}` : ''}`);
      });
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  dispose() {
    this.worker.terminate();
    URL.revokeObjectURL(this.url);
  }
}
