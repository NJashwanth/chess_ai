import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports which boards are runnable, so a missing key shows a setup message on
 * that board only and the other one still runs. Never returns key material.
 */
export function GET() {
  const provider = process.env.JEV_PROVIDER ?? "typesafe";
  const jevKey =
    provider === "openrouter"
      ? process.env.OPENROUTER_API_KEY?.trim()
      : process.env.TYPESAFE_API_KEY?.trim();

  return NextResponse.json({
    jev: {
      ready: Boolean(jevKey),
      provider,
      model: process.env.JEV_MODEL ?? (provider === "openrouter" ? "typesafe/jev-1.13" : "jev-1.13.0"),
      message: jevKey
        ? null
        : provider === "openrouter"
          ? "Set OPENROUTER_API_KEY in .env.local to run Board A (JEV_PROVIDER=openrouter)."
          : "Set TYPESAFE_API_KEY in .env.local to run Board A, or set JEV_PROVIDER=openrouter and add OPENROUTER_API_KEY.",
    },
    fable: {
      ready: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      model: process.env.FABLE_MODEL ?? "claude-fable-5-1",
      message: process.env.ANTHROPIC_API_KEY?.trim()
        ? null
        : "Set ANTHROPIC_API_KEY in .env.local to run Board B.",
    },
  });
}
