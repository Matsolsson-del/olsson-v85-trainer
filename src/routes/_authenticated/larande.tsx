import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveGroupId } from "@/lib/travhub-queries";
import { getHistoryStats } from "@/lib/history-stats.functions";
import type { HistoryStats } from "@/lib/history-stats";

export const Route = createFileRoute("/_authenticated/larande")({
  beforeLoad: () => {
    throw redirect({ to: "/historik", search: { vy: "larande" } });
  },
  head: () => ({
    meta: [
      { title: "Lärande – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Se hur våra V85-spel gått över tid: rätt per omgång, nettokurva, hur spikarna håller och var vi tappar.",
      },
      { property: "og:title", content: "Lärande – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Trender, spikstatistik och avdelningsanalys från familjens spelhistorik.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LarandePage,
});

const kr = (n: number | null | undefined) =>
  n == null ? "–" : `${new Intl.NumberFormat("sv-SE").format(Math.round(n))} kr`;

const shortDate = (d: string) => d.slice(5).replace("-", "/");

function BigNumber({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-3xl font-bold ${
            tone === "good" ? "text-emerald-600 dark:text-emerald-400" : ""
          }${tone === "bad" ? "text-destructive" : ""}`}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function LarandePage() {
  const { groupId } = useActiveGroupId();
  const fetchStats = useServerFn(getHistoryStats);

  const query = useQuery({
    queryKey: ["history-stats", groupId],
    enabled: Boolean(groupId),
    queryFn: () => fetchStats({ data: { groupId: groupId! } }) as Promise<HistoryStats>,
  });

  const stats = query.data;

  return (
    <>
      <PageHeader
        title="Lärande"
        description="Så här har våra spel gått. Siffrorna kommer från den historik som lagts in i Travhubben."
      />

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-base">
            Kunde inte hämta statistiken just nu. Ladda om sidan och försök igen.
          </CardContent>
        </Card>
      ) : !stats?.hasData ? (
        <EmptyState
          title="Ingen historik ännu"
          description="När gamla V85-spel har lagts in visas trender, spikstatistik och råd här."
        />
      ) : (
        <div className="space-y-6">
          {/* Överblick */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Överblick</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BigNumber
                label="Antal omgångar"
                value={String(stats.summary.rounds)}
                hint={`${stats.summary.firstDate} – ${stats.summary.lastDate}`}
              />
              <BigNumber
                label="Rätt i snitt"
                value={stats.summary.avgCorrect != null ? `${stats.summary.avgCorrect} av 8` : "–"}
                hint={stats.summary.bestCorrect != null ? `Bäst: ${stats.summary.bestCorrect} rätt` : undefined}
              />
              <BigNumber
                label="Netto totalt"
                value={kr(stats.summary.net)}
                tone={stats.summary.net >= 0 ? "good" : "bad"}
                hint={`Insats ${kr(stats.summary.totalCost)} · Vinst ${kr(stats.summary.totalPayout)}`}
              />
              <BigNumber
                label="Omgångar med utdelning"
                value={`${stats.summary.roundsWithPayout} av ${stats.summary.rounds}`}
                hint={stats.summary.avgCost != null ? `Snittinsats ${kr(stats.summary.avgCost)}` : undefined}
              />
            </div>
          </section>

          {/* Trend */}
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pengarna över tid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm text-muted-foreground">
                  Kurvan visar vinst minus insats, hopräknat omgång för omgång.
                </p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.trend} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tickFormatter={shortDate} fontSize={12} />
                      <YAxis fontSize={12} width={60} />
                      <ReferenceLine y={0} className="stroke-border" />
                      <Tooltip
                        formatter={(v: any) => kr(Number(v))}
                        labelFormatter={(l) => `Omgång ${l}`}
                        contentStyle={{ fontSize: 14 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulativeNet"
                        name="Netto"
                        stroke="var(--chart-1)"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Antal rätt per omgång</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm text-muted-foreground">
                  Åtta rätt är full pott. Staplarna visar hur nära vi varit.
                </p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.trend} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tickFormatter={shortDate} fontSize={12} />
                      <YAxis domain={[0, 8]} allowDecimals={false} fontSize={12} width={30} />
                      <Tooltip labelFormatter={(l) => `Omgång ${l}`} contentStyle={{ fontSize: 14 }} />
                      <Bar dataKey="correct" name="Rätt" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Spikar */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Hur går det för spikarna?</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BigNumber
                label="Spikar som vann"
                value={
                  stats.spikes.hitRate != null
                    ? `${stats.spikes.hitRate} %`
                    : "–"
                }
                hint={`${stats.spikes.hits} av ${stats.spikes.total} spikar`}
              />
              <BigNumber
                label="Omgångar som sprack på en spik"
                value={String(stats.spikes.missRounds)}
                tone={stats.spikes.missRounds > 0 ? "bad" : undefined}
                hint={`Insats i de omgångarna: ${kr(stats.spikes.missCost)}`}
              />
              <BigNumber
                label="Rätt när spikarna höll"
                value={
                  stats.spikes.avgCorrectWhenSpikesRight != null
                    ? `${stats.spikes.avgCorrectWhenSpikesRight} av 8`
                    : "–"
                }
                tone="good"
              />
              <BigNumber
                label="Rätt när en spik föll"
                value={
                  stats.spikes.avgCorrectWhenSpikeMiss != null
                    ? `${stats.spikes.avgCorrectWhenSpikeMiss} av 8`
                    : "–"
                }
                tone="bad"
              />
            </div>
          </section>

          {/* Avdelningar */}
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Träff per avdelning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Hur ofta vinnaren fanns med bland våra hästar i varje avdelning.
                </p>
                {stats.legs.map((l) => (
                  <div key={l.leg} className="space-y-1">
                    <div className="flex items-baseline justify-between text-base">
                      <span className="font-medium">V85-{l.leg}</span>
                      <span>
                        {l.hitRate} %{" "}
                        <span className="text-sm text-muted-foreground">
                          ({l.hits} av {l.rounds}, snitt {l.avgHorses} hästar)
                        </span>
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${l.hitRate}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lönar sig fler hästar?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Träffsäkerhet beroende på hur många hästar vi tagit med i en avdelning.
                </p>
                {stats.buckets.map((b) => (
                  <div key={b.horses} className="space-y-1">
                    <div className="flex items-baseline justify-between text-base">
                      <span className="font-medium">{b.label}</span>
                      <span>
                        {b.hitRate} %{" "}
                        <span className="text-sm text-muted-foreground">({b.hits} av {b.legs})</span>
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${b.hitRate}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* Råd */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vad siffrorna säger att vi bör göra</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-base">
                {stats.advice.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button className="h-12" asChild>
                  <Link to="/veckans-spel">Till veckans spel</Link>
                </Button>
                <Button variant="secondary" className="h-12" asChild>
                  <Link to="/historik">Se alla gamla spel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
