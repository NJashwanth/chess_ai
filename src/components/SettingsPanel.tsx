"use client";

import { DEFAULT_PRICES } from "@/lib/pricing";
import { MODEL_LABEL, type ModelId, type Settings } from "@/lib/types";

interface Props {
  settings: Settings;
  setSettings: (update: (previous: Settings) => Settings) => void;
  onClose: () => void;
}

const MODELS: ModelId[] = ["jev", "fable"];

export function SettingsPanel({ settings, setSettings, onClose }: Props) {
  const setPrice = (
    model: ModelId,
    field: "inputPerMTok" | "outputPerMTok",
    value: number,
  ) =>
    setSettings((previous) => ({
      ...previous,
      prices: {
        ...previous.prices,
        [model]: { ...previous.prices[model], [field]: value },
      },
    }));

  return (
    <section className="panel rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Token prices &amp; engine</h2>
          <p className="mt-0.5 text-xs text-muted">
            Cost metrics use these rates with the token counts returned by each
            API. Fable&apos;s defaults are Anthropic&apos;s published rates;
            TypeSafe does not publish Jev token pricing, so set your own before
            reading the cost columns.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {MODELS.map((model) => (
          <div key={model} className="rounded-lg border border-line p-3">
            <p className="text-xs font-semibold">{MODEL_LABEL[model]}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-muted">Input $/1M tokens</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="rounded-md border border-line bg-transparent px-2 py-1 font-mono"
                  value={settings.prices[model].inputPerMTok}
                  onChange={(event) =>
                    setPrice(model, "inputPerMTok", Number(event.target.value))
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted">Output $/1M tokens</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="rounded-md border border-line bg-transparent px-2 py-1 font-mono"
                  value={settings.prices[model].outputPerMTok}
                  onChange={(event) =>
                    setPrice(model, "outputPerMTok", Number(event.target.value))
                  }
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Default {DEFAULT_PRICES[model].inputPerMTok} /{" "}
              {DEFAULT_PRICES[model].outputPerMTok}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">
            Stockfish movetime per opponent move (ms)
          </span>
          <input
            type="number"
            min={20}
            max={2000}
            step={10}
            className="rounded-md border border-line bg-transparent px-2 py-1 font-mono"
            value={settings.movetimeMs}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                movetimeMs: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">Analysis depth for centipawn loss</span>
          <input
            type="number"
            min={6}
            max={20}
            step={1}
            className="rounded-md border border-line bg-transparent px-2 py-1 font-mono"
            value={settings.analysisDepth}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                analysisDepth: Number(event.target.value),
              }))
            }
          />
        </label>
      </div>
    </section>
  );
}
