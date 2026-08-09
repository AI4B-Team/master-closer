import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

const SHELL: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0B0B0E",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 20px",
  fontFamily: "Inter, system-ui, sans-serif",
};

const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#CC0000",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  padding: "12px 22px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
};

const BTN_GHOST: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: "transparent",
  color: "rgba(255,255,255,.85)",
  border: "1px solid rgba(255,255,255,.18)",
};

function BrandMark() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        letterSpacing: ".16em",
        fontWeight: 700,
        color: "rgba(255,255,255,.55)",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: "#CC0000", display: "inline-block" }} />
      MASTER CLOSER
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div style={SHELL}>
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <BrandMark />
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            margin: "22px 0 6px",
            color: "#CC0000",
          }}
        >
          404
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
          This Page Isn't On The Line
        </h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: 16, lineHeight: 1.7, margin: "0 0 26px" }}>
          The page you're looking for doesn't exist or has moved. Head back home or jump into your workspace.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/" style={BTN_PRIMARY}>
            Back To Home
          </Link>
          <Link to="/dashboard" style={BTN_GHOST}>
            Go To Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div style={SHELL}>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <BrandMark />
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.025em", margin: "22px 0 10px" }}>
          Call Dropped
        </h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: 16, lineHeight: 1.7, margin: "0 0 26px" }}>
          Something went wrong loading this page. Try again — if it keeps happening, reach out and we'll dig in.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            style={BTN_PRIMARY}
          >
            Try Again
          </button>
          <a href="/" style={BTN_GHOST}>
            Back To Home
          </a>
        </div>
        {error?.message ? (
          <p
            style={{
              marginTop: 28,
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              color: "rgba(255,255,255,.3)",
              wordBreak: "break-word",
            }}
          >
            {error.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Master Closer — AI That Closes Calls" },
      {
        name: "description",
        content:
          "Master Closer runs your sales calls end to end, hands off to a human closer, or whispers the next best line while your rep talks.",
      },
      { property: "og:title", content: "Master Closer — AI That Closes Calls" },
      {
        property: "og:description",
        content: "AI, Hybrid, or Copilot. One dialer, every call, fully logged and compliant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
