"use client";

import { useEffect, useState } from "react";

/** Tracks the resolved theme: the .dark/.light stamp, else the OS setting. */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const resolve = () => {
      if (root.classList.contains("dark")) return true;
      if (root.classList.contains("light")) return false;
      return media.matches;
    };

    const update = () => setIsDark(resolve());
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    media.addEventListener("change", update);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  return isDark;
}
