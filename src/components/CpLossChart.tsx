"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SERIES_COLOR } from "@/lib/palette";
import { useIsDark } from "@/lib/useIsDark";
import { MODEL_LABEL, type BoardState, type ModelId } from "@/lib/types";

interface Point {
  move: number;
  jev: number | null;
  fable: number | null;
  jevSan?: string;
  fableSan?: string;
}

function aiMoves(board: BoardState) {
  return board.moves.filter((move) => move.byAi);
}

export function CpLossChart({
  boards,
}: {
  boards: Record<ModelId, BoardState>;
}) {
  const isDark = useIsDark();
  const jevMoves = aiMoves(boards.jev);
  const fableMoves = aiMoves(boards.fable);
  const length = Math.max(jevMoves.length, fableMoves.length);

  const data: Point[] = Array.from({ length }, (_, index) => ({
    move: index + 1,
    jev: jevMoves[index]?.cpLoss ?? null,
    fable: fableMoves[index]?.cpLoss ?? null,
    jevSan: jevMoves[index]?.san,
    fableSan: fableMoves[index]?.san,
  }));

  const colors = {
    jev: isDark ? SERIES_COLOR.jev.dark : SERIES_COLOR.jev.light,
    fable: isDark ? SERIES_COLOR.fable.dark : SERIES_COLOR.fable.light,
  };
  const ink = isDark ? "#9a9aa6" : "#6b6b76";
  const grid = isDark ? "#2a2a31" : "#e3e3df";
  const surface = isDark ? "#17171b" : "#ffffff";

  return (
    <section className="panel rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            Centipawn loss per move · current game
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Lower is better. Each point is one AI move, measured against
            Stockfish at depth 14.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {(["jev", "fable"] as ModelId[]).map((model) => (
            <span key={model} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-5 rounded-full"
                style={{ backgroundColor: colors[model] }}
              />
              <span className="text-muted">{MODEL_LABEL[model]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        {length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            No AI moves yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
            >
              <CartesianGrid stroke={grid} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="move"
                stroke={grid}
                tick={{ fill: ink, fontSize: 11 }}
                tickLine={false}
                label={{
                  value: "AI move",
                  position: "insideBottomRight",
                  offset: -2,
                  fill: ink,
                  fontSize: 11,
                }}
              />
              <YAxis
                stroke={grid}
                tick={{ fill: ink, fontSize: 11 }}
                tickLine={false}
                width={44}
                label={{
                  value: "cp lost",
                  angle: -90,
                  position: "insideLeft",
                  fill: ink,
                  fontSize: 11,
                }}
              />
              <Tooltip
                cursor={{ stroke: ink, strokeWidth: 1, strokeDasharray: "3 3" }}
                contentStyle={{
                  background: surface,
                  border: `1px solid ${grid}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: ink }}
                formatter={(value, name, item) => {
                  const point = item.payload as Point;
                  const san =
                    name === MODEL_LABEL.jev ? point.jevSan : point.fableSan;
                  return [`${value} cp${san ? ` (${san})` : ""}`, name];
                }}
                labelFormatter={(label) => `AI move ${label}`}
              />
              <Line
                type="linear"
                dataKey="jev"
                name={MODEL_LABEL.jev}
                stroke={colors.jev}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: surface }}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="fable"
                name={MODEL_LABEL.fable}
                stroke={colors.fable}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: surface }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
