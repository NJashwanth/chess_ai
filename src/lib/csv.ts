import { computeStats, type ModelStats } from "./metrics";
import type { BoardState, ModelId } from "./types";

function escape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function statRows(stats: ModelStats): (string | number)[][] {
  const finite = (value: number) => (Number.isFinite(value) ? value : "");
  return [
    ["games", stats.games],
    ["wins", stats.wins],
    ["losses", stats.losses],
    ["draws", stats.draws],
    ["forfeits", stats.forfeits],
    ["win_rate", stats.winRate.toFixed(4)],
    ["ai_moves", stats.aiMoves],
    ["avg_centipawn_loss", stats.avgCpLoss.toFixed(2)],
    ["accuracy_percent", stats.accuracy.toFixed(2)],
    ["blunders", stats.blunders],
    ["mistakes", stats.mistakes],
    ["inaccuracies", stats.inaccuracies],
    ["avg_response_ms", Math.round(stats.avgResponseMs)],
    ["median_response_ms", Math.round(stats.medianResponseMs)],
    ["total_cost_usd", stats.totalCostUsd.toFixed(6)],
    ["cost_per_game_usd", stats.costPerGame.toFixed(6)],
    ["cost_per_move_usd", stats.costPerMove.toFixed(6)],
    ["cost_per_win_usd", finite(Number(stats.costPerWin.toFixed(6)))],
    ["illegal_move_attempts", stats.illegalAttempts],
    ["retries", stats.retries],
    ["avg_confidence", stats.avgConfidence?.toFixed(4) ?? ""],
    ["confidence_on_good_moves", stats.confidenceOnGood?.toFixed(4) ?? ""],
    ["confidence_on_blunders", stats.confidenceOnBlunders?.toFixed(4) ?? ""],
  ];
}

/** Summary metrics, per-game results and every AI move in one file. */
export function buildCsv(boards: Record<ModelId, BoardState>): string {
  const models: ModelId[] = ["jev", "fable"];
  const lines: string[] = [];

  lines.push("section,model,metric,value");
  for (const model of models) {
    const stats = computeStats(model, boards[model].games, boards[model].moves);
    for (const [metric, value] of statRows(stats)) {
      lines.push(["summary", model, metric, value].map(escape).join(","));
    }
  }

  lines.push("");
  lines.push("section,model,game,ai_color,opening,outcome,reason,ai_moves,cost_usd");
  for (const model of models) {
    for (const game of boards[model].games) {
      lines.push(
        [
          "game",
          model,
          game.gameNumber,
          game.aiColor === "w" ? "white" : "black",
          game.opening,
          game.outcome,
          game.reason,
          game.aiMoveCount,
          game.costUsd.toFixed(6),
        ]
          .map(escape)
          .join(","),
      );
    }
  }

  lines.push("");
  lines.push(
    "section,model,game,ply,san,uci,time_ms,centipawn_loss,accuracy,confidence,input_tokens,output_tokens,cost_usd,retries,illegal_attempts",
  );
  for (const model of models) {
    const games = [
      ...boards[model].games,
      ...(boards[model].games.some(
        (game) => game.gameNumber === boards[model].gameNumber,
      )
        ? []
        : [
            {
              gameNumber: boards[model].gameNumber,
              moves: boards[model].moves,
            },
          ]),
    ];
    for (const game of games) {
      for (const move of game.moves) {
        if (!move.byAi) continue;
        lines.push(
          [
            "move",
            model,
            game.gameNumber,
            move.ply,
            move.san,
            move.uci,
            move.timeMs ?? "",
            move.cpLoss ?? "",
            move.accuracy?.toFixed(2) ?? "",
            move.confidence ?? "",
            move.usage?.inputTokens ?? "",
            move.usage?.outputTokens ?? "",
            move.costUsd?.toFixed(6) ?? "",
            move.retries ?? 0,
            move.illegalAttempts ?? 0,
          ]
            .map(escape)
            .join(","),
        );
      }
    }
  }

  return lines.join("\n");
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
