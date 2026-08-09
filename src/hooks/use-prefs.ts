import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
] as const;
export type LangCode = (typeof LANGUAGES)[number]["code"];

const THEME_KEY = "mc.theme";
const LANG_KEY = "mc.lang";

function applyTheme(theme: Theme) {
  document.documentElement.dataset["mcTheme"] = theme;
}

export function usePrefs() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY);
    const initialTheme: Theme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    const storedLang = localStorage.getItem(LANG_KEY) as LangCode | null;
    if (storedLang && LANGUAGES.some((l) => l.code === storedLang)) {
      setLangState(storedLang);
      document.documentElement.lang = storedLang;
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }, []);

  const setLang = useCallback((next: LangCode) => {
    setLangState(next);
    localStorage.setItem(LANG_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const langLabel = LANGUAGES.find((l) => l.code === lang)?.label ?? "English";

  return { theme, setTheme, lang, setLang, langLabel };
}
