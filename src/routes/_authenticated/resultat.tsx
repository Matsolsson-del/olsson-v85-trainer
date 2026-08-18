import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LegStrip } from "@/components/results/LegStrip";
import { decisiveNotes, krOrDash } from "@/lib/round-legs";
import { useActiveGroupId } from "@/lib/travhub-queries";
import { getDashboard } from "@/lib/dashboard.functions";
import { getResultsOverview } from "@/lib/results-overview.functions";

export const Route = createFileRoute("/_authenticated/resultat")({
  head: () => ({
    meta: [
      { title: "Resultat – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Se hur familjens V85-spel gått över tid, både som grupp och för varje spelare.",
      },
      { property: "og:title", content: "Resultat – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Insats, vinst och träffbild för gruppen och för Mats, Bosse och Olle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultatDashboard,
});

const kr = krOrDash;
const datum = (d: string) => new Date(d).toLocaleDateString("sv-SE");

function BigStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-base text-muted-foreground">{label}</p>
        <p
          className={
            "mt-1 text-3xl font-bold " +
            (tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "")
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function LatestRoundCard({ round }: { round: any }) {
  const notes = decisiveNotes(round.legDetails ?? []);
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-xl">
          Senaste spelet · {datum(round.date)} · {round.track ?? "Okänd bana"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Rätt</p>
            <p className="text-2xl font-bold">
              {round.correctLegs === null ? "–" : `${round.correctLegs} av 8`}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Insats</p>
            <p className="text-2xl font-bold">{kr(round.cost)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Utbetalning</p>
            <p className="text-2xl font-bold">{kr(round.winnings)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Netto</p>
            <p
              className={
                "text-2xl font-bold " +
                (round.net > 0 ? "text-success" : round.net < 0 ? "text-destructive" : "")
              }
            >
              {kr(round.net)}
            </p>
          </div>
        </div>

        <LegStrip legs={round.legDetails ?? []} />

        {notes.length > 0 && (
          <div>
            <h3 className="mb-1 text-base font-semibold">Vad avgjorde?</h3>
            <ul className="list-disc space-y-1 pl-5 text-base">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <h3 className="text-base font-semibold">Ta med till nästa omgång</h3>
          {round.lesson ? (
            <p className="mt-1 text-base">{round.lesson}</p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-base text-muted-foreground">
                Ingen efteranalys är skriven för den här omgången ännu.
              </p>
              <Button asChild size="sm">
                <Link
                  to="/omgangar/$roundId"
                  params={{ roundId: round.roundId }}
                  search={{ flik: "resultat" as const }}
                >
                  Skriv efteranalys
                </Link>
              </Button>
            </div>
          )}
        </div>

        <Button asChild variant="secondary" size="sm">
          <Link
            to="/omgangar/$roundId"
            params={{ roundId: round.roundId }}
            search={{ flik: "resultat" as const }}
          >
            Öppna omgången
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ResultatDashboard() {
  const { groupId } = useActiveGroupId();
  const run = useServerFn(getDashboard);
  const runOverview = useServerFn(getResultsOverview);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", groupId],
    enabled: !!groupId,
    queryFn: () => run({ data: { groupId: groupId! } }),
  });

  const overview = useQuery({
    queryKey: ["results-overview", groupId],
    enabled: !!groupId,
    queryFn: () => runOverview({ data: { groupId: groupId! } }) as Promise<any>,
  });

  const all = overview.data?.combined;
  const history = overview.data?.history;
  const playedRounds: any[] = (data?.rounds ?? []).filter(
    (r: any) => r.cost > 0 || r.winnings > 0 || (r.legDetails?.length ?? 0) > 0,
  );
  const latest = playedRounds[0] ?? null;

  return (
    <>
      <PageHeader
        title="Resultat"
        description="Vad hände, var tappade vi spelet och vad tar vi med oss?"
      />

      {isLoading ? (
        <p className="text-base text-foreground/80">Hämtar…</p>
      ) : error ? (
        <p className="text-base font-medium text-destructive">
          Resultaten kunde inte hämtas just nu. Ladda om sidan och försök igen.
        </p>
      ) : !data ? null : (
        <div className="space-y-8">
          {latest && <LatestRoundCard round={latest} />}

          <section>
            <h2 className="mb-1 text-lg font-semibold">Totalt för familjen</h2>
            <p className="mb-3 text-base text-muted-foreground">
              Siffrorna omfattar både vår importerade spelhistorik och omgångarna vi spelat i
              Travhubben.
            </p>
            {overview.isPending ? (
              <p className="text-base text-foreground/80">Hämtar…</p>
            ) : overview.isError || !all ? (
              <p className="text-base font-medium text-destructive">
                Totalsiffrorna kunde inte hämtas just nu. Ladda om sidan och försök igen.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <BigStat label="Spelade tävlingsdagar" value={String(all.raceDays)} />
                  <BigStat label="Total insats" value={kr(all.cost)} />
                  <BigStat label="Total utbetalning" value={kr(all.payout)} tone="good" />
                  <BigStat label="Netto" value={kr(all.net)} tone={all.net >= 0 ? "good" : "bad"} />
                </div>

                <details className="mt-4 rounded-lg border border-border p-4">
                  <summary className="cursor-pointer text-base font-semibold">
                    Visa mer statistik
                  </summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <BigStat
                      label="Omgångar med utdelning"
                      value={`${all.roundsWithPayout} av ${all.raceDays}`}
                    />
                    <BigStat
                      label="Rätt i genomsnitt"
                      value={all.avgCorrect === null ? "–" : `${all.avgCorrect} av 8`}
                    />
                    <BigStat
                      label="Bästa resultat, rätt"
                      value={all.bestCorrect === null ? "–" : `${all.bestCorrect} av 8`}
                    />
                    <BigStat
                      label="Bästa resultat, netto"
                      value={all.bestNet === null ? "–" : kr(all.bestNet)}
                      tone={all.bestNet && all.bestNet > 0 ? "good" : undefined}
                    />
                  </div>

                  <h3 className="mt-6 mb-3 text-base font-semibold">Varje spelare</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {data.members.map((m: any) => (
                      <Card key={m.userId}>
                        <CardHeader>
                          <CardTitle className="text-base">{m.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {m.stats.races === 0 ? (
                            <p className="text-muted-foreground">
                              Inga avgjorda lopp med egen bedömning ännu.
                            </p>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bedömda lopp med facit</span>
                                <span className="font-semibold">{m.stats.races}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Förstavalet vann</span>
                                <span className="font-semibold">
                                  {m.stats.topPickWins} ({m.stats.topPickHitRate ?? 0} %)
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tro på vinnaren i snitt</span>
                                <span className="font-semibold">
                                  {m.stats.avgProbabilityOnWinner === null
                                    ? "–"
                                    : `${m.stats.avgProbabilityOnWinner} %`}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Spärrade hästar som vann</span>
                                <span className="font-semibold">{m.stats.excludedWinners}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Syn på storfavoriter</span>
                                <span className="font-semibold">
                                  {m.stats.favouriteLean === null
                                    ? "–"
                                    : m.stats.favouriteLean > 0
                                      ? "tror mer än marknaden"
                                      : "tror mindre än marknaden"}
                                </span>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <p className="mt-4 text-base text-muted-foreground">
                    Statistiken bygger på {history?.counts?.raceDaysInStats ?? 0} tävlingsdagar
                    {history?.counts?.reviewNeededDays
                      ? `. För ${history.counts.reviewNeededDays} dagar används tills vidare en preliminärt vald post i väntan på granskning.`
                      : "."}
                  </p>
                </details>
              </>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Tidigare omgångar</h2>
            {playedRounds.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-base text-muted-foreground">
                  Inga omgångar har ännu spelats klart i Travhubben.
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Mobil: klickbara kort */}
                <div className="space-y-3 sm:hidden">
                  {playedRounds.map((r: any) => (
                    <Link
                      key={r.roundId}
                      to="/omgangar/$roundId"
                      params={{ roundId: r.roundId }}
                      search={{ flik: "resultat" as const }}
                      className="block"
                    >
                      <Card className="transition hover:border-primary">
                        <CardContent className="space-y-1 py-4 text-base">
                          <p className="flex items-center justify-between text-lg font-semibold">
                            <span>
                              {datum(r.date)} · {r.track ?? "Okänd bana"}
                            </span>
                            <ChevronRight aria-hidden className="size-5 shrink-0" />
                          </p>
                          <p>Rätt: {r.correctLegs === null ? "–" : `${r.correctLegs} av 8`}</p>
                          <p>Insats: {kr(r.cost)}</p>
                          <p>Utbetalning: {kr(r.winnings)}</p>
                          <p
                            className={
                              "font-semibold " +
                              (r.net > 0 ? "text-success" : r.net < 0 ? "text-destructive" : "")
                            }
                          >
                            Netto: {kr(r.net)}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Dator: klickbara tabellrader */}
                <Card className="hidden sm:block">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-base">
                        <caption className="sr-only">Resultat per spelad omgång</caption>
                        <thead className="text-left text-muted-foreground">
                          <tr className="border-b border-border">
                            <th scope="col" className="px-4 py-3 font-medium">Datum</th>
                            <th scope="col" className="px-4 py-3 font-medium">Bana</th>
                            <th scope="col" className="px-4 py-3 font-medium">Rätt</th>
                            <th scope="col" className="px-4 py-3 text-right font-medium">Insats</th>
                            <th scope="col" className="px-4 py-3 text-right font-medium">Utbetalning</th>
                            <th scope="col" className="px-4 py-3 text-right font-medium">Netto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playedRounds.map((r: any) => (
                            <tr
                              key={r.roundId}
                              className="border-b border-border/60 last:border-0 hover:bg-muted/50"
                            >
                              <td className="px-4 py-3">
                                <Link
                                  to="/omgangar/$roundId"
                                  params={{ roundId: r.roundId }}
                                  search={{ flik: "resultat" as const }}
                                  className="font-medium underline-offset-4 hover:underline"
                                >
                                  {datum(r.date)}
                                </Link>
                              </td>
                              <td className="px-4 py-3">{r.track ?? "–"}</td>
                              <td className="px-4 py-3">
                                {r.correctLegs === null ? "–" : `${r.correctLegs} av 8`}
                              </td>
                              <td className="px-4 py-3 text-right">{kr(r.cost)}</td>
                              <td className="px-4 py-3 text-right">{kr(r.winnings)}</td>
                              <td
                                className={
                                  "px-4 py-3 text-right font-semibold " +
                                  (r.net > 0 ? "text-success" : r.net < 0 ? "text-destructive" : "")
                                }
                              >
                                {kr(r.net)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
