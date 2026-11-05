// Copies the single-threaded Stockfish WASM build out of node_modules into
// public/stockfish so it can be loaded as a Web Worker from the browser.
// The "lite single" flavour needs no cross-origin-isolation headers.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const from = path.join(root, "node_modules", "stockfish", "bin");
const to = path.join(root, "public", "stockfish");

const files = ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"];

if (!existsSync(from)) {
  console.warn("[stockfish] node_modules/stockfish/bin not found - run npm install first.");
  process.exit(0);
}

mkdirSync(to, { recursive: true });
for (const file of files) {
  copyFileSync(path.join(from, file), path.join(to, file));
  console.log(`[stockfish] copied ${file}`);
}
