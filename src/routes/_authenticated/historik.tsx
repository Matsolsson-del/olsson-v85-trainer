import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/labels";
import { useActiveGroupId, useIsOwner } from "@/lib/travhub-queries";
import { listImportedHistory } from "@/lib/history-import.functions";
import { getHistoryStats } from "@/lib/history-stats.functions";
import type { HistoryStats } from "@/lib/history-stats";

export const Route = createFileRoute("/_authenticated/historik")({
  head: () => ({
    meta: [
      { title: "Importerad historik – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Gamla V85-spel som lagts in i efterhand, med system, spikar, utfall, datakvalitet och lärdomar.",
      },
      { property: "og:title", content: "Importerad historik – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Historiska V85-omgångar hålls åtskilda från spelen som gjorts i Travhubben.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistorikPage,
});

const QUALITY_LABEL: Record<string, string> = {
  verified: "Verifierad",
  partially_verified: "Delvis verifierad",
  incomplete: "Ofullständig",
};

function HistorikPage() {
  const { groupId } = useActiveGroupId();
  const isOwner = useIsOwner(groupId);
  const fetchRows = useServerFn(listImportedHistory);
  const fetchStats = useServerFn(getHistoryStats);

  const query = useQuery({
    queryKey: ["imported-history", groupId],
    enabled: Boolean(groupId),
    queryFn: () => fetchRows({ data: { groupId: groupId! } }) as Promise<any[]>,
  });

  const statsQuery = useQuery({
    queryKey: ["history-stats", groupId],
    enabled: Boolean(groupId),
    queryFn: () => fetchStats({ data: { groupId: groupId! } }) as Promise<HistoryStats>,
  });
  const stats = statsQuery.data;

  return (
    <>
      <PageHeader
        title="Importerad historik"
        description="Gamla spel som lagts in i efterhand. De blandas aldrig ihop med omgångar som spelats via Travhubben och påverkar inte ekonomin."
      />

      {stats?.hasData ? (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Omgångar</p>
                <p className="text-2xl font-bold">{stats.summary.rounds}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rätt i snitt</p>
                <p className="text-2xl font-bold">{stats.summary.avgCorrect ?? "–"} av 8</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Netto totalt</p>
                <p
                  className={`text-2xl font-bold ${
                    stats.summary.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {new Intl.NumberFormat("sv-SE").format(stats.summary.net)} kr
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Spikar som vann</p>
                <p className="text-2xl font-bold">{stats.spikes.hitRate ?? "–"} %</p>
              </div>
            </div>
            <Button variant="outline" className="mt-4 h-12" asChild>
              <Link to="/larande">Se hela statistiken</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? (
        <div className="mb-4">
          <Button className="h-12" asChild>
            <Link to="/historikimport">Importera fler gamla spel</Link>
          </Button>
        </div>
      ) : null}


      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-base">
            Kunde inte hämta historiken just nu. Ladda om sidan och försök igen.
          </CardContent>
        </Card>
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          title="Ingen importerad historik än"
          description="När gamla V85-spel importeras dyker de upp här."
        />
      ) : (
        <div className="space-y-4">
          {(query.data ?? []).map((r: any) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">
                    {r.track_name ?? "Okänd bana"} · {formatDate(r.race_date)}
                  </CardTitle>
                  <Badge variant="secondary">Importerad historik</Badge>
                  <Badge variant="outline">
                    Datakvalitet: {QUALITY_LABEL[r.data_quality] ?? r.data_quality}
                  </Badge>
                  <Badge variant="outline">
                    {r.winners_verified ? "Resultat verifierat" : "Resultat ofullständigt"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <p>Antal rätt: <strong>{r.correct_count ?? "Okänt"}</strong></p>
                  <p>Vinnande spikar: <strong>{r.spike_hits ?? "Okänt"}</strong></p>
                  <p>Vinst: <strong>{r.payout ?? "Okänd"}</strong></p>
                  <p>Nettoresultat: <strong>{r.net_result ?? "Okänt"}</strong></p>
                  <p>Rader (angivet/beräknat): {r.stated_rows ?? "–"} / {r.computed_rows ?? "–"}</p>
                  <p>Kostnad (angivet/beräknat): {r.stated_cost ?? "–"} / {r.computed_cost ?? "–"}</p>
                  <p>Spikade avdelningar: {(r.spikes ?? []).length ? (r.spikes as any[]).join(", ") : "Inga"}</p>
                  <p>Källa: {r.source ?? "Okänd"}</p>
                </div>

                {r.stated_rows != null && r.computed_rows != null && r.stated_rows !== r.computed_rows ? (
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    Beräkningsavvikelse: angivet och beräknat radantal skiljer sig.
                  </p>
                ) : null}
                {r.stated_cost != null &&
                r.computed_cost != null &&
                Math.abs(Number(r.stated_cost) - Number(r.computed_cost)) > 0.5 ? (
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    Beräkningsavvikelse: angiven och beräknad kostnad skiljer sig.
                  </p>
                ) : null}

                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer font-medium">Visa systemet</summary>
                  <ul className="mt-2 space-y-1">
                    {((r.legs ?? []) as any[]).map((leg: any) => (
                      <li key={leg.leg}>
                        V85-{leg.leg}: {(leg.selected ?? []).join(", ")}
                        {leg.spike === true || (leg.selected ?? []).length === 1 ? " (spik)" : ""}
                        {leg.winner != null
                          ? ` – vinnare ${leg.winner}${r.winners_verified ? "" : " (ej verifierad)"}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </details>

                {r.uncertainty_note ? <p>Osäkerhet: {r.uncertainty_note}</p> : null}
                {r.lessons ? <p>Lärdomar: {r.lessons}</p> : null}
                {r.analysis ? <p>Analys: {r.analysis}</p> : null}
                <p className="text-muted-foreground">
                  Importerad {formatDateTime(r.created_at)}. Påverkar inte gruppens ekonomi.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
