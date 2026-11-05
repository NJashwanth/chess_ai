/**
 * Jev (TypeSafe AI) - Board A.
 *
 * Jev is a System One model: it does not generate text, it answers typed
 * questions about a state. Each turn we send the game state plus one `choice`
 * question whose options are every legal move (key = UCI, description = SAN),
 * and play whatever it picks.
 *
 * Request/response shape: POST {base}/v1/systemone, per docs.typesafe.ai/api.
 * The identical body is accepted by OpenRouter's Decisions pass-through, so
 * the provider is switchable with JEV_PROVIDER.
 *
 * Server-only - never import this from a client component.
 */
import { MissingApiKeyError, UpstreamError } from "./errors";
import { serverLog } from "./debug";
import { buildStatePayload } from "./state";
import type { AiMoveResponse, TurnState } from "./types";

const QUESTION_ID = "best_move";
const QUESTION = "Which move is best for the side to move?";
const TIMEOUT_MS = 30_000;
/** Attempts per turn, including the first. */
const MAX_ATTEMPTS = 6;
/**
 * 502/503/504 come straight back from the gateway with no work done - the
 * request never reached a model host, so the next attempt may simply land on a
 * healthy one. Retry those almost immediately. 429/529 mean the service itself
 * is shedding load, so back off properly.
 */
const GATEWAY_BACKOFF_MS = 250;
const OVERLOAD_BACKOFF_MS = 800;
/**
 * Uncapped exponential backoff turns a 529 storm into a half-minute sleep
 * inside a single request, which looks like a frozen board. Cap each wait, and
 * cap the whole route call, so control returns to the turn-level retry - which
 * can actually tell the user what is happening - while the outage continues.
 */
const MAX_BACKOFF_MS = 4000;
/** Total retry budget for one route call, backoff included. */
const RETRY_BUDGET_MS = 30_000;
/** A `choice` question accepts at most 255 options. */
const MAX_OPTIONS = 255;

export type JevProvider = "typesafe" | "openrouter";

interface ProviderConfig {
  provider: JevProvider;
  apiKey: string;
  url: string;
  model: string;
}

function resolveProvider(): ProviderConfig {
  const provider = (process.env.JEV_PROVIDER ?? "typesafe") as JevProvider;

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new MissingApiKeyError(
        "OPENROUTER_API_KEY",
        "JEV_PROVIDER is set to \"openrouter\" but OPENROUTER_API_KEY is missing from .env.local.",
      );
    }
    const base = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api";
    return {
      provider,
      apiKey,
      url: `${base.replace(/\/$/, "")}/v1/systemone`,
      model: process.env.JEV_MODEL ?? "typesafe/jev-1.13",
    };
  }

  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingApiKeyError(
      "TYPESAFE_API_KEY",
      "TYPESAFE_API_KEY is missing from .env.local. Add a TypeSafe AI key, or set JEV_PROVIDER=openrouter and add OPENROUTER_API_KEY.",
    );
  }
  const base = process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai";
  return {
    provider,
    apiKey,
    url: `${base.replace(/\/$/, "")}/v1/systemone`,
    model: process.env.JEV_MODEL ?? "jev-1.13.0",
  };
}

interface SystemOneResponse {
  model?: string;
  answers?: Record<
    string,
    {
      type?: string;
      choice?: string;
      probabilities?: Record<string, number>;
      confidence?: number;
    }
  >;
  usage?: { input_tokens?: number; output_tokens?: number };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pulls the human-readable part out of a TypeSafe/OpenRouter error body. */
function upstreamMessage(status: number, text: string): string {
  try {
    const body = JSON.parse(text);
    const detail = body?.detail ?? body?.error;
    const message =
      typeof detail === "string" ? detail : (detail?.message ?? body?.message);
    const kind = detail?.error_type ?? detail?.type;
    if (message) return kind ? `${kind}: ${message}` : String(message);
  } catch {
    /* not JSON - fall through to the raw text */
  }
  return text.slice(0, 300) || `HTTP ${status}`;
}

async function postSystemOne(
  config: ProviderConfig,
  body: unknown,
): Promise<SystemOneResponse> {
  // 30s timeout per call. TypeSafe returns 429/503/529 under load, so those and
  // network failures are retried with exponential backoff inside a total budget
  // that stays under the browser's own timeout.
  const deadline = Date.now() + RETRY_BUDGET_MS;
  let lastMessage = "unknown error";
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    attemptsUsed = attempt;
    let retryAfterMs: number | null = null;
    let base = OVERLOAD_BACKOFF_MS;

    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.ok) return (await response.json()) as SystemOneResponse;

