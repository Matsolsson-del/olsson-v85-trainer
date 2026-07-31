import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, History, MessageSquare, MoreHorizontal, Users } from "lucide-react";
import { type ReactNode } from "react";
import { useMyProfile } from "@/lib/travhub-queries";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const MAIN_NAV = [
  { to: "/veckans-spel", label: "Veckans spel", icon: CalendarDays },
  { to: "/kommentera", label: "Kommentera", icon: MessageSquare },
  { to: "/historik", label: "Historik", icon: History },
  { to: "/mer", label: "Mer", icon: MoreHorizontal },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: profile } = useMyProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) =>
    to === "/mer"
      ? !MAIN_NAV.slice(0, 3).some((n) => pathname.startsWith(n.to))
      : pathname.startsWith(to);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="flex min-h-dvh">
        {/* Sidomeny på dator */}
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
          <div className="sticky top-0 flex min-h-dvh flex-col">
            <div className="border-b border-sidebar-border px-5 py-5">
              <p className="font-serif text-lg font-semibold text-primary">
                Familjen Olssons Travhub
              </p>
              <p className="mt-0.5 text-sm text-sidebar-foreground/80">V85 tillsammans</p>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Huvudnavigation">
              {MAIN_NAV.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-lg transition-colors",
                    isActive(to)
                      ? "bg-sidebar-accent font-semibold text-primary"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-sidebar-border px-5 py-4">
              <p className="flex items-center gap-2 truncate text-base font-medium">
                <Users className="h-5 w-5 text-primary" aria-hidden />
                {profile?.display_name ?? "Välj person"}
              </p>
              <p className="mt-1 text-sm text-sidebar-foreground/70">
                Byt person under <Link to="/mer" className="underline">Mer</Link>.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 lg:hidden">
            <span className="font-serif text-base font-semibold text-primary">
              Familjen Olssons Travhub
            </span>
            <span className="truncate text-sm text-foreground/70">
              {profile?.display_name ?? ""}
            </span>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Nederkantsmeny på mobil */}
      <nav
        aria-label="Huvudnavigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {MAIN_NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-xs font-medium",
              isActive(to) ? "text-primary" : "text-foreground/70",
            )}
          >
            <Icon className="h-6 w-6" aria-hidden />
            <span className="leading-tight">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-base text-foreground/80">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-surface-foreground/25 bg-surface px-6 py-12 text-center text-surface-foreground">
      <p className="text-lg font-medium">{title}</p>
      {description && <p className="mt-1 text-base text-surface-foreground/80">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
      {label} – kommer i nästa etapp.
    </div>
  );
}
