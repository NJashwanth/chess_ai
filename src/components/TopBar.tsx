"use client";

import { SKILL_LEVELS } from "@/lib/useBenchmark";
import type { Settings, SeriesPhase } from "@/lib/types";
import { ThemeToggle } from "./ThemeToggle";

const GAME_COUNTS = [1, 5, 10, 20];

interface Props {
  settings: Settings;
  setSettings: (update: (previous: Settings) => Settings) => void;
  phase: SeriesPhase;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onToggleSettings: () => void;
}

const buttonBase =
  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function TopBar({
  settings,
  setSettings,
  phase,
  onStart,
  onPause,
  onResume,
  onReset,
  onToggleSettings,
}: Props) {
  const running = phase === "running";
  const locked = running || phase === "paused";

  return (
    <header className="panel sticky top-0 z-20 rounded-none border-x-0 border-t-0 px-4 py-3">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-3">
        <h1 className="mr-auto text-base font-semibold tracking-tight">
          AI Chess Benchmark
          <span className="text-muted"> · Jev vs Fable</span>
        </h1>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Stockfish</span>
          <select
            className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm"
            value={settings.skillLevel}
            disabled={locked}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                skillLevel: Number(event.target.value),
              }))
            }
          >
            {SKILL_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label} (Skill {level.value})
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Games</span>
          <select
            className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm"
            value={settings.gameCount}
            disabled={locked}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                gameCount: Number(event.target.value),
              }))
            }
          >
            {GAME_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-violet-600"
            checked={settings.sameOpenings}
            disabled={locked}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                sameOpenings: event.target.checked,
              }))
            }
          />
          <span className="text-muted">Same openings</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-muted">
            Delay {(settings.moveDelayMs / 1000).toFixed(1)}s
          </span>
          <input
            type="range"
            min={0}
            max={3000}
            step={100}
            className="w-28 accent-violet-600"
            value={settings.moveDelayMs}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                moveDelayMs: Number(event.target.value),
              }))
            }
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${buttonBase} bg-violet-600 text-white hover:bg-violet-500`}
            onClick={onStart}
            disabled={locked}
          >
            Start
          </button>
          <button
            type="button"
            className={`${buttonBase} border border-line hover:bg-black/5 dark:hover:bg-white/5`}
            onClick={onPause}
            disabled={!running}
          >
            Pause
          </button>
          <button
            type="button"
            className={`${buttonBase} border border-line hover:bg-black/5 dark:hover:bg-white/5`}
            onClick={onResume}
            disabled={phase !== "paused"}
          >
            Resume
          </button>
          <button
            type="button"
            className={`${buttonBase} border border-line hover:bg-black/5 dark:hover:bg-white/5`}
            onClick={onReset}
          >
            Reset
          </button>
          <button
            type="button"
            className={`${buttonBase} border border-line hover:bg-black/5 dark:hover:bg-white/5`}
            onClick={onToggleSettings}
          >
            Prices
          </button>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
