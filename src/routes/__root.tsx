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
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

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
  // Message only — never dump raw error objects that may carry request/key material
  console.error(error?.name || "Error", error?.message || "Unknown error");
  const router = useRouter();

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
      { title: "BLX Realty Payroll Suite" },
      { name: "description", content: "BLX Realty Enterprise Payroll & Payslip Management System" },
      { name: "author", content: "BLX Realty" },
      { property: "og:title", content: "BLX Realty Payroll Suite" },
      { property: "og:description", content: "BLX Realty Enterprise Payroll & Payslip Management System" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/images.png", type: "image/png" },
      { rel: "shortcut icon", href: "/images.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/images.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

import { ThemeProvider } from "@/components/theme-provider";

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("blx_theme");var d=document.documentElement;if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches)){d.classList.add("dark")}else{d.classList.remove("dark")}}catch(e){}window.onerror=function(msg,url,l,c,err){var s=String(msg||"")+" "+String(err?.message||"");if(s.indexOf("startTime")!==-1||s.indexOf("reportAllChanges")!==-1){return true;}};window.addEventListener("error",function(e){if(e?.error?.message?.includes("startTime")||e?.message?.includes("startTime")||e?.message?.includes("reportAllChanges")){e.preventDefault();e.stopImmediatePropagation();return true;}},true);window.addEventListener("unhandledrejection",function(e){if(e?.reason?.message?.includes("startTime")||e?.reason?.message?.includes("reportAllChanges")){e.preventDefault();return true;}},true);})()`,
          }}
        />
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
    <ThemeProvider defaultTheme="system" storageKey="blx_theme">
      <QueryClientProvider client={queryClient}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
