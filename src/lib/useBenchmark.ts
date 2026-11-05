"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { debugLog } from "./debug";
import { openingForGame } from "./openings";
import { clampCpLoss, moveAccuracy } from "./metrics";
import { costOf, DEFAULT_PRICES } from "./pricing";
import { scoreToCp, StockfishEngine, type Evaluation } from "./stockfish";
import type {
  AiMoveResponse,
  BoardState,
  Color,
  GameOutcome,
  GameResult,
  ModelId,
  MoveRecord,
  Settings,
  SeriesPhase,
  TurnState,
} from "./types";

/** 150 full moves - the draw cut-off on top of chess.js' own draw rules. */
export const MAX_FULL_MOVES = 150;
const MAX_PLIES = MAX_FULL_MOVES * 2;
const ANALYSER_SKILL = 20;

export const SKILL_LEVELS = [
  { label: "Beginner", value: 1 },
  { label: "Casual", value: 5 },
  { label: "Club", value: 10 },
  { label: "Strong", value: 15 },
  { label: "Max", value: 20 },
];

export const DEFAULT_SETTINGS: Settings = {
  skillLevel: 5,
  gameCount: 1,
  sameOpenings: true,
  moveDelayMs: 300,
  movetimeMs: 100,
  analysisDepth: 14,
  prices: DEFAULT_PRICES,
};

const MODELS: ModelId[] = ["jev", "fable"];

class AbortRun extends Error {
  constructor() {
    super("run aborted");
  }
}

export interface BoardStatus {
  ready: boolean;
  model: string;
  provider?: string;
  message: string | null;
}

function emptyBoard(model: ModelId): BoardState {
  return {
    model,
    fen: new Chess().fen(),
    aiColor: "w",
    phase: "idle",
    gameNumber: 0,
    opening: "-",
    moves: [],
    pgn: "",
    evalCp: 0,
    evalMate: null,
    lastMoveSan: null,
    lastMoveTimeMs: null,
    costUsd: 0,
    banner: null,
    errorMessage: null,
    warning: null,
    modelVersion: null,
    games: [],
  };
}

