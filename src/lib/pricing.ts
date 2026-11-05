import type { ModelId, TokenUsage } from "./types";

/**
 * Default per-million-token prices, editable in the settings panel.
 *
 * Fable 5.1 is listed at $10 / $50 per million tokens on the Anthropic API.
 * TypeSafe does not publish Jev token pricing in its API reference, so the
 * numbers below are placeholders - set them to your actual rate before
 * reading anything into the cost columns.
 */
export const DEFAULT_PRICES: Record<
  ModelId,
  { inputPerMTok: number; outputPerMTok: number }
> = {
  jev: { inputPerMTok: 0.5, outputPerMTok: 2.0 },
  fable: { inputPerMTok: 10.0, outputPerMTok: 50.0 },
};

export function costOf(
  usage: TokenUsage,
  price: { inputPerMTok: number; outputPerMTok: number },
): number {
  return (
    (usage.inputTokens / 1_000_000) * price.inputPerMTok +
    (usage.outputTokens / 1_000_000) * price.outputPerMTok
  );
}

export function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(5)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(3)}`;
}
