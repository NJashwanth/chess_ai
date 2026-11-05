"use client";

import { debugLog } from "./debug";

const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";

export interface Evaluation {
  /** Centipawns from the side-to-move's point of view. Null when mate is seen. */
  cp: number | null;
  /** Moves to mate from the side-to-move's point of view. */
  mate: number | null;
}

/** Signed score used for arithmetic; mate is clamped to a large centipawn value. */
export function scoreToCp(evaluation: Evaluation): number {
  if (evaluation.mate !== null) {
    return evaluation.mate > 0 ? 10000 : -10000;
  }
  return evaluation.cp ?? 0;
}

/**
 * One Stockfish WASM instance in its own Web Worker, driven over UCI.
 * Each board owns two: a skill-limited opponent and a full-strength analyser.
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private listeners = new Set<(line: string) => void>();
  private terminated = false;

  constructor(private readonly label: string) {}

  async init(): Promise<void> {
    if (this.worker) return;
    const worker = new Worker(ENGINE_URL);
    this.worker = worker;
    worker.onmessage = (event: MessageEvent) => {
      const line =
        typeof event.data === "string"
          ? event.data
          : typeof event.data?.data === "string"
            ? event.data.data
            : String(event.data);
      for (const listener of [...this.listeners]) listener(line);
    };
    worker.onerror = (event) => {
      debugLog(`stockfish:${this.label}`, "worker error", event.message);
    };

    const uciok = this.waitFor((line) => line.startsWith("uciok"));
    this.send("uci");
    await uciok;
    this.send("setoption name Threads value 1");
    this.send("setoption name Hash value 16");
    await this.isReady();
    debugLog(`stockfish:${this.label}`, "ready");
  }

  private send(command: string) {
    if (!this.worker || this.terminated) return;
    this.worker.postMessage(command);
  }

  private waitFor(
    predicate: (line: string) => boolean,
    onLine?: (line: string) => void,
    timeoutMs = 60_000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(`Stockfish (${this.label}) timed out`));
      }, timeoutMs);
      const listener = (line: string) => {
        onLine?.(line);
        if (predicate(line)) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          resolve(line);
        }
      };
      this.listeners.add(listener);
    });
  }

  private async isReady(): Promise<void> {
    // The listener is registered before the command is sent, so a fast reply
    // cannot arrive before anything is listening.
    const readyok = this.waitFor((line) => line.startsWith("readyok"));
    this.send("isready");
    await readyok;
  }

  /** Both opponents use identical settings so the two matches stay comparable. */
  async configure(skillLevel: number): Promise<void> {
    this.send(`setoption name Skill Level value ${skillLevel}`);
    this.send("ucinewgame");
    await this.isReady();
  }

  async newGame(): Promise<void> {
    this.send("ucinewgame");
    await this.isReady();
  }

  /** Plays a move with a fixed movetime, so strength stays consistent. */
  async bestMove(fen: string, movetimeMs: number): Promise<string | null> {
    await this.isReady();
    const done = this.waitFor((l) => l.startsWith("bestmove"));
    this.send(`position fen ${fen}`);
    this.send(`go movetime ${movetimeMs}`);
    const line = await done;
    const move = line.split(/\s+/)[1];
    return !move || move === "(none)" ? null : move;
  }

  /** Fixed-depth analysis used for centipawn loss and the eval bar. */
  async analyse(fen: string, depth: number): Promise<Evaluation> {
    await this.isReady();
    let cp: number | null = null;
    let mate: number | null = null;
    const done = this.waitFor(
      (line) => line.startsWith("bestmove"),
      (line) => {
        if (!line.startsWith("info") || !line.includes(" score ")) return;
        if (line.includes(" upperbound") || line.includes(" lowerbound")) return;
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (mateMatch) {
          mate = Number(mateMatch[1]);
          cp = null;
        } else if (cpMatch) {
          cp = Number(cpMatch[1]);
          mate = null;
        }
      },
    );
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    await done;
    // A terminal position replies "bestmove (none)" with no score line, so cp
    // and mate stay null and the caller treats it as an even/finished position.
    return { cp, mate };
  }

  terminate() {
    this.terminated = true;
    this.listeners.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}
