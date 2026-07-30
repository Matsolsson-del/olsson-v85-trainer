import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveGroupId, useRounds } from "@/lib/travhub-queries";
import { formatDate } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/efterrapporter")({
  head: () => ({
    meta: [
      { title: "Efterrapporter – Familjen Olssons Travhub" },
      { name: "description", content: "Strukturerad uppföljning av varje avslutad V85-omgång." },
      { property: "og:title", content: "Efterrapporter – Familjen Olssons Travhub" },
      { property: "og:description", content: "Vad gick rätt, vad gick fel och vad testar vi härnäst." },
    ],
  }),
  component: EfterrapporterPage,
});

function EfterrapporterPage() {
  const { groupId } = useActiveGroupId();
  const { data: rounds } = useRounds(groupId);
  const done = (rounds ?? []).filter((r: any) =>
    ["results_registered", "postmortem", "completed"].includes(r.status),
  );

  return (
    <>
      <PageHeader
        title="Efterrapporter"
        description="Varje avslutad omgång utvärderas med felkategorier, lärdomar och förändringar att testa."
      />
      {done.length === 0 ? (
        <EmptyState title="Inga efterrapporter ännu" description="De skapas när resultat registrerats." />
      ) : (
        <div className="space-y-3">
          {done.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="font-medium">
                  {formatDate(r.race_date)} · {r.tracks?.name ?? "Bana ej vald"}
                </p>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/omgangar/$roundId" params={{ roundId: r.id }}>
                    Öppna
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
