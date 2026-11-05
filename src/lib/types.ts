export type ModelId = "jev" | "fable";

export const MODEL_LABEL: Record<ModelId, string> = {
  jev: "Jev (TypeSafe AI)",
  fable: "Fable (Anthropic)",
};

export type Color = "w" | "b";

/** One legal move offered to a model, in both notations. */
export interface LegalMove {
  uci: string;
  san: string;
}

/** What every model receives each turn - identical shape for both players. */
export interface TurnState {
  fen: string;
  sideToMove: "white" | "black";
  /** Last 10 plies in SAN, oldest first. */
  recentMoves: string[];
  legalMoves: LegalMove[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Normalised result of one AI turn, returned by both API routes. */
export interface AiMoveResponse {
  /** Chosen move in UCI. Null when the model forfeited. */
  uci: string | null;
  /** Model version string read back from the provider response. */
  modelVersion: string;
  usage: TokenUsage;
  /** Moves the model proposed that chess.js rejected. */
  illegalAttempts: number;
  /** Extra API calls made after the first one. */
  retries: number;
  forfeit: boolean;
  /** Jev only. */
  confidence?: number;
  /** Jev only - top 3 options by probability. */
  topMoves?: { uci: string; san: string; probability: number }[];
  error?: string;
}

export interface ApiErrorBody {
  error: string;
  code: "missing_api_key" | "upstream_error" | "timeout" | "bad_request";
  message: string;
}

/** A single ply played in a game. */
export interface MoveRecord {
  ply: number;
  san: string;
  uci: string;
  /** True when the AI under test played it, false for the Stockfish opponent. */
  byAi: boolean;
  timeMs?: number;
  /** Centipawn loss versus Stockfish's preferred move, AI moves only. */
  cpLoss?: number;
  /** Lichess-style accuracy for this move, 0-100. */
  accuracy?: number;
  /** Eval after the move, in centipawns from White's point of view. */
  evalAfterCp?: number;
  costUsd?: number;
  usage?: TokenUsage;
  confidence?: number;
  topMoves?: { uci: string; san: string; probability: number }[];
  retries?: number;
  illegalAttempts?: number;
}

export type GameOutcome = "win" | "loss" | "draw" | "forfeit";

export interface GameResult {
  gameNumber: number;
  model: ModelId;
  aiColor: Color;
  opening: string;
  outcome: GameOutcome;
  reason: string;
  pgn: string;
  moves: MoveRecord[];
  costUsd: number;
  aiMoveCount: number;
}

export type BoardPhase =
  | "idle"
  | "thinking"
  | "opponent"
  | "waiting"
  | "finished"
  | "error"
  | "blocked";

export interface BoardState {
  model: ModelId;
  fen: string;
  aiColor: Color;
  phase: BoardPhase;
  gameNumber: number;
  opening: string;
  moves: MoveRecord[];
  pgn: string;
  /** Eval in centipawns from White's point of view; null until first analysis. */
  evalCp: number | null;
  /** Mate distance from White's point of view, when a forced mate is seen. */
  evalMate: number | null;
  lastMoveSan: string | null;
  lastMoveTimeMs: number | null;
  costUsd: number;
  banner: { outcome: GameOutcome; reason: string } | null;
  /** Setup / fatal error message shown in place of the player card. */
  errorMessage: string | null;
  /** Transient upstream trouble the board is still retrying through. */
  warning: string | null;
  modelVersion: string | null;
  games: GameResult[];
}

export interface Settings {
  skillLevel: number;
  gameCount: number;
  sameOpenings: boolean;
  moveDelayMs: number;
  movetimeMs: number;
  analysisDepth: number;
  prices: Record<ModelId, { inputPerMTok: number; outputPerMTok: number }>;
}

export type SeriesPhase = "idle" | "running" | "paused" | "finished";
