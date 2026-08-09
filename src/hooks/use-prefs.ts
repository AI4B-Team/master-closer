import { useCallback, useEffect, useSyncExternalStore } from "react";
import { translate, type LangCode } from "@/lib/i18n";

export type Theme = "light" | "dark";
export type { LangCode };

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
] as const;

const THEME_KEY = "mc.theme";
const LANG_KEY = "mc.lang";

/* ---- module-level store so every component reacts to pref changes ---- */
type State = { theme: Theme; lang: LangCode };
let state: State = { theme: "light", lang: "en" };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const getSnapshot = () => state;
const getServerSnapshot = () => state;

function applyTheme(theme: Theme) {
  document.documentElement.dataset["mcTheme"] = theme;
}

function readStored(): State {
  if (typeof window === "undefined") return { theme: "light", lang: "en" };
  const storedTheme = localStorage.getItem(THEME_KEY);
  const theme: Theme =
    storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  const storedLang = localStorage.getItem(LANG_KEY) as LangCode | null;
  const lang: LangCode =
    storedLang && LANGUAGES.some((l) => l.code === storedLang) ? storedLang : "en";
  return { theme, lang };
}

/*
 * Stored prefs are read once at module load on the client, before any component
 * renders. Notifying subscribers from an effect instead would fire mid-commit,
 * while sibling components are rendered but not yet mounted, which React
 * reports as "state update on a component that hasn't mounted yet".
 * getServerSnapshot keeps SSR/hydration on the defaults, so React reconciles
 * to the stored values right after mount without a mismatch.
 */
if (typeof window !== "undefined") {
  state = readStored();
}

export function usePrefs() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(snap.theme);
    document.documentElement.lang = snap.lang;
  }, [snap.theme, snap.lang]);


  const setTheme = useCallback((next: Theme) => {
    state = { ...state, theme: next };
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    emit();
  }, []);

  const setLang = useCallback((next: LangCode) => {
    state = { ...state, lang: next };
    localStorage.setItem(LANG_KEY, next);
    document.documentElement.lang = next;
    emit();
  }, []);

  const t = useCallback((key: string) => translate(snap.lang, key), [snap.lang]);

  const langLabel = LANGUAGES.find((l) => l.code === snap.lang)?.label ?? "English";

  return { theme: snap.theme, setTheme, lang: snap.lang, setLang, langLabel, t };
}

/** Standalone translator hook for components that only need copy. */
export function useT() {
  return usePrefs().t;
}
