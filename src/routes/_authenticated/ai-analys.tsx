import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listRoundExpertTips } from "@/lib/expert-tips.functions";

import { EmptyState, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveGroupId, useRoundData } from "@/lib/travhub-queries";
import { useCurrentRound } from "@/lib/current-round-queries";
import { formatDate, formatDateTime } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/ai-analys")({
  head: () => ({
    meta: [
      { title: "AI:ns analys – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Hela AI-analysen av veckans V85: vinstchans, nivå och motivering för varje häst i alla åtta avdelningar.",
      },
      { property: "og:title", content: "AI:ns analys – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Se hur datorn resonerar kring varje häst och avdelning – ett utkast, inget beslut.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { omgang?: string } =>
    typeof search.omgang === "string" && search.omgang ? { omgang: search.omgang } : {},
  component: AiAnalysPage,
});

function AiAnalysPage() {
  const { groupId } = useActiveGroupId();
  const { omgang } = Route.useSearch();
  const { data: active, isLoading, error } = useCurrentRound(groupId, omgang ?? null);

  if (isLoading) {
    return (
      <>
        <PageHeader title="AI:ns analys" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  if (error || !active) {
    return (
      <>
        <PageHeader title="AI:ns analys" />
        <EmptyState
          title={error ? "Det gick inte att hämta omgången" : "Ingen omgång att visa ännu"}
          description={
            error ? "Prova att ladda om sidan." : "Nästa omgång hämtas automatiskt så snart ATG har publicerat startlistan."
          }
        />
      </>
    );
  }

  return <Redovisning key={active.id} roundId={active.id} />;
}

const TIER_TEXT: Record<string, string> = {
  A: "Huvudchans",
  B: "Utmanare",
  C: "Skräll",
  D: "Liten chans",
};

function pct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return `${Math.round(n * 10) / 10} %`;
}

function latestShare(entry: any): number | null {
  const snaps = [...(entry?.market_snapshots ?? [])].sort((a: any, b: any) =>
    String(b.captured_at).localeCompare(String(a.captured_at)),
  );
  const v = snaps[0]?.bet_share_percent;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Redovisning({ roundId }: { roundId: string }) {
  const { data, isLoading } = useRoundData(roundId);
  const fetchTips = useServerFn(listRoundExpertTips);
  const { data: tips } = useQuery({
    queryKey: ["round-expert-tips", roundId],
    queryFn: () => fetchTips({ data: { roundId } }),
  });

  const tipsByLeg = new Map<number, any[]>();
  for (const tip of (tips ?? []) as any[]) {
    const leg = Number(tip.leg_number);
    if (!Number.isFinite(leg)) continue;
    tipsByLeg.set(leg, [...(tipsByLeg.get(leg) ?? []), tip]);
  }

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { round, races } = data as any;


  const legs = (races as any[]).map((race) => {
    const assessment = race.group_race_assessments?.[0] ?? null;
    const entryById = new Map<string, any>(
      (race.race_entries ?? []).map((e: any) => [e.id, e]),
    );
    const rows = [...(assessment?.group_entry_assessments ?? [])]
      .map((a: any) => ({ ...a, entry: entryById.get(a.race_entry_id) }))
      .filter((a) => a.entry)
      .sort(
        (a, b) =>
          (a.final_rank ?? 99) - (b.final_rank ?? 99) ||
          Number(b.group_win_probability ?? 0) - Number(a.group_win_probability ?? 0),
      );
    return { race, assessment, rows };
  });

  const analysed = legs.filter((l) => l.rows.length > 0);

  return (
    <>
      <PageHeader
        title="AI:ns analys"
        description={`${formatDate(round.race_date)} · ${round.tracks?.name ?? "Bana ej vald"} · Spelstopp ${formatDateTime(
          round.bet_stop_at,
        )}`}
        actions={
          <Button asChild variant="secondary" size="lg" className="h-12 text-base">
            <Link to="/veckans-spel">Tillbaka till veckans spel</Link>
          </Button>
        }
      />

      <Card className="mb-5 border-2 border-primary">
        <CardContent className="space-y-1 p-5">
          <p className="text-xl font-semibold">
            {analysed.length} av {legs.length} avdelningar är analyserade.
          </p>
          <p className="text-lg text-muted-foreground">
            Det här är datorns utkast. Ingenting är bestämt – ni väljer själva vad ni tar med.
            Procenten är AI:ns bedömda vinstchans, "Streck" är hur mycket folk spelar hästen hos ATG.
          </p>
        </CardContent>
      </Card>

      {analysed.length === 0 ? (
        <EmptyState
          title="Ingen analys är gjord ännu"
          description="Gå till Veckans spel och tryck på Låt AI:n analysera."
        />
      ) : (
        <div className="space-y-5 pb-10">
          {legs.map(({ race, assessment, rows }) => (
            <Card key={race.id}>
              <CardHeader>
                <CardTitle className="text-2xl">
                  Avdelning {race.leg_number}
                  {race.distance_m ? ` · ${race.distance_m} m` : ""}
                  {race.start_method ? ` · ${race.start_method === "volt" ? "volt" : "auto"}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-base leading-relaxed">
                {rows.length === 0 ? (
                  <p className="text-muted-foreground">Den här avdelningen är inte analyserad ännu.</p>
                ) : (
                  <>
                    {assessment?.pace_scenario && (
                      <p>
                        <span className="font-semibold">Så tror AI:n att loppet går: </span>
                        {assessment.pace_scenario}
                      </p>
                    )}
                    {assessment?.notes && (
                      <p className="whitespace-pre-line text-muted-foreground">{assessment.notes}</p>
                    )}

                    {(tipsByLeg.get(Number(race.leg_number)) ?? []).length > 0 && (
                      <div className="rounded-lg border border-border bg-muted/40 p-4">
                        <p className="font-semibold">Experternas tips för avdelningen</p>
                        <ul className="mt-2 space-y-2">
                          {(tipsByLeg.get(Number(race.leg_number)) ?? []).map((tip: any) => {
                            const alts = Array.isArray(tip.alternatives)
                              ? tip.alternatives.filter(Boolean)
                              : [];
                            return (
                              <li key={tip.id}>
                                <span className="font-medium">
                                  {[tip.source_name, tip.expert].filter(Boolean).join(" / ")}:
                                </span>{" "}
                                {[
                                  tip.top_pick ? `Förstaval ${tip.top_pick}` : null,
                                  alts.length > 0 ? `Alternativ ${alts.join(", ")}` : null,
                                  tip.longshot ? `Skräll ${tip.longshot}` : null,
                                  tip.warning ? `Varning: ${tip.warning}` : null,
                                  tip.note ?? null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "Inget tydligt tips"}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}



                    <ul className="space-y-3">
                      {rows.map((row: any) => {
                        const share = latestShare(row.entry);
                        const prob = Number(row.group_win_probability ?? 0);
                        const diff = share === null ? null : Math.round((prob - share) * 10) / 10;
                        return (
                          <li key={row.id} className="rounded-lg border border-border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-lg font-semibold">
                                {row.entry.start_number} {row.entry.horses?.name ?? "Häst"}
                              </span>
                              {row.tier && (
                                <Badge variant={row.tier === "A" ? "default" : "secondary"}>
                                  {TIER_TEXT[row.tier] ?? row.tier}
                                </Badge>
                              )}
                              <span className="text-base font-medium">
                                AI: {pct(row.group_win_probability)}
                              </span>
                              <span className="text-base text-muted-foreground">
                                Streck: {share === null ? "–" : pct(share)}
                              </span>
                              {diff !== null && Math.abs(diff) >= 5 && (
                                <Badge variant="outline">
                                  {diff > 0 ? `Underspelad +${diff}` : `Överspelad ${diff}`}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              Kusk {row.entry.drivers?.name ?? "okänd"} · Tränare{" "}
                              {row.entry.trainers?.name ?? "okänd"}
                              {row.entry.post_position ? ` · Spår ${row.entry.post_position}` : ""}
                              {row.entry.scratched ? " · STRUKEN" : ""}
                            </p>
                            {row.value_comment && <p className="mt-2">{row.value_comment}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
