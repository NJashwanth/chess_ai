import type { GameResult, ModelId, MoveRecord } from "./types";

/** Centipawn loss is capped so one catastrophic move cannot swamp the average. */
export const MAX_CP_LOSS = 1000;

export function clampCpLoss(value: number): number {
  return Math.max(0, Math.min(MAX_CP_LOSS, Math.round(value)));
}

/** Lichess' win-percentage curve: centipawns -> expected score, 0-100. */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Lichess' per-move accuracy from the drop in win percentage. */
export function moveAccuracy(cpBefore: number, cpAfter: number): number {
  const delta = Math.max(0, winPercent(cpBefore) - winPercent(cpAfter));
  const accuracy = 103.1668 * Math.exp(-0.04354 * delta) - 3.1669 + 1;
  return Math.max(0, Math.min(100, accuracy));
}

export type MoveGrade = "blunder" | "mistake" | "inaccuracy" | "ok";

export function gradeMove(cpLoss: number): MoveGrade {
  if (cpLoss > 300) return "blunder";
  if (cpLoss >= 100) return "mistake";
  if (cpLoss >= 50) return "inaccuracy";
  return "ok";
}

export const GRADE_COLOR: Record<MoveGrade, string> = {
  blunder: "text-rose-500",
  mistake: "text-orange-500",
  inaccuracy: "text-amber-500",
  ok: "text-emerald-500",
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface ModelStats {
  model: ModelId;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  forfeits: number;
  winRate: number;
  aiMoves: number;
  avgCpLoss: number;
  accuracy: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  avgResponseMs: number;
  medianResponseMs: number;
  totalCostUsd: number;
  costPerGame: number;
  costPerMove: number;
  /** Infinity when the model has not won a game yet. */
  costPerWin: number;
  illegalAttempts: number;
  retries: number;
  avgConfidence: number | null;
  confidenceOnGood: number | null;
  confidenceOnBlunders: number | null;
}

/**
 * Aggregates finished games plus the moves of the game in progress, so the
 * live comparison table updates while the series runs.
 */
export function computeStats(
  model: ModelId,
  games: GameResult[],
  liveMoves: MoveRecord[],
): ModelStats {
  const aiMoves = [
    ...games.flatMap((game) => game.moves),
    ...liveMoves,
  ].filter((move) => move.byAi);

  const cpLosses = aiMoves
    .map((move) => move.cpLoss)
    .filter((value): value is number => typeof value === "number");
  const accuracies = aiMoves
    .map((move) => move.accuracy)
    .filter((value): value is number => typeof value === "number");
  const times = aiMoves
    .map((move) => move.timeMs)
    .filter((value): value is number => typeof value === "number");
  const confidences = aiMoves
    .map((move) => move.confidence)
    .filter((value): value is number => typeof value === "number");

  const confidenceGood = aiMoves
    .filter((m) => typeof m.confidence === "number" && (m.cpLoss ?? 0) < 50)
    .map((m) => m.confidence as number);
  const confidenceBlunder = aiMoves
    .filter((m) => typeof m.confidence === "number" && (m.cpLoss ?? 0) > 300)
    .map((m) => m.confidence as number);

  const wins = games.filter((g) => g.outcome === "win").length;
  const draws = games.filter((g) => g.outcome === "draw").length;
  const forfeits = games.filter((g) => g.outcome === "forfeit").length;
  const losses = games.filter((g) => g.outcome === "loss").length;

  const liveCost = liveMoves.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
  const totalCostUsd =
    games.reduce((sum, g) => sum + g.costUsd, 0) + liveCost;

  return {
    model,
    games: games.length,
    wins,
    losses,
    draws,
    forfeits,
    winRate: games.length ? wins / games.length : 0,
    aiMoves: aiMoves.length,
    avgCpLoss: mean(cpLosses),
    accuracy: mean(accuracies),
    blunders: cpLosses.filter((v) => gradeMove(v) === "blunder").length,
    mistakes: cpLosses.filter((v) => gradeMove(v) === "mistake").length,
    inaccuracies: cpLosses.filter((v) => gradeMove(v) === "inaccuracy").length,
    avgResponseMs: mean(times),
    medianResponseMs: median(times),
    totalCostUsd,
    costPerGame: games.length ? totalCostUsd / games.length : 0,
    costPerMove: aiMoves.length ? totalCostUsd / aiMoves.length : 0,
    costPerWin: wins ? totalCostUsd / wins : Infinity,
    illegalAttempts: aiMoves.reduce((sum, m) => sum + (m.illegalAttempts ?? 0), 0),
    retries: aiMoves.reduce((sum, m) => sum + (m.retries ?? 0), 0),
    avgConfidence: confidences.length ? mean(confidences) : null,
    confidenceOnGood: confidenceGood.length ? mean(confidenceGood) : null,
    confidenceOnBlunders: confidenceBlunder.length
      ? mean(confidenceBlunder)
      : null,
  };
}

export interface ScoreBreakdown {
  winRate: number;
  accuracy: number;
  speed: number;
  costPerWin: number;
  total: number;
}

/**
 * Combined efficiency score, 0-100. Each factor is normalised against the
 * other model so the four parts stay directly comparable, and every part is
 * reported separately in the final report.
 */
export function efficiencyScore(
  self: ModelStats,
  other: ModelStats,
): ScoreBreakdown {
  const relativeLowerIsBetter = (mine: number, theirs: number) => {
    if (!Number.isFinite(mine) && !Number.isFinite(theirs)) return 50;
    if (!Number.isFinite(mine)) return 0;
    if (!Number.isFinite(theirs)) return 100;
    if (mine <= 0 && theirs <= 0) return 50;
    const total = mine + theirs;
    return total === 0 ? 50 : (theirs / total) * 100;
  };

  const winRate = self.winRate * 100;
  const accuracy = self.accuracy;
  const speed = relativeLowerIsBetter(self.avgResponseMs, other.avgResponseMs);
  const costPerWin = relativeLowerIsBetter(self.costPerWin, other.costPerWin);

  // Results and move quality carry the most weight; speed and cost break ties.
  const total =
    winRate * 0.35 + accuracy * 0.35 + speed * 0.15 + costPerWin * 0.15;

  return { winRate, accuracy, speed, costPerWin, total };
}
