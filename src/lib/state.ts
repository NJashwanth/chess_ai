import type { TurnState } from "./types";

/**
 * The exact payload both models see each turn. Built in one place so the two
 * players provably receive the same information in the same format - only the
 * transport differs (a Jev choice question vs. an Anthropic message).
 */
export interface StatePayload {
  fen: string;
  side_to_move: "white" | "black";
  last_moves_san: string[];
  legal_moves: { uci: string; san: string }[];
}

export function buildStatePayload(turn: TurnState): StatePayload {
  return {
    fen: turn.fen,
    side_to_move: turn.sideToMove,
    last_moves_san: turn.recentMoves,
    legal_moves: turn.legalMoves.map((move) => ({
      uci: move.uci,
      san: move.san,
    })),
  };
}
