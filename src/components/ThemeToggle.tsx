"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "chess-benchmark-theme";

/** The <html> class is the source of truth; the store just mirrors it. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  return "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (theme !== "system") root.classList.add(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode - the media query still applies */
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "system" as Theme);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line p-0.5 text-xs">
      {(["light", "system", "dark"] as Theme[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => apply(option)}
          className={`rounded-md px-2 py-1 capitalize transition-colors ${
            theme === option
              ? "bg-violet-600 text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
