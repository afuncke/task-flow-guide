import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, Plus } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { GlobalTaskDialog } from "@/components/tasks/GlobalTaskDialog";
import { ContextBar } from "@/components/tasks/ContextBar";
import { taskDialogStore } from "@/lib/tasks/dialog-store";
import { useKeybindings } from "@/hooks/use-keybindings";
import { KeyboardHelp } from "@/components/KeyboardHelp";

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
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
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
      { title: "Shenas — Focus on what's next" },
      { name: "description", content: "A calm task manager that surfaces one thing at a time." },
      { name: "author", content: "Shenas" },
      { property: "og:title", content: "Shenas — Focus on what's next" },
      { property: "og:description", content: "A calm task manager that surfaces one thing at a time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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
  const [helpOpen, setHelpOpen] = useState(false);
  useKeybindings(() => setHelpOpen(true));
  const playful = usePlayful();
  const c = usePlayfulCopy();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-6xl items-center gap-1 px-4">
            <Link to="/plan" className="mr-4 text-sm font-semibold tracking-tight">
              {c("brand")}
            </Link>
            <NavLink to="/plan">{c("plan")}</NavLink>
            <NavLink to="/focus">{c("focus")}</NavLink>
            <NavLink to="/board">{c("board")}</NavLink>
            <NavLink to="/calendar">{c("calendar")}</NavLink>
            <NavLink to="/tasks">{c("all")}</NavLink>
            <div className="ml-auto flex items-center gap-1">
              <PlayfulToggle />
              <button
                onClick={() => setHelpOpen(true)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="h-4 w-4" />
              </button>
              <button
                onClick={() => taskDialogStore.openNew()}
                className={`inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${
                  playful ? "playful-wiggle" : ""
                }`}
                aria-label="New task"
                title="New task (n)"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{c("newTask")}</span>
              </button>
            </div>
          </div>
        </header>

        <ContextBar />
        <Outlet />
        <GlobalTaskDialog />
        <KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
      </div>
    </QueryClientProvider>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "rounded-md px-2.5 py-1 text-sm text-foreground font-medium" }}
    >
      {children}
    </Link>
  );
}
