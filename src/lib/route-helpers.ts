import { NextResponse } from "next/server";
import { MissingApiKeyError, UpstreamError } from "./errors";
import type { ApiErrorBody, TurnState } from "./types";

export function parseTurn(body: unknown): TurnState {
  const turn = body as Partial<TurnState>;
  if (
    !turn ||
    typeof turn.fen !== "string" ||
    (turn.sideToMove !== "white" && turn.sideToMove !== "black") ||
    !Array.isArray(turn.legalMoves) ||
    turn.legalMoves.length === 0
  ) {
    throw new UpstreamError("Malformed turn state.", 400);
  }
  return {
    fen: turn.fen,
    sideToMove: turn.sideToMove,
    recentMoves: Array.isArray(turn.recentMoves) ? turn.recentMoves : [],
    legalMoves: turn.legalMoves,
  };
}

export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof MissingApiKeyError) {
    return NextResponse.json(
      {
        error: error.name,
        code: "missing_api_key" as const,
        message: error.message,
      },
      { status: 503 },
    );
  }
  if (error instanceof UpstreamError) {
    return NextResponse.json(
      {
        error: error.name,
        code: (error.status === 400 ? "bad_request" : "upstream_error") as
          | "bad_request"
          | "upstream_error",
        message: error.message,
      },
      { status: error.status === 400 ? 400 : 502 },
    );
  }
  const message = (error as Error)?.message ?? "Unknown error";
  const timedOut = /timeout|aborted|TimeoutError/i.test(message);
  return NextResponse.json(
    {
      error: "Error",
      code: (timedOut ? "timeout" : "upstream_error") as "timeout" | "upstream_error",
      message,
    },
    { status: timedOut ? 504 : 500 },
  );
}
