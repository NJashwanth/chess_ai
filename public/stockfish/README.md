# Stockfish (third-party)

The files in this folder are the Stockfish chess engine, compiled to
WebAssembly. They are **not** part of this project's own code.

- `stockfish-19-lite-single.js`, `stockfish-19-lite-single.wasm`: Stockfish 19,
  "lite single-threaded" build, from the
  [`stockfish`](https://www.npmjs.com/package/stockfish) npm package, version
  19.0.0.
- License: GNU General Public License v3.0. The full text is in
  [`COPYING.txt`](./COPYING.txt).
- Source code:
  - WebAssembly port (stockfish.js): https://github.com/nmrugg/stockfish.js
  - Upstream engine: https://github.com/official-stockfish/Stockfish

The files are copied here unmodified by `scripts/copy-stockfish.mjs` when you
run `npm install`.
