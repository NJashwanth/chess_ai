"use client";

import { buildCsv, downloadText } from "@/lib/csv";
import { efficiencyScore, type ModelStats } from "@/lib/metrics";
import { SERIES_CLASS } from "@/lib/palette";
import { formatUsd } from "@/lib/pricing";
import { MODEL_LABEL, type BoardState, type ModelId } from "@/lib/types";

interface Props {
  jev: ModelStats;
  fable: ModelStats;
  boards: Record<ModelId, BoardState>;
}

export function FinalReport({ jev, fable, boards }: Props) {
  const jevScore = efficiencyScore(jev, fable);
  const fableScore = efficiencyScore(fable, jev);
  const tie = Math.abs(jevScore.total - fableScore.total) < 0.5;
  const winner: ModelId = jevScore.total >= fableScore.total ? "jev" : "fable";

  const factors = [
    {
      label: "Win rate",
      weight: "35%",
      jev: `${jevScore.winRate.toFixed(1)}%`,
      fable: `${fableScore.winRate.toFixed(1)}%`,
    },
    {
      label: "Accuracy",
      weight: "35%",
      jev: `${jevScore.accuracy.toFixed(1)}%`,
      fable: `${fableScore.accuracy.toFixed(1)}%`,
    },
    {
      label: "Speed (relative)",
      weight: "15%",
      jev: `${jevScore.speed.toFixed(0)}/100 · ${Math.round(jev.avgResponseMs)} ms`,
      fable: `${fableScore.speed.toFixed(0)}/100 · ${Math.round(fable.avgResponseMs)} ms`,
    },
    {
      label: "Cost per win (relative)",
      weight: "15%",
      jev: `${jevScore.costPerWin.toFixed(0)}/100 · ${Number.isFinite(jev.costPerWin) ? formatUsd(jev.costPerWin) : "no wins"}`,
      fable: `${fableScore.costPerWin.toFixed(0)}/100 · ${Number.isFinite(fable.costPerWin) ? formatUsd(fable.costPerWin) : "no wins"}`,
    },
  ];

  return (
    <section className="panel rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Series complete</h2>
          <p className="mt-1 text-lg font-semibold">
            Most efficient model:{" "}
            {tie ? (
              <span>Too close to call</span>
            ) : (
              <span className={SERIES_CLASS[winner].text}>
                {MODEL_LABEL[winner]}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            Combined score {jevScore.total.toFixed(1)} (Jev) vs{" "}
            {fableScore.total.toFixed(1)} (Fable). Speed and cost are scored
            relative to each other, so each factor is shown separately below -
            weight them yourself.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
          onClick={() =>
            downloadText(
              `chess-benchmark-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`,
              buildCsv(boards),
              "text/csv",
            )
          }
        >
          Export all results as CSV
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4 font-medium">Factor</th>
              <th className="py-2 pr-4 font-medium">Weight</th>
              <th className="py-2 pr-4 font-medium">{MODEL_LABEL.jev}</th>
              <th className="py-2 font-medium">{MODEL_LABEL.fable}</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((factor) => (
              <tr key={factor.label} className="border-b border-line/60">
                <td className="py-1.5 pr-4">{factor.label}</td>
                <td className="py-1.5 pr-4 text-muted">{factor.weight}</td>
                <td className="py-1.5 pr-4 font-mono tabular-nums">{factor.jev}</td>
                <td className="py-1.5 font-mono tabular-nums">{factor.fable}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 pr-4 font-semibold">Combined score</td>
              <td className="py-2 pr-4 text-muted">100%</td>
              <td className="py-2 pr-4 font-mono font-semibold tabular-nums">
                {jevScore.total.toFixed(1)}
              </td>
              <td className="py-2 font-mono font-semibold tabular-nums">
                {fableScore.total.toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
