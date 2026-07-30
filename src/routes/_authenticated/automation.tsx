import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/labels";
import { useActiveGroupId } from "@/lib/travhub-queries";
import { useJobRuns, useJobs } from "@/lib/responsibility-queries";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({
    meta: [
      { title: "Automation – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Veckans körningsplan, jobbstatus, fel och manuella uppgifter.",
      },
      { property: "og:title", content: "Automation – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Övervaka automatiska körningar för V85-omgångarna.",
      },
    ],
  }),
  component: AutomationPage,
});

const STATUS_LABELS: Record<string, string> = {
  running: "Pågår",
  success: "Klar",
  failed: "Misslyckad",
  needs_manual: "Kräver manuell åtgärd",
};

function AutomationPage() {
  const { groupId } = useActiveGroupId();
  const { data: jobs } = useJobs(groupId);
  const { data: runs } = useJobRuns(groupId);

  const failed = (runs ?? []).filter(
    (r) => r.status === "failed" || r.status === "needs_manual",
  );

  return (
    <>
      <PageHeader
        title="Automation"
        description="Körningsplan, senaste jobb och manuella uppgifter."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Veckans körningsplan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(jobs ?? []).length === 0 ? (
              <p className="text-muted-foreground">
                Inga automationsjobb är konfigurerade ännu. Jobben aktiveras i nästa etapp
                (källadaptrar och AI-analys).
              </p>
            ) : (
              (jobs ?? []).map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{j.job_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {j.schedule_cron ?? "Manuell körning"}
                    </p>
                  </div>
                  <Badge variant={j.active ? "secondary" : "outline"}>
                    {j.active ? "Aktivt" : "Pausat"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Manuella uppgifter och fel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {failed.length === 0 ? (
              <p className="text-muted-foreground">Inga misslyckade körningar.</p>
            ) : (
              failed.map((r) => (
                <div key={r.id} className="rounded-md border p-2">
                  <p className="font-medium">{r.job_type}</p>
                  <p className="text-xs text-destructive">{r.error_message ?? "Okänt fel"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(r.started_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Senaste körningar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(runs ?? []).length === 0 ? (
              <p className="text-muted-foreground">Inga körningar loggade ännu.</p>
            ) : (
              (runs ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3">
                  <span>{r.job_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(r.started_at)}
                  </span>
                  <Badge variant="outline">{STATUS_LABELS[r.status] ?? r.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
