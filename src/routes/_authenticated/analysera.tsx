import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveGroupId, useRounds } from "@/lib/travhub-queries";
import { ROUND_STATUS_LABELS, formatDate } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/analysera")({
  beforeLoad: () => {
    throw redirect({ to: "/veckans-spel" });
  },
  head: () => ({
    meta: [
      { title: "Analysera – Familjen Olssons Travhub" },
      { name: "description", content: "Gå direkt till analysen för pågående V85-omgång." },
      { property: "og:title", content: "Analysera – Familjen Olssons Travhub" },
      { property: "og:description", content: "Blindanalys per avdelning inför spelstopp." },
    ],
  }),
  component: AnalyseraPage,
});

function AnalyseraPage() {
  const { groupId } = useActiveGroupId();
  const { data: rounds } = useRounds(groupId);
  const open = (rounds ?? []).filter((r: any) => r.status !== "completed");

  return (
    <>
      <PageHeader
        title="Analysera"
        description="Öppna en omgång och lämna din egen bedömning innan analyserna avslöjas."
      />
      {open.length === 0 ? (
        <EmptyState title="Inga öppna omgångar att analysera" />
      ) : (
        <div className="space-y-3">
          {open.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">
                    {formatDate(r.race_date)} · {r.tracks?.name ?? "Bana ej vald"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ROUND_STATUS_LABELS[r.status] ?? r.status}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link to="/omgangar/$roundId" params={{ roundId: r.id }}>
                    Till analysen
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
