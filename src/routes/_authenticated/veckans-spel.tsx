import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveGroupId, useRounds } from "@/lib/travhub-queries";
import { formatDate, formatDateTime } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/veckans-spel")({
  head: () => ({
    meta: [
      { title: "Veckans spel – Familjen Olssons Travhub" },
      { name: "description", content: "Öppna den V85-omgång familjen spelar den här veckan." },
      { property: "og:title", content: "Veckans spel – Familjen Olssons Travhub" },
      { property: "og:description", content: "Genvägen till veckans V85-omgång." },
    ],
  }),
  component: VeckansSpel,
});

function VeckansSpel() {
  const { groupId } = useActiveGroupId();
  const { data: rounds, isLoading, error } = useRounds(groupId);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Veckans spel" />
        <Skeleton className="h-40 w-full" />
      </>
    );
  }

  const active = rounds?.find((r) => r.status !== "completed") ?? null;

  return (
    <>
      <PageHeader title="Veckans spel" />
      {error ? (
        <EmptyState title="Det gick inte att hämta omgången" description="Prova att ladda om sidan." />
      ) : !active ? (
        <EmptyState
          title="Ingen omgång den här veckan ännu"
          description="Omgången hämtas automatiskt på torsdagar."
          action={
            <Button asChild size="lg">
              <Link to="/omgangar">Se tidigare omgångar</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-white/10 bg-card p-6">
          <p className="text-2xl font-semibold">
            {formatDate(active.race_date)} · {(active as any).tracks?.name ?? "Bana ej vald"}
          </p>
          <p className="mt-1 text-base text-muted-foreground">
            Spelstopp {formatDateTime(active.bet_stop_at)}
          </p>
          <Button asChild size="lg" className="mt-4 h-14 w-full text-lg sm:w-auto">
            <Link to="/omgangar/$roundId" params={{ roundId: active.id }}>
              Öppna omgången
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