      const text = await response.text().catch(() => "");
      if (response.status === 401 || response.status === 403) {
        throw new MissingApiKeyError(
          config.provider === "openrouter"
            ? "OPENROUTER_API_KEY"
            : "TYPESAFE_API_KEY",
          `Jev rejected the API key (${response.status}). Check the key in .env.local - a key exported in the shell that started the dev server overrides it. ${text.slice(0, 200)}`,
        );
      }

      lastMessage = upstreamMessage(response.status, text);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) {
        throw new UpstreamError(
          `Jev request failed (${response.status}): ${lastMessage}`,
          response.status,
        );
      }

      const retryAfter = Number(response.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        retryAfterMs = retryAfter * 1000;
      }
      if (response.status >= 502 && response.status <= 504) {
        base = GATEWAY_BACKOFF_MS;
      }
      lastMessage = `${response.status} ${lastMessage}`;
    } catch (error) {
      if (error instanceof MissingApiKeyError) throw error;
      if (error instanceof UpstreamError) throw error;
      lastMessage = (error as Error)?.message ?? "network error";
    }

    const growth = base === GATEWAY_BACKOFF_MS ? 1.6 : 2;
    const wait = Math.min(
      MAX_BACKOFF_MS,
      retryAfterMs ?? Math.round(base * growth ** (attempt - 1) * (1 + Math.random())),
    );
    if (attempt === MAX_ATTEMPTS || Date.now() + wait > deadline) break;

    serverLog("jev", `attempt ${attempt} failed (${lastMessage}); retrying in ${wait}ms`);
    await sleep(wait);
  }

  throw new UpstreamError(
    `Jev is not responding after ${attemptsUsed} attempts: ${lastMessage}. This is an upstream outage, not an illegal move - the results so far are kept.`,
    503,
  );
}

export async function askJev(turn: TurnState): Promise<AiMoveResponse> {
  const config = resolveProvider();
  const legalMoves = turn.legalMoves.slice(0, MAX_OPTIONS);
  const legalSet = new Set(legalMoves.map((move) => move.uci));
  const sanByUci = new Map(legalMoves.map((move) => [move.uci, move.san]));

  // key = UCI, description = SAN
  const criteria: Record<string, string> = {};
  for (const move of legalMoves) criteria[move.uci] = move.san;

  const body = {
    state: buildStatePayload({ ...turn, legalMoves }),
    model: config.model,
    questions: {
      [QUESTION_ID]: {
        type: "choice",
        instructions: QUESTION,
        criteria,
      },
    },
  };

  serverLog("jev", "request", {
    provider: config.provider,
    model: config.model,
    fen: turn.fen,
    options: legalMoves.length,
  });

  let illegalAttempts = 0;
  let retries = 0;
  let lastVersion = config.model;
  const usage = { inputTokens: 0, outputTokens: 0 };

  // A choice question can only return one of the options we supplied, so a
  // second pass is a safety net rather than an expected path.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) retries += 1;
    const data = await postSystemOne(config, body);
    serverLog("jev", "response", data);

    lastVersion = data.model ?? config.model;
    usage.inputTokens += data.usage?.input_tokens ?? 0;
    usage.outputTokens += data.usage?.output_tokens ?? 0;

    const answer = data.answers?.[QUESTION_ID];
    const choice = answer?.choice;

    if (!choice || !legalSet.has(choice)) {
      illegalAttempts += 1;
      continue;
    }

    const probabilities = answer?.probabilities ?? {};
    const topMoves = Object.entries(probabilities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([uci, probability]) => ({
        uci,
        san: sanByUci.get(uci) ?? uci,
        probability,
      }));

    return {
      uci: choice,
      modelVersion: lastVersion,
      usage,
      illegalAttempts,
      retries,
      forfeit: false,
      confidence: answer?.confidence,
      topMoves,
    };
  }

  return {
    uci: null,
    modelVersion: lastVersion,
    usage,
    illegalAttempts,
    retries,
    forfeit: true,
    error: "Jev did not return a legal option after 2 attempts.",
  };
}
