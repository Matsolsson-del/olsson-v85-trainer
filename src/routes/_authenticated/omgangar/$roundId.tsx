import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUND_STATUS_LABELS, formatCurrency, formatDate, formatDateTime } from "@/lib/labels";
import { useRoundData } from "@/lib/travhub-queries";
import { StartfaltTab } from "@/components/round/StartfaltTab";
import { DataTab } from "@/components/round/DataTab";
import { AnalysTab } from "@/components/round/AnalysTab";
import { SystemTab } from "@/components/round/SystemTab";
import { ResultatTab } from "@/components/round/ResultatTab";
import { ResponsibilityCard } from "@/components/round/ResponsibilityCard";
import { AutomatikCard } from "@/components/round/AutomatikCard";

export const Route = createFileRoute("/_authenticated/omgangar/$roundId")({
  head: () => ({
    meta: [
      { title: "Omgång – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Startfält, blindanalys, gruppbedömning, systembyggare och efterrapport.",
      },
      { property: "og:title", content: "Omgång – Familjen Olssons Travhub" },
      { property: "og:description", content: "Arbetsytan för en V85-omgång." },
    ],
  }),
  component: RoundDetail,
});

function RoundDetail() {
  const { roundId } = Route.useParams();
  const { data, isLoading, error } = useRoundData(roundId);
  const isOwner = useIsOwner(data?.round.group_id ?? null);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data)
    return <p className="text-sm text-destructive">Kunde inte ladda omgången.</p>;

  const { round } = data;

  return (
    <>
      <PageHeader
        title={`${formatDate(round.race_date)} · ${(round as any).tracks?.name ?? "Bana ej vald"}`}
        description={`Spelstopp ${formatDateTime(round.bet_stop_at)} · Budget ${formatCurrency(
          Number(round.budget),
        )} · Radpris ${formatCurrency(Number(round.row_price))}`}
        actions={
          <>
            <Badge variant="secondary">{ROUND_STATUS_LABELS[round.status] ?? round.status}</Badge>
            <Button asChild variant="secondary" size="sm">
              <Link to="/omgangar">Tillbaka</Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 space-y-4">
        <ResponsibilityCard roundId={roundId} groupId={round.group_id} />
        {isOwner && <AutomatikCard roundId={roundId} />}
      </div>

      <Tabs defaultValue="startfalt">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="startfalt">Startfält</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="resultat">Resultat &amp; efterrapport</TabsTrigger>
          {isOwner && <TabsTrigger value="data">Data &amp; kvalitet</TabsTrigger>}
          {isOwner && <TabsTrigger value="analys">Analys</TabsTrigger>}
        </TabsList>

        <TabsContent value="startfalt" className="pt-4">
          <StartfaltTab data={data} roundId={roundId} />
        </TabsContent>
        <TabsContent value="system" className="pt-4">
          <SystemTab data={data} roundId={roundId} />
        </TabsContent>
        <TabsContent value="resultat" className="pt-4">
          <ResultatTab data={data} roundId={roundId} />
        </TabsContent>
        {isOwner && (
          <>
            <TabsContent value="data" className="pt-4">
              <DataTab data={data} roundId={roundId} />
            </TabsContent>
            <TabsContent value="analys" className="pt-4">
              <AnalysTab data={data} roundId={roundId} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}
    </>
  );
}
