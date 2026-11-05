"use client";

import { GRADE_COLOR, gradeMove } from "@/lib/metrics";
import type { MoveRecord } from "@/lib/types";

interface Props {
  moves: MoveRecord[];
}

/** Move list in PGN layout; AI moves are tinted by move quality. */
export function MoveList({ moves }: Props) {
  const rows: { number: number; white?: MoveRecord; black?: MoveRecord }[] = [];
  moves.forEach((move, index) => {
    const moveNumber = Math.floor(index / 2) + 1;
    const row = rows[moveNumber - 1] ?? { number: moveNumber };
    if (index % 2 === 0) row.white = move;
    else row.black = move;
    rows[moveNumber - 1] = row;
  });

  return (
    <div className="h-40 overflow-y-auto rounded-lg border border-line p-2 font-mono text-xs leading-6">
      {rows.length === 0 ? (
        <p className="text-muted">No moves yet.</p>
      ) : (
        <div className="flex flex-wrap gap-x-2">
          {rows.map((row) => (
            <span key={row.number} className="whitespace-nowrap">
              <span className="text-muted">{row.number}.</span>{" "}
              <Ply move={row.white} />{" "}
              {row.black ? <Ply move={row.black} /> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Ply({ move }: { move?: MoveRecord }) {
  if (!move) return null;
  if (!move.byAi) return <span className="text-muted">{move.san}</span>;

  const grade = gradeMove(move.cpLoss ?? 0);
  const details = [
    `${move.cpLoss ?? 0} cp lost`,
    move.timeMs ? `${move.timeMs} ms` : null,
    typeof move.confidence === "number"
      ? `confidence ${(move.confidence * 100).toFixed(0)}%`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span className={`font-semibold ${GRADE_COLOR[grade]}`} title={details}>
      {move.san}
      {grade === "blunder" ? "??" : grade === "mistake" ? "?" : ""}
    </span>
  );
}
