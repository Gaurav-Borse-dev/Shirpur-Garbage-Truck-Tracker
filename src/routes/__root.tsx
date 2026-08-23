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
import { reportShirpurError } from "../lib/shirpur-error-reporting";
import { AppSplash } from "@/components/AppSplash";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ClientOnly } from "@/components/ClientOnly";
import { installPushRetry } from "@/lib/push-client";
import { startForegroundPush } from "@/lib/push-foreground";
import { ToastHost } from "@/components/Toast";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
    reportShirpurError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CleanTrack — Live garbage truck tracking" },
      { name: "description", content: "Track your municipal garbage truck in real time across Shirpur." },
      { property: "og:site_name", content: "CleanTrack" },
      { property: "og:title", content: "CleanTrack — Live Garbage Truck Tracking" },
      {
        property: "og:description",
        content:
          "Follow Shirpur's municipal garbage trucks live on a map, get arrival alerts for your street, and book community dustbins in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CleanTrack — Live Garbage Truck Tracking" },
      {
        name: "twitter:description",
        content:
          "Live garbage truck tracking and collection alerts for residents of Shirpur, Maharashtra.",
      },
      { name: "twitter:site", content: "@Shirpur" },
      { name: "theme-color", content: "#ffffff" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "GovernmentOrganization",
          name: "Shirpur Municipal Corporation",
          alternateName: "CleanTrack — Shirpur Municipal Corporation",
          url: "https://street-scan-track.shirpur.app",
          areaServed: {
            "@type": "City",
            name: "Shirpur",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Shirpur",
              addressRegion: "Maharashtra",
              addressCountry: "IN",
            },
          },
        }),
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

function PushRuntime() {
  useEffect(() => {
    installPushRetry();
    return startForegroundPush();
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppSplash>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <LanguageSwitcher />
        <ToastHost />
        <ClientOnly>
          <PushRuntime />
        </ClientOnly>
      </AppSplash>
    </QueryClientProvider>
  );
}
