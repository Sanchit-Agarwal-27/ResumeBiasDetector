import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "biaslens_theme";

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved && (saved === "light" || saved === "dark" || saved === "system")) {
      return saved;
    }
  } catch {
    // ignore local storage errors
  }
  return "system";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent("biaslens-theme-change", { detail: { theme, isDark } }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const initial = getInitialTheme();
    if (initial === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return initial;
  });

  useEffect(() => {
    applyTheme(theme);

    const updateResolved = () => {
      const isDark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setResolvedTheme(isDark ? "dark" : "light");
    };

    updateResolved();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (theme === "system") {
        applyTheme("system");
        updateResolved();
      }
    };

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    applyTheme(next);
  };

  return { theme, setTheme, resolvedTheme };
}
