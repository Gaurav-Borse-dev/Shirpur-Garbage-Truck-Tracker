type ShirpurErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type ShirpurEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: ShirpurErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __shirpurEvents?: ShirpurEvents;
  }
}

export function reportShirpurError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__shirpurEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
