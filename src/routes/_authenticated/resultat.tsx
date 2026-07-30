import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveGroupId } from "@/lib/travhub-queries";
import { getDashboard } from "@/lib/dashboard.functions";

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

const kr = (v: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(v);

function BigStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={
            "mt-1 text-3xl font-bold " +
            (tone === "good" ? "text-emerald-500" : tone === "bad" ? "text-destructive" : "")
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ResultatDashboard() {
  const { groupId } = useActiveGroupId();
  const run = useServerFn(getDashboard);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", groupId],
    enabled: !!groupId,
    queryFn: () => run({ data: { groupId: groupId! } }),
  });

  return (
    <>
      <PageHeader
        title="Resultat"
        description="Hur det har gått för oss tillsammans – och för var och en."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{(error as any).message}</p>
      ) : !data ? null : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Gruppen</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <BigStat label="Spelade omgångar" value={String(data.totals.rounds)} />
              <BigStat label="Satsat totalt" value={kr(data.totals.cost)} />
              <BigStat label="Vunnit totalt" value={kr(data.totals.winnings)} tone="good" />
              <BigStat
                label="Netto"
                value={kr(data.totals.net)}
                tone={data.totals.net >= 0 ? "good" : "bad"}
              />
              <BigStat
                label="Omgångar med vinst"
                value={`${data.totals.roundsWithWin} av ${data.totals.rounds}`}
              />
              <BigStat
                label="Rätt avdelningar i snitt"
                value={data.totals.avgCorrectLegs === null ? "–" : `${data.totals.avgCorrectLegs} av 8`}
              />
              <BigStat
                label="Bästa omgång, rätt"
                value={data.totals.bestCorrectLegs === null ? "–" : `${data.totals.bestCorrectLegs} av 8`}
              />
              <BigStat
                label="Bästa omgång, netto"
                value={data.totals.bestRound ? kr(data.totals.bestRound.net) : "–"}
                tone="good"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Varje spelare</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.members.map((m: any) => (
                <Card key={m.userId}>
                  <CardHeader>
                    <CardTitle className="text-base">{m.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {m.stats.races === 0 ? (
                      <p className="text-muted-foreground">Inga avgjorda lopp med egen bedömning ännu.</p>
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
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Omgång för omgång</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 font-medium">Datum</th>
                        <th className="px-4 py-3 font-medium">Bana</th>
                        <th className="px-4 py-3 font-medium">Rätt</th>
                        <th className="px-4 py-3 text-right font-medium">Insats</th>
                        <th className="px-4 py-3 text-right font-medium">Vinst</th>
                        <th className="px-4 py-3 text-right font-medium">Netto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rounds.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                            Inga omgångar ännu.
                          </td>
                        </tr>
                      ) : (
                        data.rounds.map((r: any) => (
                          <tr key={r.roundId} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-3">
                              {new Date(r.date).toLocaleDateString("sv-SE")}
                            </td>
                            <td className="px-4 py-3">{r.track ?? "–"}</td>
                            <td className="px-4 py-3">
                              {r.correctLegs === null ? "–" : `${r.correctLegs} av ${r.legs || 8}`}
                            </td>
                            <td className="px-4 py-3 text-right">{r.cost ? kr(r.cost) : "–"}</td>
                            <td className="px-4 py-3 text-right">{r.winnings ? kr(r.winnings) : "–"}</td>
                            <td
                              className={
                                "px-4 py-3 text-right font-semibold " +
                                (r.net > 0 ? "text-emerald-500" : r.net < 0 ? "text-destructive" : "")
                              }
                            >
                              {r.cost || r.winnings ? kr(r.net) : "–"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
