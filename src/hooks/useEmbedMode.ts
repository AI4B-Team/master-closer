import { useEffect, useState } from "react";

/**
 * Embed mode: Core can frame Master Closer with ?embed=1. The flag sticks for
 * the tab so in-app navigation keeps the chrome suppressed.
 */
const KEY = "mc-embed";

export function useEmbedMode(): boolean {
  const [embed, setEmbed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const param = new URLSearchParams(window.location.search).get("embed");
    let on = window.sessionStorage.getItem(KEY) === "1";
    if (param === "1") {
      on = true;
      window.sessionStorage.setItem(KEY, "1");
    } else if (param === "0") {
      on = false;
      window.sessionStorage.removeItem(KEY);
    }
    setEmbed(on);
    document.documentElement.classList.toggle("mc-embed", on);
  }, []);

  return embed;
}
