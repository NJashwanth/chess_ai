/**
 * Fable (Anthropic) - Board B. Anthropic Messages API, model claude-fable-5-1.
 *
 * Fable receives exactly the same state payload as Jev; only the transport
 * differs. Its reply is validated with chess.js by the caller: on an illegal
 * or unparseable move we retry up to twice with the error included, and after
 * that the game is recorded as a forfeit loss.
 *
 * Server-only - never import this from a client component.
 */
import Anthropic from "@anthropic-ai/sdk";
import { MissingApiKeyError, UpstreamError } from "./errors";
import { serverLog } from "./debug";
import { buildStatePayload } from "./state";
import type { AiMoveResponse, TurnState } from "./types";

const SYSTEM_PROMPT =
  "You are a chess engine. Reply with only one move in UCI format, chosen from the legal moves provided. No explanation.";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES_ON_ILLEGAL = 2;
const UCI_PATTERN = /\b([a-h][1-8][a-h][1-8][qrbnQRBN]?)\b/;

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingApiKeyError(
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_API_KEY is missing from .env.local. Add an Anthropic API key to run Board B.",
    );
  }
  // One SDK-level retry covers transient network failures; the 30s timeout is
  // per request.
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export async function askFable(turn: TurnState): Promise<AiMoveResponse> {
  const anthropic = client();
  const model = process.env.FABLE_MODEL ?? "claude-fable-5-1";
  // Picking one move is a single decision; low effort keeps each turn inside
  // the 30s timeout. Raise it with FABLE_EFFORT to give Fable more thinking.
  const effort = (process.env.FABLE_EFFORT ?? "low") as
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max";

  const legalSet = new Set(turn.legalMoves.map((move) => move.uci));
  const state = buildStatePayload(turn);

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: JSON.stringify(state, null, 2),
    },
  ];

  const usage = { inputTokens: 0, outputTokens: 0 };
  let illegalAttempts = 0;
  let retries = 0;
  let lastError = "";
  let modelVersion = model;

  for (let attempt = 0; attempt <= MAX_RETRIES_ON_ILLEGAL; attempt += 1) {
    if (attempt > 0) retries += 1;

    serverLog("fable", `request (attempt ${attempt + 1})`, {
      model,
      effort,
      fen: turn.fen,
      legalMoves: turn.legalMoves.length,
    });

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model,
        // Thinking is always on for Fable; leave headroom above the answer.
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: { effort },
        messages,
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw new MissingApiKeyError(
          "ANTHROPIC_API_KEY",
          "Anthropic rejected the API key (401). Check ANTHROPIC_API_KEY in .env.local - note that an ANTHROPIC_API_KEY exported in the shell that started the dev server overrides the .env.local value.",
        );
      }
      if (error instanceof Anthropic.APIError) {
        throw new UpstreamError(
          `Anthropic request failed (${error.status}): ${error.message}`,
          error.status,
        );
      }
      throw new UpstreamError(
        `Anthropic request failed: ${(error as Error).message}`,
      );
    }

    serverLog("fable", "response", {
      model: response.model,
      stop_reason: response.stop_reason,
      usage: response.usage,
      text: textOf(response),
    });

    modelVersion = response.model ?? model;
    usage.inputTokens += response.usage.input_tokens ?? 0;
    usage.outputTokens += response.usage.output_tokens ?? 0;

    // A policy decline is treated as a failed attempt rather than being routed
    // to another model: every move on this board has to be Fable's own, or the
    // benchmark stops measuring Fable.
    if (response.stop_reason === "refusal") {
      illegalAttempts += 1;
      lastError = "The model declined to answer.";
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: `${lastError} Reply with one legal move in UCI format and nothing else.`,
      });
      continue;
    }

    const text = textOf(response);
    const match = text.match(UCI_PATTERN);
    const candidate = match?.[1]?.toLowerCase();

    if (candidate && legalSet.has(candidate)) {
      return {
        uci: candidate,
        modelVersion,
        usage,
        illegalAttempts,
        retries,
        forfeit: false,
      };
    }

    illegalAttempts += 1;
    lastError = candidate
      ? `"${candidate}" is not a legal move in this position.`
      : `Could not parse a UCI move from "${text.slice(0, 80)}".`;

    // Append the full assistant turn unchanged, then the error, so the retry
    // history stays append-only.
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: `${lastError} Choose one move from this list and reply with only that UCI string: ${turn.legalMoves
        .map((move) => move.uci)
        .join(" ")}`,
    });
  }

  return {
    uci: null,
    modelVersion,
    usage,
    illegalAttempts,
    retries,
    forfeit: true,
    error: `Fable failed to return a legal move after ${MAX_RETRIES_ON_ILLEGAL} retries. Last error: ${lastError}`,
  };
}
