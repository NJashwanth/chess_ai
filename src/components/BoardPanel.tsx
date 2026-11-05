"use client";

import { Chessboard } from "react-chessboard";
import { downloadText } from "@/lib/csv";
import { SERIES_CLASS } from "@/lib/palette";
import { formatUsd } from "@/lib/pricing";
import { MODEL_LABEL, type BoardState, type GameOutcome } from "@/lib/types";
import { EvalBar } from "./EvalBar";
import { MoveList } from "./MoveList";

const OUTCOME_STYLE: Record<GameOutcome, string> = {
  win: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
  loss: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40",
  draw: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  forfeit: "bg-rose-600/20 text-rose-700 dark:text-rose-300 border-rose-600/50",
};

const OUTCOME_LABEL: Record<GameOutcome, string> = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
  forfeit: "Forfeit",
};

interface Props {
  board: BoardState;
  gameCount: number;
}

export function BoardPanel({ board, gameCount }: Props) {
  const accent = SERIES_CLASS[board.model];
  const flipped = board.aiColor === "b";
  const thinking = board.phase === "thinking";

  return (
    <section className="panel flex flex-col gap-3 rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`size-2.5 rounded-full ${accent.dot}`} />
        <h2 className="text-sm font-semibold">{MODEL_LABEL[board.model]}</h2>
        <span className="text-xs text-muted">vs Stockfish</span>
        <span className="ml-auto rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
          {board.modelVersion ?? "unpinned"}
        </span>
      </div>

      {board.errorMessage ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-300">
            {board.phase === "blocked" ? "Setup needed" : "Board stopped"}
          </p>
          <p className="mt-1 text-muted">{board.errorMessage}</p>
          <p className="mt-1 text-xs text-muted">
            The other board keeps running.
          </p>
        </div>
      ) : null}

      {board.warning ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {board.warning}
        </p>
      ) : null}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Chessboard
            options={{
              id: `board-${board.model}`,
              position: board.fen,
              boardOrientation: flipped ? "black" : "white",
              allowDragging: false,
              animationDurationInMs: 180,
              showNotation: true,
              boardStyle: { borderRadius: "0.5rem", width: "100%" },
              darkSquareStyle: { backgroundColor: "#7a8b9c" },
              lightSquareStyle: { backgroundColor: "#dfe4ea" },
            }}
          />
        </div>
        <EvalBar cp={board.evalCp} mate={board.evalMate} flipped={flipped} />
      </div>

      <div
        className={`grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border p-3 text-xs sm:grid-cols-4 ${accent.border} ${accent.bg}`}
      >
        <Field label="Playing">
          {board.aiColor === "w" ? "White" : "Black"}
          <span className="text-muted">
            {" "}
            · game {board.gameNumber || "-"}/{gameCount}
          </span>
        </Field>
        <Field label="Status">
          <span className="inline-flex items-center gap-1.5">
            {thinking ? (
              <span className="size-1.5 animate-pulse rounded-full bg-violet-500" />
            ) : null}
            {board.phase === "thinking"
              ? "Thinking"
              : board.phase === "opponent"
                ? "Stockfish to move"
                : board.phase === "finished"
                  ? "Game over"
                  : board.phase === "blocked"
                    ? "Blocked"
                    : board.phase === "error"
                      ? "Error"
                      : "Idle"}
          </span>
        </Field>
        <Field label="Last move">{board.lastMoveSan ?? "-"}</Field>
        <Field label="Response">
          {board.lastMoveTimeMs ? `${board.lastMoveTimeMs} ms` : "-"}
        </Field>
        <Field label="Opening">{board.opening}</Field>
        <Field label="Game cost">{formatUsd(board.costUsd)}</Field>
        <Field label="Series cost">
          {formatUsd(
            board.games.reduce((sum, game) => sum + game.costUsd, 0) +
              (board.games.some((g) => g.gameNumber === board.gameNumber)
                ? 0
                : board.costUsd),
          )}
        </Field>
        <Field label="AI moves">
          {board.moves.filter((move) => move.byAi).length}
        </Field>
      </div>

      {board.banner ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${OUTCOME_STYLE[board.banner.outcome]}`}
        >
          <span className="font-semibold">
            {OUTCOME_LABEL[board.banner.outcome]}
          </span>
          <span className="opacity-80">{board.banner.reason}</span>
        </div>
      ) : null}

      <MoveList moves={board.moves} />

      {board.games.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {board.games.map((game) => (
            <button
              key={game.gameNumber}
              type="button"
              className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() =>
                downloadText(
                  `${board.model}-game-${game.gameNumber}.pgn`,
                  game.pgn,
                  "application/x-chess-pgn",
                )
              }
            >
              Download PGN · game {game.gameNumber} ({OUTCOME_LABEL[game.outcome]})
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="truncate font-medium">{children}</p>
    </div>
  );
}
