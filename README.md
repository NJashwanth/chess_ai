# AI Chess Benchmark: Jev vs Fable

Two AI models play their own game against identical Stockfish opponents, side by
side, so you can see which one plays more efficiently - not just which one wins,
but what its moves cost in accuracy, latency and dollars.

- **Board A - Jev (TypeSafe AI).** A System One model: it does not generate text.
  Each turn it gets the game state plus one `choice` question -
  *"Which move is best for the side to move?"* - whose options are every legal
  move from chess.js (key = UCI, description = SAN). The app plays whatever it
  picks and records the confidence and top-3 probabilities.
- **Board B - Fable (Anthropic, `claude-fable-5-1`).** The Messages API with the
  system prompt *"You are a chess engine. Reply with only one move in UCI format,
  chosen from the legal moves provided. No explanation."* The reply is validated
  with chess.js; an illegal or unparseable move is retried up to twice with the
  error included, and after that the game is a forfeit loss.

Both models receive **exactly the same state payload** each turn (FEN, side to
move, last 10 moves in SAN, the full legal move list), built in one place -
[`src/lib/state.ts`](src/lib/state.ts) - so only the transport differs.

## Setup

```bash
npm install          # also copies the Stockfish WASM build into public/stockfish
cp .env.example .env.local
# edit .env.local, then:
npm run dev          # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `JEV_PROVIDER` | no | `typesafe` (default) or `openrouter` - which upstream serves Jev. |
| `TYPESAFE_API_KEY` | for Board A | TypeSafe AI key, used when `JEV_PROVIDER=typesafe`. |
| `OPENROUTER_API_KEY` | for Board A | OpenRouter key, used when `JEV_PROVIDER=openrouter`. |
| `JEV_MODEL` | no | Pinned version. `jev-1.13.0` on TypeSafe, `typesafe/jev-1.13` on OpenRouter. |
| `TYPESAFE_BASE_URL` / `OPENROUTER_BASE_URL` | no | Base-URL overrides; the app appends `/v1/systemone`. |
| `ANTHROPIC_API_KEY` | for Board B | Anthropic API key. |
| `FABLE_MODEL` | no | Pinned model, default `claude-fable-5-1`. |
| `FABLE_EFFORT` | no | `low` (default) … `max`. Fable always thinks; low effort keeps a move inside the 30s timeout. |
| `NEXT_PUBLIC_DEBUG` | no | Set to `0` to silence the dev-mode request/response console logging. |

Keys are read only in server routes (`/api/jev`, `/api/fable`) - they never reach
the browser. **A key exported in the shell that starts the dev server overrides
the value in `.env.local`**; if you get a 401 with a key you know is good, check
`printenv ANTHROPIC_API_KEY`.

If one key is missing, that board shows a setup message and **the other board
still runs**.

## How a game is played

1. Pick a Stockfish level in the top bar - Beginner (Skill 1), Casual (5),
   Club (10), Strong (15), Max (20). Both opponents get identical settings and a
   fixed 100 ms movetime, so strength stays consistent.
2. Pick the number of games (1, 5, 10, 20) and optionally **Same openings**, which
   starts game *N* on both boards from the same preset (10 common openings, cycled).
3. Press **Start**. Colours alternate: the AI is White in odd games, Black in even
   games, on both boards.
4. Draws come from chess.js - stalemate, threefold repetition, the 50-move rule,
   insufficient material - plus a 150-full-move cap.

Four Web Workers run at once: a skill-limited Stockfish opponent per board, and a
separate full-strength Stockfish analyser per board. Nothing is shared between
the two matches.

## Metrics

| Group | What is measured |
| --- | --- |
| Results | wins, losses, draws, forfeits, win rate |
| Move quality | average centipawn loss, accuracy %, blunders (>300 cp), mistakes (100-300), inaccuracies (50-100) |
| Speed | average and median response time per move |
| Cost | total, per game, per move and per win, from the token counts each API returns |
| Reliability | illegal move attempts and retries |
| Calibration | Jev's average confidence, and confidence on good moves vs. blunders |

**Centipawn loss** is measured by the analyser worker at depth 14: it evaluates the
position before the AI moves and again afterwards, and the loss is the difference
from the mover's point of view (capped at 1000 cp). **Accuracy** is Lichess'
win-percentage formula applied to those two evaluations.

**Costs** use the token counts in each API response multiplied by the per-million
prices in the **Prices** panel. Fable's defaults are Anthropic's published rates
($10 / $50 per MTok). TypeSafe does not publish Jev token pricing, so its defaults
are placeholders - set your own rate before reading anything into the cost columns.

The **final report** names the most efficient model from a combined score -
win rate (35%), accuracy (35%), speed (15%), cost per win (15%), with speed and
cost scored relative to the other model - and shows all four factors separately so
you can weigh them yourself. **Export CSV** writes the summary, per-game results
and every AI move to one file; each finished game also has its own **Download PGN**
button.

## When an upstream wobbles

TypeSafe returns `429` / `503 no healthy upstream` / `529 system_overloaded` under
load. That is an outage, not a bad move, so it is never scored as a forfeit:

- The API route retries the same request up to 6 times, inside a 30s budget.
  Gateway errors (`502`/`503`/`504`) come back instantly with no work done, so
  those retry after ~250ms - the next attempt often lands on a healthy host.
  `429`/`529` mean the service is shedding load, so those back off exponentially,
  honouring `Retry-After`, capped at 4s per wait: an uncapped curve turns an
  outage into a half-minute sleep inside one request, which just looks frozen.
- If the route still fails, the board retries the whole turn twice more and shows
  an amber "Upstream trouble" note while it does. The other board plays on.
- Only after that does the board stop, keeping every result it has already
  recorded. Press Start again to run a fresh series.

If TypeSafe is having a bad day, `JEV_PROVIDER=openrouter` with an
`OPENROUTER_API_KEY` routes the identical request through OpenRouter instead.

## Notes on the implementation

- **No fallback model on Board B.** Anthropic's server-side `fallbacks` parameter
  would re-run a declined request on a different model. That is deliberately off
  here: every move on Board B has to be Fable's own, or the benchmark stops
  measuring Fable. A refusal is treated like an unparseable answer - retry, then
  forfeit.
- **Stockfish** is the `lite single-threaded` WASM build (`stockfish@19`), which
  needs no cross-origin-isolation headers. `scripts/copy-stockfish.mjs` copies it
  from `node_modules` into `public/stockfish` on install.
- **Pause** stops both boards at the next checkpoint; in-flight API calls and
  engine searches finish first. **Reset** abandons the series and terminates the
  workers.
- In development every request and response is logged to the browser console.

## License

This project's code is released under the [MIT License](LICENSE). The bundled
Stockfish engine is licensed separately, as described below.

## Third-party licenses

- **Stockfish** (`public/stockfish/`) is licensed under the
  [GNU General Public License v3.0](public/stockfish/COPYING.txt). The engine
  files are the unmodified `stockfish@19.0.0` npm build. Source:
  [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) (WebAssembly
  port) and [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish)
  (upstream engine). See [`public/stockfish/README.md`](public/stockfish/README.md).

## Project layout

```
src/app/                  page, layout, and the three API routes (jev, fable, status)
src/components/           top bar, board panels, eval bar, move list, table, chart, report

