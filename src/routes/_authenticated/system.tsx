import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveGroupId, useRounds } from "@/lib/travhub-queries";
import { formatDate } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/system")({
  head: () => ({
    meta: [
      { title: "System – Travhubben" },
      { name: "description", content: "Bygg, kontrollera och lås V85-system inom budget." },
      { property: "og:title", content: "System – Travhubben" },
      { property: "og:description", content: "Systembyggare med radmatematik och spikprotokoll." },
    ],
  }),
  component: SystemPage,
});

function SystemPage() {
  const { groupId } = useActiveGroupId();
  const { data: rounds } = useRounds(groupId);
  const open = (rounds ?? []).filter((r: any) => r.status !== "completed");

  return (
    <>
      <PageHeader
        title="System"
        description="Systembyggaren finns inuti varje omgång, tillsammans med budgetkontroll och spikprotokoll."
      />
      {open.length === 0 ? (
        <EmptyState title="Ingen omgång att bygga system för" />
      ) : (
        <div className="space-y-3">
          {open.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">
                    {formatDate(r.race_date)} · {r.tracks?.name ?? "Bana ej vald"}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    Budget {Number(r.budget)} kr
                  </Badge>
                </div>
                <Button asChild size="sm">
                  <Link to="/omgangar/$roundId" params={{ roundId: r.id }}>
                    Till systembyggaren
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
