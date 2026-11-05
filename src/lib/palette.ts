import type { ModelId } from "./types";

/**
 * Categorical slots 1 and 2 of the validated default palette - blue for Jev,
 * orange for Fable - with the dark-mode steps of the same hues. The pair
 * clears the lightness, chroma, CVD-separation, normal-vision and contrast
 * checks on both surfaces.
 */
export const SERIES_COLOR: Record<ModelId, { light: string; dark: string }> = {
  jev: { light: "#2a78d6", dark: "#3987e5" },
  fable: { light: "#eb6834", dark: "#d95926" },
};

/** Tailwind-side accents kept in sync with the series colors. */
export const SERIES_CLASS: Record<
  ModelId,
  { text: string; bg: string; border: string; dot: string }
> = {
  jev: {
    text: "text-[#2a78d6] dark:text-[#3987e5]",
    bg: "bg-[#2a78d6]/10 dark:bg-[#3987e5]/15",
    border: "border-[#2a78d6]/40 dark:border-[#3987e5]/40",
    dot: "bg-[#2a78d6] dark:bg-[#3987e5]",
  },
  fable: {
    text: "text-[#eb6834] dark:text-[#d95926]",
    bg: "bg-[#eb6834]/10 dark:bg-[#d95926]/15",
    border: "border-[#eb6834]/40 dark:border-[#d95926]/40",
    dot: "bg-[#eb6834] dark:bg-[#d95926]",
  },
};
