"use client";

import { useMemo, useState } from "react";
import { BoardPanel } from "@/components/BoardPanel";
import { ComparisonTable } from "@/components/ComparisonTable";
import { CpLossChart } from "@/components/CpLossChart";
import { FinalReport } from "@/components/FinalReport";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TopBar } from "@/components/TopBar";
import { computeStats } from "@/lib/metrics";
import { useBenchmark } from "@/lib/useBenchmark";

export default function Page() {
  const {
    settings,
    setSettings,
    boards,
    phase,
    status,
    start,
    pause,
    resume,
    reset,
  } = useBenchmark();
  const [showSettings, setShowSettings] = useState(false);

  const jevStats = useMemo(
    () => computeStats("jev", boards.jev.games, boards.jev.moves),
    [boards.jev.games, boards.jev.moves],
  );
  const fableStats = useMemo(
    () => computeStats("fable", boards.fable.games, boards.fable.moves),
    [boards.fable.games, boards.fable.moves],
  );

  const bothBlocked =
    status !== null && !status.jev.ready && !status.fable.ready;

  return (
    <main className="min-h-full">
      <TopBar
        settings={settings}
        setSettings={setSettings}
        phase={phase}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onToggleSettings={() => setShowSettings((open) => !open)}
      />

      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4">
        {bothBlocked ? (
          <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-300">
              No API keys configured
            </p>
            <p className="mt-1 text-muted">
              Copy <code className="font-mono">.env.example</code> to{" "}
              <code className="font-mono">.env.local</code>, add at least one
              key, and restart the dev server. Each board runs independently, so
              one key is enough to try the app.
            </p>
          </section>
        ) : null}

        {showSettings ? (
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            onClose={() => setShowSettings(false)}
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <BoardPanel board={boards.jev} gameCount={settings.gameCount} />
          <BoardPanel board={boards.fable} gameCount={settings.gameCount} />
        </div>

        {phase === "finished" ? (
          <FinalReport jev={jevStats} fable={fableStats} boards={boards} />
        ) : null}

        <ComparisonTable jev={jevStats} fable={fableStats} />

        <CpLossChart boards={boards} />

        <footer className="pb-6 text-center text-xs text-muted">
          Both boards face Stockfish at identical settings; colours alternate
          each game. Move quality is measured by a second, full-strength
          Stockfish at depth {settings.analysisDepth}.
        </footer>
      </div>
    </main>
  );
}
