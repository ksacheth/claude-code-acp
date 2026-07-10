import { useEffect } from "react";

import type { ThemeMode } from "./settings";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/// Resolve a mode to a concrete scheme, consulting the OS for "auto".
export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/// Reflect the effective scheme onto <html data-theme>, which the stylesheet
/// keys off. The whole app reads one attribute, so there is a single source of
/// truth for dark vs light.
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = resolveTheme(mode);
}

/// Keep <html data-theme> in sync with the chosen mode. In "auto" it tracks the
/// OS appearance live; explicit modes ignore the system setting.
export function useTheme(mode: ThemeMode): void {
  useEffect(() => {
    applyTheme(mode);
    if (mode !== "auto") return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme(mode);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);
}
