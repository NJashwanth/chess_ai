"use client";

interface Props {
  /** Centipawns from White's point of view. */
  cp: number | null;
  /** Mate distance from White's point of view, when one is seen. */
  mate: number | null;
  /** Which side is at the top of the bar, matching the board orientation. */
  flipped: boolean;
}

export function EvalBar({ cp, mate, flipped }: Props) {
  const clamped = Math.max(-1000, Math.min(1000, cp ?? 0));
  // A logistic curve keeps small edges visible without letting +9 fill the bar.
  const whiteShare =
    mate !== null
      ? mate > 0
        ? 1
        : 0
      : 1 / (1 + Math.exp(-clamped / 320));
  const whitePercent = Math.round(whiteShare * 100);

  const label =
    mate !== null
      ? `M${Math.abs(mate)}`
      : `${clamped >= 0 ? "+" : "-"}${(Math.abs(clamped) / 100).toFixed(1)}`;

  return (
    <div
      className="relative h-full w-6 shrink-0 overflow-hidden rounded-md border border-line bg-neutral-800"
      title={`Evaluation ${label} (White's point of view)`}
    >
      <div
        className="absolute inset-x-0 bg-neutral-100 transition-[height] duration-300"
        style={{
          height: `${whitePercent}%`,
          [flipped ? "top" : "bottom"]: 0,
        }}
      />
      <span
        className={`absolute inset-x-0 text-center font-mono text-[10px] font-semibold ${
          clamped >= 0 ? "text-neutral-900" : "text-neutral-100"
        } ${(clamped >= 0) !== flipped ? "bottom-0.5" : "top-0.5"}`}
      >
        {label}
      </span>
    </div>
  );
}
