import { Link } from "@tanstack/react-router";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveGroupId } from "@/lib/travhub-queries";
import { getHistoryStats } from "@/lib/history-stats.functions";
import type { HistoryStats } from "@/lib/history-stats";

const kr = (n: number | null | undefined) =>
  n == null ? "–" : `${new Intl.NumberFormat("sv-SE").format(Math.round(n))} kr`;

const shortDate = (d: string) => d.slice(5).replace("-", "/");

/**
 * Historikgraf: pengarna över tid samt antal rätt per omgång.
 * Används på Översikt och Historik så att bilden blir densamma överallt.
 */
export function HistoryChartCard({ showCorrect = true }: { showCorrect?: boolean }) {
  const { groupId } = useActiveGroupId();
  const fetchStats = useServerFn(getHistoryStats);

  const query = useQuery({
    queryKey: ["history-stats", groupId],
    enabled: Boolean(groupId),
    queryFn: () => fetchStats({ data: { groupId: groupId! } }) as Promise<HistoryStats>,
  });

  const stats = query.data;

  // Tydligt åtskilda tillstånd: laddar, fel, spärrad, tom och klar.
  if (!groupId || query.isPending) return <Skeleton className="h-72 w-full" />;

  if (query.isError) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Så här har spelen gått</CardTitle>
        </CardHeader>
        <CardContent className="text-base">
          Historiken kunde inte hämtas just nu. Ladda om sidan och försök igen.
        </CardContent>
      </Card>
    );
  }

  const dupNotice = stats?.preliminary ? (
    <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-base">
      <p>
        {stats.counts.reviewNeededDays} tävlingsdag
        {stats.counts.reviewNeededDays === 1 ? "" : "ar"} har två motstridiga systemposter. Vi
        räknar preliminärt med en av dem tills Mats har granskat dagarna. Inget är raderat.
      </p>
      <ul className="mt-2 list-disc pl-5">
        {stats.unresolvedDates.map((d) => (
          <li key={`${d.track}-${d.date}`}>
            {d.track} {d.date}
          </li>
        ))}
      </ul>
      <Button variant="secondary" className="mt-3 h-12" asChild>
        <Link to="/historik-dubbletter">
          Granska {stats.counts.reviewNeededDays} tävlingsdag
          {stats.counts.reviewNeededDays === 1 ? "" : "ar"}
        </Link>
      </Button>
    </div>
  ) : null;


  if (!stats?.hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Så här har spelen gått</CardTitle>
        </CardHeader>
        <CardContent className="text-base text-muted-foreground">
          Ingen historik finns inlagd ännu.
        </CardContent>
      </Card>
    );
  }

  const s = stats.summary;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Så här har spelen gått</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {dupNotice}

        <p className="text-base text-muted-foreground">
          Historiken innehåller totalt {stats.counts.importedRecords} importerade systemposter
          fördelade på {stats.counts.raceDays} tävlingsdagar.
          {stats.counts.reviewNeededDays
            ? ` ${stats.counts.reviewNeededDays} tävlingsdagar har två motstridiga poster som Mats behöver granska.`
            : ""}
        </p>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Tävlingsdagar</p>
            <p className="text-2xl font-bold">{stats.counts.raceDaysInStats}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rätt i snitt</p>
            <p className="text-2xl font-bold">{s.avgCorrect ?? "–"} av 8</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Insatser</p>
            <p className="text-2xl font-bold">{kr(s.totalCost)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Netto</p>
            <p
              className={`text-2xl font-bold ${
                s.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              }`}
            >
              {kr(s.net)}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-base font-medium">Pengarna över tid</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trend} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 12 }} width={64} tickFormatter={(v) => `${v}`} />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                <Tooltip
                  formatter={(v: any) => kr(Number(v))}
                  labelFormatter={(l) => `Omgång ${l}`}
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeNet"
                  name="Netto totalt"
                  stroke="var(--chart-1)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Linjen visar vinst minus insats, hopräknat vecka för vecka.
          </p>
        </div>

        {showCorrect ? (
          <div>
            <p className="mb-2 text-base font-medium">Antal rätt per omgång</p>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.trend} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12 }} minTickGap={24} />
                  <YAxis domain={[0, 8]} allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                  <Tooltip
                    formatter={(v: any) => `${v} rätt`}
                    labelFormatter={(l) => `Omgång ${l}`}
                    contentStyle={{
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Bar dataKey="correct" name="Rätt" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="h-12" asChild>
            <Link to="/historik">Se alla omgångar</Link>
          </Button>
          <Button variant="secondary" className="h-12" asChild>
            <Link to="/larande">Se hela statistiken</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
