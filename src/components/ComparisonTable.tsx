"use client";

import type { ModelStats } from "@/lib/metrics";
import { SERIES_CLASS } from "@/lib/palette";
import { formatUsd } from "@/lib/pricing";
import { MODEL_LABEL } from "@/lib/types";

type Direction = "higher" | "lower" | "none";

interface Row {
  group: string;
  label: string;
  jev: number | null;
  fable: number | null;
  better: Direction;
  format: (value: number) => string;
}

const int = (value: number) => String(Math.round(value));
const ms = (value: number) => `${Math.round(value)} ms`;
const pct = (value: number) => `${value.toFixed(1)}%`;
const cp = (value: number) => `${value.toFixed(1)} cp`;
const usd = (value: number) => (Number.isFinite(value) ? formatUsd(value) : "n/a");

function buildRows(jev: ModelStats, fable: ModelStats): Row[] {
  return [
    { group: "Results", label: "Wins", jev: jev.wins, fable: fable.wins, better: "higher", format: int },
    { group: "Results", label: "Losses", jev: jev.losses, fable: fable.losses, better: "lower", format: int },
    { group: "Results", label: "Draws", jev: jev.draws, fable: fable.draws, better: "none", format: int },
    { group: "Results", label: "Forfeits", jev: jev.forfeits, fable: fable.forfeits, better: "lower", format: int },
    { group: "Results", label: "Win rate", jev: jev.winRate * 100, fable: fable.winRate * 100, better: "higher", format: pct },
    { group: "Move quality", label: "Avg centipawn loss", jev: jev.avgCpLoss, fable: fable.avgCpLoss, better: "lower", format: cp },
    { group: "Move quality", label: "Accuracy", jev: jev.accuracy, fable: fable.accuracy, better: "higher", format: pct },
    { group: "Move quality", label: "Blunders (>300 cp)", jev: jev.blunders, fable: fable.blunders, better: "lower", format: int },
    { group: "Move quality", label: "Mistakes (100-300 cp)", jev: jev.mistakes, fable: fable.mistakes, better: "lower", format: int },
    { group: "Move quality", label: "Inaccuracies (50-100 cp)", jev: jev.inaccuracies, fable: fable.inaccuracies, better: "lower", format: int },
    { group: "Speed", label: "Avg response time", jev: jev.avgResponseMs, fable: fable.avgResponseMs, better: "lower", format: ms },
    { group: "Speed", label: "Median response time", jev: jev.medianResponseMs, fable: fable.medianResponseMs, better: "lower", format: ms },
    { group: "Cost", label: "Total cost", jev: jev.totalCostUsd, fable: fable.totalCostUsd, better: "lower", format: usd },
    { group: "Cost", label: "Cost per game", jev: jev.games ? jev.costPerGame : null, fable: fable.games ? fable.costPerGame : null, better: "lower", format: usd },
    { group: "Cost", label: "Cost per move", jev: jev.costPerMove, fable: fable.costPerMove, better: "lower", format: usd },
    { group: "Cost", label: "Cost per win", jev: jev.costPerWin, fable: fable.costPerWin, better: "lower", format: usd },
    { group: "Reliability", label: "Illegal move attempts", jev: jev.illegalAttempts, fable: fable.illegalAttempts, better: "lower", format: int },
    { group: "Reliability", label: "Retries", jev: jev.retries, fable: fable.retries, better: "lower", format: int },
    { group: "Calibration (Jev only)", label: "Avg confidence", jev: jev.avgConfidence === null ? null : jev.avgConfidence * 100, fable: null, better: "none", format: pct },
    { group: "Calibration (Jev only)", label: "Confidence on good moves", jev: jev.confidenceOnGood === null ? null : jev.confidenceOnGood * 100, fable: null, better: "none", format: pct },
    { group: "Calibration (Jev only)", label: "Confidence on blunders", jev: jev.confidenceOnBlunders === null ? null : jev.confidenceOnBlunders * 100, fable: null, better: "none", format: pct },
  ];
}

function winner(row: Row): "jev" | "fable" | null {
  if (row.better === "none" || row.jev === null || row.fable === null) return null;
  const { jev, fable } = row;
  if (!Number.isFinite(jev) && !Number.isFinite(fable)) return null;
  if (jev === fable) return null;
  if (!Number.isFinite(jev)) return row.better === "lower" ? "fable" : "jev";
  if (!Number.isFinite(fable)) return row.better === "lower" ? "jev" : "fable";
  const jevBetter = row.better === "higher" ? jev > fable : jev < fable;
  return jevBetter ? "jev" : "fable";
}

export function ComparisonTable({
  jev,
  fable,
}: {
  jev: ModelStats;
  fable: ModelStats;
}) {
  const rows = buildRows(jev, fable).map((row, index, all) => ({
    row,
    showGroup: index === 0 || all[index - 1].group !== row.group,
  }));

  return (
    <section className="panel rounded-xl p-4">
      <h2 className="text-sm font-semibold">Live comparison</h2>
      <p className="mt-0.5 text-xs text-muted">
        The better value in each row is highlighted; rows without a winner are
        informational.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4 font-medium">Metric</th>
              <th className="py-2 pr-4 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${SERIES_CLASS.jev.dot}`} />
                  {MODEL_LABEL.jev}
                </span>
              </th>
              <th className="py-2 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${SERIES_CLASS.fable.dot}`} />
                  {MODEL_LABEL.fable}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, showGroup }) => {
              const best = winner(row);
              return (
                <tr key={row.label} className="border-b border-line/60">
                  <td className="py-1.5 pr-4">
                    {showGroup ? (
                      <span className="mr-2 text-[10px] uppercase tracking-wide text-muted">
                        {row.group}
                      </span>
                    ) : null}
                    {row.label}
                  </td>
                  <Cell value={row.jev} format={row.format} best={best === "jev"} />
                  <Cell value={row.fable} format={row.format} best={best === "fable"} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({
  value,
  format,
  best,
}: {
  value: number | null;
  format: (value: number) => string;
  best: boolean;
}) {
  return (
    <td className="py-1.5 pr-4 font-mono tabular-nums">
      <span
        className={
          best
            ? "rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300"
            : ""
        }
      >
        {value === null ? "—" : format(value)}
      </span>
    </td>
  );
}