function initialBoards(): Record<ModelId, BoardState> {
  return { jev: emptyBoard("jev"), fable: emptyBoard("fable") };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function gameEnding(
  chess: Chess,
  aiColor: Color,
): { outcome: GameOutcome; reason: string } | null {
  if (chess.isCheckmate()) {
    const winner: Color = chess.turn() === "w" ? "b" : "w";
    return {
      outcome: winner === aiColor ? "win" : "loss",
      reason: winner === aiColor ? "Checkmate delivered" : "Checkmated",
    };
  }
  if (chess.isStalemate()) return { outcome: "draw", reason: "Stalemate" };
  if (chess.isThreefoldRepetition())
    return { outcome: "draw", reason: "Threefold repetition" };
  if (chess.isInsufficientMaterial())
    return { outcome: "draw", reason: "Insufficient material" };
  if (chess.isDrawByFiftyMoves())
    return { outcome: "draw", reason: "50-move rule" };
  if (chess.isDraw()) return { outcome: "draw", reason: "Draw" };
  if (chess.history().length >= MAX_PLIES)
    return { outcome: "draw", reason: `${MAX_FULL_MOVES}-move limit` };
  return null;
}

function whitePovCp(cpForSideToMove: number, sideToMove: Color): number {
  return sideToMove === "w" ? cpForSideToMove : -cpForSideToMove;
}

function evalToBoardValues(
  evaluation: Evaluation,
  sideToMove: Color,
): { evalCp: number; evalMate: number | null } {
  const cp = whitePovCp(scoreToCp(evaluation), sideToMove);
  const mate =
    evaluation.mate === null
      ? null
      : sideToMove === "w"
        ? evaluation.mate
        : -evaluation.mate;
  return { evalCp: cp, evalMate: mate };
}

class ApiKeyMissing extends Error {}

/** Attempts per turn on top of the retries the API route already makes. */
const TURN_ATTEMPTS = 3;
const TURN_BACKOFF_MS = [3000, 8000];

async function callModel(
  model: ModelId,
  turn: TurnState,
): Promise<AiMoveResponse> {
  debugLog(`api:${model}`, "request", turn);
  const response = await fetch(`/api/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(turn),
    // Server-side each call is capped at 30s; Fable may make up to 3.
    signal: AbortSignal.timeout(125_000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.message ?? `Request failed (${response.status})`;
    debugLog(`api:${model}`, "error", message);
    if (body?.code === "missing_api_key") throw new ApiKeyMissing(message);
    throw new Error(message);
  }

  const data = (await response.json()) as AiMoveResponse;
  debugLog(`api:${model}`, "response", data);
  return data;
}

export function useBenchmark() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [boards, setBoards] = useState<Record<ModelId, BoardState>>(
    initialBoards,
  );
  const [phase, setPhase] = useState<SeriesPhase>("idle");
  const [status, setStatus] = useState<Record<ModelId, BoardStatus> | null>(
    null,
  );

  // The run loops read settings through a ref so a long series is not torn
  // down when a slider moves.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const runIdRef = useRef(0);

  const patchBoard = useCallback(
    (model: ModelId, patch: Partial<BoardState>) => {
      setBoards((previous) => ({
        ...previous,
        [model]: { ...previous[model], ...patch },
      }));
    },
    [],
  );

  // Which boards can run at all - a missing key blocks one board only.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((response) => response.json())
      .then((data: Record<ModelId, BoardStatus>) => {
        if (cancelled) return;
        debugLog("status", data);
        setStatus(data);
        for (const model of MODELS) {
          if (!data[model]?.ready) {
            patchBoard(model, {
              phase: "blocked",
              errorMessage: data[model]?.message ?? "API key missing.",
            });
          } else {
            patchBoard(model, { modelVersion: data[model].model });
          }
        }
      })
      .catch((error) => debugLog("status", "failed", error));
    return () => {
      cancelled = true;
    };
  }, [patchBoard]);

  const checkpoint = useCallback(async (runId: number) => {
    while (pausedRef.current && !abortRef.current) {
      await delay(120);
    }
    if (abortRef.current || runIdRef.current !== runId) throw new AbortRun();
  }, []);

  const runBoard = useCallback(
    async (model: ModelId, runId: number) => {
      const config = settingsRef.current;
      const opponent = new StockfishEngine(`${model}:opponent`);
      const analyser = new StockfishEngine(`${model}:analyser`);

      try {
        await opponent.init();
        await analyser.init();
        await opponent.configure(config.skillLevel);
        await analyser.configure(ANALYSER_SKILL);

        for (
          let gameNumber = 1;
          gameNumber <= config.gameCount;
          gameNumber += 1
        ) {
          await checkpoint(runId);
          await opponent.newGame();
          await analyser.newGame();

          const chess = new Chess();
          // Colours alternate: White in odd games, Black in even games.
          const aiColor: Color = gameNumber % 2 === 1 ? "w" : "b";
          let opening = "Standard start";

          if (config.sameOpenings) {
            const book = openingForGame(gameNumber);
            for (const san of book.moves) chess.move(san);
            opening = book.name;
          }

          chess.setHeader("Event", "AI Chess Benchmark: Jev vs Fable");
          chess.setHeader("Round", String(gameNumber));
          chess.setHeader("Site", "localhost");
          chess.setHeader(
            "White",
            aiColor === "w" ? model : `Stockfish (Skill ${config.skillLevel})`,
          );
          chess.setHeader(
            "Black",
            aiColor === "b" ? model : `Stockfish (Skill ${config.skillLevel})`,
          );
          if (config.sameOpenings) chess.setHeader("Opening", opening);

          const bookMoves: MoveRecord[] = chess
            .history({ verbose: true })
            .map((move, index) => ({
              ply: index + 1,
              san: move.san,
              uci: move.lan,
              byAi: false,
            }));

          let moves: MoveRecord[] = bookMoves;
          let gameCost = 0;

          patchBoard(model, {
            gameNumber,
            aiColor,
            opening,
            fen: chess.fen(),
            moves,
            pgn: chess.pgn(),
            banner: null,
            phase: "thinking",
            lastMoveSan: moves.at(-1)?.san ?? null,
            lastMoveTimeMs: null,
            evalCp: 0,
            evalMate: null,
          });

          let ending = gameEnding(chess, aiColor);
          let forfeitReason: string | null = null;

          while (!ending) {
            await checkpoint(runId);
            const sideToMove = chess.turn() as Color;

            if (sideToMove === aiColor) {
              const legalMoves = chess
                .moves({ verbose: true })
                .map((move) => ({ uci: move.lan, san: move.san }));

              const fenBefore = chess.fen();
              const evalBefore = await analyser.analyse(
                fenBefore,
                config.analysisDepth,
              );
              const cpBefore = scoreToCp(evalBefore);
              patchBoard(model, {
                phase: "thinking",
                ...evalToBoardValues(evalBefore, sideToMove),
              });

              const turn: TurnState = {
                fen: fenBefore,
                sideToMove: sideToMove === "w" ? "white" : "black",
                recentMoves: chess.history().slice(-10),
                legalMoves,
              };

              let result: AiMoveResponse | null = null;
              let lastFailure = "";
              // Timed per attempt, so waiting out an outage never counts
              // against the model's response time.
              let elapsedMs = 0;

              // A provider outage is not the model's fault: keep trying the
              // same turn for a while before giving up on the series.
              for (let attempt = 1; attempt <= TURN_ATTEMPTS; attempt += 1) {
                try {
                  const startedAt = performance.now();
                  result = await callModel(model, turn);
                  elapsedMs = Math.round(performance.now() - startedAt);
                  patchBoard(model, { warning: null });
                  break;
                } catch (error) {
                  if (error instanceof ApiKeyMissing) throw error;
                  lastFailure = (error as Error).message;
                  if (attempt === TURN_ATTEMPTS) throw error;
                  const wait = TURN_BACKOFF_MS[attempt - 1];
                  patchBoard(model, {
                    warning: `${lastFailure.replace(/^Jev is not responding[^:]*: /, "Upstream: ")} Retrying this move in ${Math.round(wait / 1000)}s (attempt ${attempt + 1} of ${TURN_ATTEMPTS}).`,
                  });
                  await delay(wait);
                  await checkpoint(runId);
                }
              }
              if (!result) throw new Error(lastFailure || "No response");

              if (result.forfeit || !result.uci) {
                forfeitReason =
                  result.error ?? "No legal move returned after retries.";
                ending = { outcome: "forfeit", reason: forfeitReason };
                break;
              }

              let played;
              try {
                played = chess.move({
                  from: result.uci.slice(0, 2),
                  to: result.uci.slice(2, 4),
                  promotion: result.uci.slice(4) || undefined,
                });
              } catch {
                forfeitReason = `chess.js rejected "${result.uci}".`;
                ending = { outcome: "forfeit", reason: forfeitReason };
                break;
              }

              await checkpoint(runId);

              // Centipawn loss: best available before the move, versus what the
              // position is actually worth to the mover afterwards.
              let cpAfterForMover: number;
              let boardEval: { evalCp: number; evalMate: number | null };
              if (chess.isGameOver()) {
                cpAfterForMover = chess.isCheckmate() ? 10000 : 0;
                boardEval = {
                  evalCp: whitePovCp(cpAfterForMover, sideToMove),
                  evalMate: chess.isCheckmate() ? (sideToMove === "w" ? 1 : -1) : null,
                };
              } else {
                const evalAfter = await analyser.analyse(
                  chess.fen(),
                  config.analysisDepth,
                );
                cpAfterForMover = -scoreToCp(evalAfter);
                boardEval = evalToBoardValues(
                  evalAfter,
                  chess.turn() as Color,
                );
              }

              const usage = result.usage ?? { inputTokens: 0, outputTokens: 0 };
              const moveCost = costOf(usage, config.prices[model]);
              gameCost += moveCost;

              const record: MoveRecord = {
                ply: chess.history().length,
                san: played.san,
                uci: played.lan,
                byAi: true,
                timeMs: elapsedMs,
                cpLoss: clampCpLoss(cpBefore - cpAfterForMover),
                accuracy: moveAccuracy(cpBefore, cpAfterForMover),
                evalAfterCp: boardEval.evalCp,
                costUsd: moveCost,
                usage,
                confidence: result.confidence,
                topMoves: result.topMoves,
                retries: result.retries,
                illegalAttempts: result.illegalAttempts,
              };

              moves = [...moves, record];
              patchBoard(model, {
                fen: chess.fen(),
                moves,
                pgn: chess.pgn(),
                lastMoveSan: played.san,
                lastMoveTimeMs: elapsedMs,
                modelVersion: result.modelVersion,
                costUsd: gameCost,
                phase: "opponent",
                ...boardEval,
              });
            } else {
              patchBoard(model, { phase: "opponent" });
              const best = await opponent.bestMove(
                chess.fen(),
                config.movetimeMs,
              );
              if (!best) {
                ending = gameEnding(chess, aiColor) ?? {
                  outcome: "draw",
                  reason: "Opponent had no move",
                };
                break;
              }
              const played = chess.move({
                from: best.slice(0, 2),
                to: best.slice(2, 4),
                promotion: best.slice(4) || undefined,
              });
              moves = [
                ...moves,
                {
                  ply: chess.history().length,
                  san: played.san,
                  uci: played.lan,
                  byAi: false,
                },
              ];
              patchBoard(model, {
                fen: chess.fen(),
                moves,
                pgn: chess.pgn(),
                lastMoveSan: played.san,
              });
            }

            ending = gameEnding(chess, aiColor);
            if (!ending && config.moveDelayMs > 0) {
              await delay(config.moveDelayMs);
            }
          }

          const resultTag =
            ending.outcome === "draw"
              ? "1/2-1/2"
              : (ending.outcome === "win") === (aiColor === "w")
                ? "1-0"
                : "0-1";
          chess.setHeader("Result", resultTag);
          chess.setHeader(
            "Termination",
            ending.outcome === "forfeit" ? "Forfeit" : ending.reason,
          );

          const gameResult: GameResult = {
            gameNumber,
            model,
            aiColor,
            opening,
            outcome: ending.outcome,
            reason: ending.reason,
            pgn: chess.pgn(),
            moves,
            costUsd: gameCost,
            aiMoveCount: moves.filter((move) => move.byAi).length,
          };

          debugLog(`game:${model}`, `game ${gameNumber} ended`, gameResult);

          setBoards((previous) => ({
            ...previous,
            [model]: {
              ...previous[model],
              phase: "finished",
              banner: { outcome: ending!.outcome, reason: ending!.reason },
              pgn: gameResult.pgn,
              moves,
              costUsd: gameCost,
              games: [...previous[model].games, gameResult],
            },
          }));

          if (gameNumber < config.gameCount) await delay(1200);
        }

        patchBoard(model, { phase: "finished" });
      } catch (error) {
        if (error instanceof AbortRun) {
          debugLog(`game:${model}`, "aborted");
          return;
        }
        const blocked = error instanceof ApiKeyMissing;
        debugLog(`game:${model}`, "error", error);
        patchBoard(model, {
          phase: blocked ? "blocked" : "error",
          errorMessage: (error as Error).message,
          warning: null,
        });
      } finally {
        opponent.terminate();
        analyser.terminate();
      }
    },
    [checkpoint, patchBoard],
  );

  const start = useCallback(() => {
    abortRef.current = false;
    pausedRef.current = false;
    runIdRef.current += 1;
    const runId = runIdRef.current;

    setBoards(() => {
      const fresh = initialBoards();
      for (const model of MODELS) {
        if (status && !status[model]?.ready) {
          fresh[model].phase = "blocked";
          fresh[model].errorMessage = status[model]?.message ?? null;
        } else if (status) {
          fresh[model].modelVersion = status[model].model;
        }
      }
      return fresh;
    });
    setPhase("running");

    const runnable = MODELS.filter((model) => !status || status[model]?.ready);
    Promise.all(runnable.map((model) => runBoard(model, runId))).finally(() => {
      if (runIdRef.current === runId && !abortRef.current) {
        setPhase("finished");
      }
    });
  }, [runBoard, status]);

  const pause = useCallback(() => {
    if (phase !== "running") return;
    pausedRef.current = true;
    setPhase("paused");
  }, [phase]);

  const resume = useCallback(() => {
    if (phase !== "paused") return;
    pausedRef.current = false;
    setPhase("running");
  }, [phase]);

  const reset = useCallback(() => {
    abortRef.current = true;
    pausedRef.current = false;
    runIdRef.current += 1;
    setPhase("idle");
    setBoards(() => {
      const fresh = initialBoards();
      for (const model of MODELS) {
        if (status && !status[model]?.ready) {
          fresh[model].phase = "blocked";
          fresh[model].errorMessage = status[model]?.message ?? null;
        }
      }
      return fresh;
    });
  }, [status]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return {
    settings,
    setSettings,
    boards,
    phase,
    status,
    start,
    pause,
    resume,
    reset,
  };
}
