import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { HistoryChartCard } from "@/components/HistoryChartCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/labels";
import { useActiveGroupId, useIsOwner } from "@/lib/travhub-queries";
import { listImportedHistory, listPlayedRounds } from "@/lib/history-import.functions";
import { ResultatDashboard } from "@/routes/_authenticated/resultat";
import { LarandePage } from "@/routes/_authenticated/larande";
import { OmgangarPage } from "@/routes/_authenticated/omgangar/index";

type HistorikVy = "oversikt" | "resultat" | "larande" | "hubben";

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
  validateSearch: (search: Record<string, unknown>): { vy?: HistorikVy } =>
    (["oversikt", "resultat", "larande", "hubben"] as const).includes(search.vy as HistorikVy)
      ? { vy: search.vy as HistorikVy }
      : {},
  component: HistorikPage,
});

const VYER = [
  { key: "oversikt", label: "Våra omgångar" },
  { key: "resultat", label: "Resultat" },
  { key: "larande", label: "Vad har vi lärt oss?" },
  { key: "hubben", label: "Omgångar i hubben" },
] as const;

function HistorikPage() {
  const { vy = "oversikt" } = Route.useSearch();
  return (
    <>
      <nav aria-label="Delar av historiken" className="mb-6 flex flex-wrap gap-2">
        {VYER.map((v) => (
          <Link
            key={v.key}
            to="/historik"
            search={{ vy: v.key }}
            className={
              "min-h-12 rounded-full border px-4 py-3 text-base font-medium " +
              (vy === v.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-card-foreground")
            }
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {vy === "resultat" ? (
        <ResultatDashboard />
      ) : vy === "larande" ? (
        <LarandePage />
      ) : vy === "hubben" ? (
        <OmgangarPage />
      ) : (
        <HistorikOversikt />
      )}
    </>
  );
}

const QUALITY_LABEL: Record<string, string> = {
  verified: "Verifierad",
  partially_verified: "Delvis verifierad",
  incomplete: "Ofullständig",
};

type SortKey = "datum-ny" | "datum-gammal" | "flest-ratt" | "bast-netto";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "datum-ny", label: "Senaste först" },
  { key: "datum-gammal", label: "Äldsta först" },
  { key: "flest-ratt", label: "Flest rätt först" },
  { key: "bast-netto", label: "Bäst netto först" },
];

function HistorikOversikt() {
  const { groupId } = useActiveGroupId();
  const isOwner = useIsOwner(groupId);
  const fetchRows = useServerFn(listImportedHistory);
  const fetchPlayed = useServerFn(listPlayedRounds);
  const [sort, setSort] = useState<SortKey>("datum-ny");
  const [track, setTrack] = useState<string>("alla");

  const query = useQuery({
    queryKey: ["imported-history", groupId],
    enabled: Boolean(groupId),
    queryFn: () => fetchRows({ data: { groupId: groupId! } }) as Promise<any[]>,
  });

  const playedQuery = useQuery({
    queryKey: ["played-rounds-history", groupId],
    enabled: Boolean(groupId),
    queryFn: () => fetchPlayed({ data: { groupId: groupId! } }) as Promise<any[]>,
  });

  const rows = useMemo(
    () => [...(playedQuery.data ?? []), ...(query.data ?? [])],
    [playedQuery.data, query.data],
  );


  const tracks = useMemo(
    () =>
      Array.from(new Set(rows.map((r: any) => r.track_name).filter(Boolean))).sort((a: any, b: any) =>
        String(a).localeCompare(String(b), "sv"),
      ) as string[],
    [rows],
  );

  const conflictKeys = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows as any[]) {
      const key = `${(r.track_name ?? "").trim().toLowerCase()}|${r.race_date}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const dayCount = conflictKeys.size;
  const conflictDays = [...conflictKeys.values()].filter((n) => n > 1).length;

  const visible = useMemo(() => {
    const filtered = track === "alla" ? rows : rows.filter((r: any) => r.track_name === track);
    const num = (v: any) => (v === null || v === undefined ? Number.NEGATIVE_INFINITY : Number(v));
    return [...filtered].sort((a: any, b: any) => {
      if (sort === "datum-ny") return String(b.race_date).localeCompare(String(a.race_date));
      if (sort === "datum-gammal") return String(a.race_date).localeCompare(String(b.race_date));
      if (sort === "flest-ratt") return num(b.correct_count) - num(a.correct_count);
      return num(b.net_result) - num(a.net_result);
    });
  }, [rows, sort, track]);

  return (
    <>
      <PageHeader
        title="Historik"
        description="Alla V85-omgångar vi har spelat, med system, spikar, utfall och lärdomar."
      />

      <div className="mb-4">
        <HistoryChartCard />
      </div>

      {isOwner ? (
        <div className="mb-4">
          <Button className="h-12" asChild>
            <Link to="/historikimport">Importera fler gamla spel</Link>
          </Button>
        </div>
      ) : null}

      {rows.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="historik-sort" className="mb-1 block text-base font-medium">
              Sortera
            </label>
            <select
              id="historik-sort"
              className="h-12 w-full rounded-md border border-border bg-card px-3 text-base text-card-foreground"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="historik-bana" className="mb-1 block text-base font-medium">
              Bana
            </label>
            <select
              id="historik-bana"
              className="h-12 w-full rounded-md border border-border bg-card px-3 text-base text-card-foreground"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
            >
              <option value="alla">Alla banor</option>
              {tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!groupId || query.isPending ? (
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
      ) : rows.length === 0 ? (
        <EmptyState
          title="Ingen importerad historik än"
          description="När gamla V85-spel importeras dyker de upp här."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Inga omgångar på den banan"
          description="Välj Alla banor för att se allt igen."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-base text-foreground/80">
            {dayCount} tävlingsdagar och totalt {rows.length} importerade systemposter. Visar{" "}
            {visible.length} systemposter.
            {conflictDays
              ? ` ${conflictDays} tävlingsdagar har flera motstridiga poster och är märkta nedan.`
              : ""}
          </p>
          {visible.map((r: any) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">
                    {r.track_name ?? "Okänd bana"} · {formatDate(r.race_date)}
                  </CardTitle>
                  <Badge variant="secondary">Importerad historik</Badge>
                  {(conflictKeys.get(
                    `${(r.track_name ?? "").trim().toLowerCase()}|${r.race_date}`,
                  ) ?? 1) > 1 ? (
                    <Badge variant="destructive">
                      Behöver granskas – flera systemposter samma dag
                    </Badge>
                  ) : null}
                  <Badge variant="secondary">
                    Datakvalitet: {QUALITY_LABEL[r.data_quality] ?? r.data_quality}
                  </Badge>
                  <Badge variant="secondary">
                    {r.winners_verified ? "Resultat verifierat" : "Resultat ofullständigt"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-base">
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <p>
                    Antal rätt: <strong>{r.correct_count ?? "Okänt"}</strong>
                  </p>
                  <p>
                    Vinnande spikar: <strong>{r.spike_hits ?? "Okänt"}</strong>
                  </p>
                  <p>
                    Insats: <strong>{formatCurrency(numOrNull(r.computed_cost ?? r.stated_cost))}</strong>
                  </p>
                  <p>
                    Utbetalning: <strong>{formatCurrency(numOrNull(r.payout))}</strong>
                  </p>
                  <p>
                    Netto: <strong>{formatCurrency(numOrNull(r.net_result))}</strong>
                  </p>
                  <p>
                    Spikade avdelningar:{" "}
                    {(r.spikes ?? []).length ? (r.spikes as any[]).join(", ") : "Inga"}
                  </p>
                </div>

                {r.stated_rows != null &&
                r.computed_rows != null &&
                r.stated_rows !== r.computed_rows ? (
                  <p className="font-semibold text-warning">
                    Obs: angivet och beräknat antal rader skiljer sig.
                  </p>
                ) : null}
                {r.stated_cost != null &&
                r.computed_cost != null &&
                Math.abs(Number(r.stated_cost) - Number(r.computed_cost)) > 0.5 ? (
                  <p className="font-semibold text-warning">
                    Obs: angiven och beräknad kostnad skiljer sig.
                  </p>
                ) : null}

                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer py-1 font-medium">Visa systemet</summary>
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

                {r.lessons ? <p>Lärdomar: {r.lessons}</p> : null}
                {r.analysis ? <p>Analys: {r.analysis}</p> : null}

                {isOwner && (
                  <details className="rounded-md border border-border p-3">
                    <summary className="cursor-pointer py-1 font-medium">Avancerat</summary>
                    <div className="mt-2 space-y-1 text-base">
                      <p>
                        Rader (angivet/beräknat): {r.stated_rows ?? "–"} / {r.computed_rows ?? "–"}
                      </p>
                      <p>
                        Kostnad (angivet/beräknat): {r.stated_cost ?? "–"} / {r.computed_cost ?? "–"}
                      </p>
                      <p>Källa: {r.source ?? "Okänd"}</p>
                      {r.uncertainty_note ? <p>Osäkerhet: {r.uncertainty_note}</p> : null}
                    </div>
                  </details>
                )}

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

function numOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