src/lib/useBenchmark.ts   the two game loops, scoring, series control, and default settings
src/lib/state.ts          the one turn payload both models receive
src/lib/jev.ts            Jev System One client (provider-switchable, retries) - server only
src/lib/fable.ts          Anthropic Messages client (illegal-move retries) - server only
src/lib/route-helpers.ts  request validation, and errors -> HTTP status (400/502/503/504)
src/lib/errors.ts         MissingApiKeyError / UpstreamError classes
src/lib/stockfish.ts      UCI wrapper around one Stockfish Web Worker
src/lib/metrics.ts        centipawn loss, accuracy, move classes, aggregation, combined score
src/lib/pricing.ts        default per-million-token prices and cost maths
src/lib/openings.ts       the 10 preset openings used by "Same openings"
src/lib/csv.ts            Export CSV builder and file download helper
src/lib/types.ts          shared types (moves, turns, game records, settings)
src/lib/debug.ts          dev-only console logging (NEXT_PUBLIC_DEBUG)
src/lib/palette.ts        Jev/Fable series colours for light and dark mode
src/lib/useIsDark.ts      hook that tracks the current theme

scripts/copy-stockfish.mjs  postinstall: copies the Stockfish WASM build and its license
public/stockfish/         the Stockfish engine files (GPL-3.0, third-party)
```

### Where to change things

| To change | Edit |
| --- | --- |
| Default skill level, game count, Same openings, move delay, Stockfish movetime, analysis depth | `DEFAULT_SETTINGS` in `src/lib/useBenchmark.ts` |
| Skill-level presets in the top bar | `SKILL_LEVELS` in `src/lib/useBenchmark.ts` |
| 150-move draw cap / turn retries on upstream trouble | `MAX_FULL_MOVES` / `TURN_ATTEMPTS` in `src/lib/useBenchmark.ts` |
| Default token prices | `DEFAULT_PRICES` in `src/lib/pricing.ts` |
| Blunder / mistake / inaccuracy thresholds, combined-score weights | `src/lib/metrics.ts` |
| Preset openings | `OPENINGS` in `src/lib/openings.ts` |
| What both models are sent each turn | `src/lib/state.ts` |
| Fable's system prompt, timeout, illegal-move retries | `src/lib/fable.ts` |
| Jev request shape, timeout, retry/backoff limits | `src/lib/jev.ts` |

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm start        # serve the production build
npm run lint     # eslint
```
