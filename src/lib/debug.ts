/**
 * Every request and response is logged to the browser console in development.
 * Set NEXT_PUBLIC_DEBUG=0 to silence it.
 */
export const DEBUG =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG !== "0";

export function debugLog(scope: string, ...args: unknown[]) {
  if (!DEBUG) return;
  console.log(`%c[${scope}]`, "color:#7c3aed;font-weight:bold", ...args);
}

/** Server-side counterpart - keeps API route logging out of production output. */
export function serverLog(scope: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`[${scope}]`, ...args);
}
