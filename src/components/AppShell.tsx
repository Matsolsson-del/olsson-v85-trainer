import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Coins,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Grid3x3,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveGroupId } from "@/lib/travhub-queries";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Workflow } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NAV = [
  { to: "/oversikt", label: "Översikt", icon: LayoutDashboard },
  { to: "/omgangar", label: "Omgångar", icon: CalendarDays },
  { to: "/analysera", label: "Analysera", icon: ClipboardList },
  { to: "/system", label: "System", icon: Grid3x3 },
  { to: "/efterrapporter", label: "Efterrapporter", icon: FileText },
  { to: "/larande", label: "Lärande", icon: BarChart3 },
  { to: "/mina-rad", label: "Mina råd", icon: Sparkles },
  { to: "/automation", label: "Automation", icon: Workflow },
  { to: "/ekonomi", label: "Ekonomi", icon: Coins },
  { to: "/installningar", label: "Inställningar", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { groupId, setActiveGroupId, groups } = useActiveGroupId();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-sidebar-border px-5 py-5">
              <p className="font-serif text-lg font-semibold text-primary">Familjen Olssons Travhub</p>
              <p className="mt-0.5 text-xs text-sidebar-foreground/70">V85-analys och lärande</p>
            </div>

            {groups.length > 0 && (
              <div className="px-4 py-4">
                <label className="mb-1.5 block text-xs text-sidebar-foreground/70">Grupp</label>
                <Select value={groupId ?? undefined} onValueChange={setActiveGroupId}>
                  <SelectTrigger className="w-full border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
                    <SelectValue placeholder="Välj grupp" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <nav className="flex-1 space-y-1 px-3 pb-4" aria-label="Huvudnavigation">
              {NAV.map(({ to, label, icon: Icon }) => {
                const active = pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-primary"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-sidebar-border px-4 py-4">
              <p className="truncate text-xs text-sidebar-foreground/70">
                {(user?.user_metadata as any)?.display_name ?? user?.email}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start px-2 text-sidebar-foreground/85 hover:bg-sidebar-accent"
                onClick={() => supabase.auth.signOut()}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden />
                Byt användare
              </Button>
            </div>

          </div>
        </aside>

        {open && (
          <button
            aria-label="Stäng meny"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Öppna meny">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-serif font-semibold text-primary">Familjen Olssons Travhub</span>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
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
        <h1 className="font-serif text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-white/70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-white/20 bg-surface/60 px-6 py-12 text-center">
      <p className="font-medium text-white">{title}</p>
      {description && <p className="mt-1 text-sm text-white/70">{description}</p>}
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
