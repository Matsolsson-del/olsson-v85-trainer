import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/labels";
import {
  getAutomationOverview,
  runAutomationNow,
  setSourceEnabled,
} from "@/lib/automation-admin.functions";
import { FACTS_STATUS_LABEL, SOURCE_STATUS_LABEL } from "@/lib/automation-core";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({
    meta: [
      { title: "Automatisk hämtning – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Se om veckans V85-underlag och experttipsen har hämtats, vilka källor som svarat och vad som ändrats.",
      },
      { property: "og:title", content: "Automatisk hämtning – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Status för torsdagens automatiska hämtning av V85-underlag och experttips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationPage,
});

const RUN_STATUS: Record<string, string> = {
  running: "Pågår",
  success: "Klar",
  partial: "Delvis klar",
  waiting: "Väntar på underlag",
  failed: "Misslyckades",
  skipped: "Hoppades över",
};

const MODE_LABEL: Record<string, string> = {
  full: "Full hämtning",
  followup: "Efterhämtning av tips",
  facts: "Bara tävlingsfakta",
  tips: "Bara experttips",
};

function statusTone(status: string) {
  if (status === "ok" || status === "ready" || status === "success") return "default";
  if (status === "temporary_error" || status === "permanent_error" || status === "failed")
    return "destructive";
  return "secondary";
}

function AutomationPage() {
  const load = useServerFn(getAutomationOverview);
  const run = useServerFn(runAutomationNow);
  const toggle = useServerFn(setSourceEnabled);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["automation-overview"],
    queryFn: () => load({}),
    refetchInterval: 30_000,
  });

  async function handleRun(mode: "full" | "facts" | "tips") {
    setBusy(mode);
    const id = toast.loading("Hämtar underlag … det kan ta någon minut.");
    try {
      const res: any = await run({ data: { mode } });
      toast.success(res.message ?? "Hämtningen är klar.", { id });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Hämtningen misslyckades.", { id });
    } finally {
      setBusy(null);
    }
  }

  async function handleToggle(sourceKey: string, enabled: boolean) {
    try {
      await toggle({ data: { sourceKey, enabled } });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte ändra källan.");
    }
  }

  const changes = data?.changes ?? [];
  const importantChanges = changes.filter((c: any) => c.important);

  return (
    <>
      <PageHeader
        title="Automatisk hämtning"
        description="Varje torsdag klockan 07:00 hämtas lördagens V85 och experttipsen automatiskt."
        actions={
          <Button
            onClick={() => handleRun("full")}
            disabled={busy !== null}
            className="h-12"
          >
            {busy === "full" ? "Hämtar …" : "Hämta allt nu"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status för lördagens omgång</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading ? (
              <p className="text-muted-foreground">Hämtar status …</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusTone(data?.factsStatus ?? "") as any}>
                    {FACTS_STATUS_LABEL[data?.factsStatus ?? "waiting"]}
                  </Badge>
                  <span className="text-muted-foreground">
                    {data?.round
                      ? `${data.round.trackName ?? "Okänd bana"} ${data.saturday} – ${data.round.races} avdelningar, ${data.round.entries} startande.`
                      : `Ingen omgång hämtad för ${data?.saturday} ännu.`}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {data?.sourceSummary?.withTips ?? 0} av {data?.sourceSummary?.checked ?? 0}{" "}
                  källor har publicerat tips. Nästa automatiska körning:{" "}
                  {data?.nextRun ? formatDateTime(data.nextRun) : "–"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="h-11"
                    onClick={() => handleRun("facts")}
                    disabled={busy !== null}
                  >
                    {busy === "facts" ? "Hämtar …" : "Hämta bara tävlingsfakta"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-11"
                    onClick={() => handleRun("tips")}
                    disabled={busy !== null}
                  >
                    {busy === "tips" ? "Hämtar …" : "Hämta bara experttips"}
                  </Button>
                  <Button asChild variant="outline" className="h-11">
                    <Link to="/ai-import">Öppna AI-import</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Experttipskällor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.sources ?? []).length === 0 ? (
              <p className="text-muted-foreground">Källorna registreras vid första körningen.</p>
            ) : (
              (data?.sources ?? []).map((s: any) => (
                <div key={s.key} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_STATUS_LABEL[s.status as keyof typeof SOURCE_STATUS_LABEL] ?? s.status}
                      {s.tips > 0 ? ` – ${s.tips} tips` : ""}
                      {s.lastCheckedAt ? ` – ${formatDateTime(s.lastCheckedAt)}` : ""}
                    </p>
                    {s.message ? (
                      <p className="text-xs text-muted-foreground">{s.message}</p>
                    ) : null}
                  </div>
                  <Switch
                    checked={s.status !== "access_denied"}
                    onCheckedChange={(v) => handleToggle(s.key, v)}
                    aria-label={`Slå på eller av ${s.name}`}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ändringar i underlaget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {changes.length === 0 ? (
              <p className="text-muted-foreground">Inga ändringar sedan förra hämtningen.</p>
            ) : (
              <>
                {importantChanges.length > 0 ? (
                  <p className="rounded-md bg-muted p-2 text-xs">
                    {importantChanges.length} viktig(a) ändring(ar) – kontrollera systemet innan
                    spelstopp.
                  </p>
                ) : null}
                {changes.slice(0, 12).map((c: any) => (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <span>{c.description}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(c.created_at)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Senaste körningar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.runs ?? []).length === 0 ? (
              <p className="text-muted-foreground">Inga körningar loggade ännu.</p>
            ) : (
              (data?.runs ?? []).map((r: any) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                >
                  <span>{MODE_LABEL[r.mode] ?? r.mode}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(r.started_at)} – {r.races_imported} avd, {r.entries_imported}{" "}
                    startande, {r.tips_imported} tips
                  </span>
                  <Badge variant={statusTone(r.status) as any}>
                    {RUN_STATUS[r.status] ?? r.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
