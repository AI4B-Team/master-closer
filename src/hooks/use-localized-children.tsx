import * as React from "react";
import { usePrefs } from "@/hooks/use-prefs";

/**
 * Routes plain-string children of shared UI primitives through the
 * translation layer, preserving surrounding whitespace.
 */
export function useLocalizedChildren(children: React.ReactNode): React.ReactNode {
  const { t } = usePrefs();

  const localize = React.useCallback(
    (value: string) => {
      const label = value.trim();
      if (!label) return value;
      const lead = value.slice(0, value.indexOf(label[0]!));
      const tail = value.slice(lead.length + label.length);
      return `${lead}${t(label)}${tail}`;
    },
    [t],
  );

  if (typeof children === "string") return localize(children);
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? <React.Fragment key={i}>{localize(child)}</React.Fragment> : child,
    );
  }
  return children;
}
