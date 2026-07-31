import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Coins,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Menu,
  Settings,
  Grid3x3,
  Sparkles,
  Trophy,
  Users,
  Workflow,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveGroupId, useIsOwner, useMyProfile } from "@/lib/travhub-queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lockFamily } from "@/lib/gate.functions";
import { forgetPerson } from "@/lib/person-memory";

const SIMPLE_NAV = [
  { to: "/veckans-spel", label: "Veckans spel", icon: CalendarDays },
  { to: "/oversikt", label: "Översikt", icon: LayoutDashboard },
  { to: "/experttips", label: "Experttips", icon: Newspaper },
  { to: "/kommentera", label: "Kommentera", icon: MessageSquare },
  { to: "/resultat", label: "Resultat", icon: Trophy },
  { to: "/historik", label: "Historik", icon: History },
] as const;

const ADVANCED_NAV = [
  { to: "/omgangar", label: "Omgångar i hubben", icon: History },
  { to: "/analysera", label: "Analysera", icon: ClipboardList },
  { to: "/system", label: "System", icon: Grid3x3 },
  { to: "/efterrapporter", label: "Efterrapporter", icon: FileText },
  { to: "/larande", label: "Lärande", icon: BarChart3 },
  { to: "/mina-rad", label: "Mina råd", icon: Sparkles },
  { to: "/automation", label: "Automation", icon: Workflow },
  { to: "/ai-import", label: "AI-import", icon: Sparkles },
  { to: "/historikimport", label: "Historikimport", icon: History },
  { to: "/ekonomi", label: "Ekonomi", icon: Coins },
  { to: "/installningar", label: "Inställningar", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: profile } = useMyProfile();
  const { groupId } = useActiveGroupId();
  const isOwner = useIsOwner(groupId);
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lockFn = useServerFn(lockFamily);

  const advancedVisible = isOwner || showAdvanced;
  const items = [...SIMPLE_NAV, ...(advancedVisible ? ADVANCED_NAV : [])];

  async function switchPerson() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { byt: true }, replace: true });
  }

  async function signOutCompletely() {
    await qc.cancelQueries();
    qc.clear();
    forgetPerson();
    await supabase.auth.signOut();
    try {
      await lockFn();
    } catch {
      /* sessionen rensas ändå på klienten */
    }
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="flex min-h-dvh">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex min-h-full flex-col">
            <div className="border-b border-sidebar-border px-5 py-5">
              <p className="font-serif text-lg font-semibold text-primary">
                Familjen Olssons Travhub
              </p>
              <p className="mt-0.5 text-sm text-sidebar-foreground/80">V85-analys och lärande</p>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Huvudnavigation">
              {items.map(({ to, label, icon: Icon }) => {
                const active = pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-base transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-primary"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    {label}
                  </Link>
                );
              })}

              {!isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-start px-3 text-sidebar-foreground/70"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? "Dölj avancerat" : "Visa avancerat"}
                </Button>
              )}
            </nav>

            <div className="border-t border-sidebar-border px-4 py-4">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                <Users className="h-4 w-4 text-primary" aria-hidden />
                {profile?.display_name ?? "Välj person"}
              </p>
              <Button
                variant="secondary"
                className="mt-3 w-full justify-start"
                onClick={switchPerson}
              >
                Byt person
              </Button>
              <Button
                variant="ghost"
                className="mt-2 w-full justify-start px-2 text-sidebar-foreground/85 hover:bg-sidebar-accent"
                onClick={signOutCompletely}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden />
                Logga ut från Travhubben
              </Button>
            </div>
          </div>
        </aside>

        {open && (
          <button
            aria-label="Stäng meny"
            className="fixed inset-0 z-30 bg-foreground/50 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background px-4 py-3 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={() => setOpen(true)}
              aria-label="Öppna meny"
              aria-expanded={open}
            >
              <Menu className="h-6 w-6" aria-hidden />
            </Button>
            <span className="font-serif font-semibold text-primary">Familjen Olssons Travhub</span>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
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
