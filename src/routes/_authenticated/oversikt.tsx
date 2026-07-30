import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActiveGroupId,
  useLedger,
  useMembers,
  useRoundData,
  useRounds,
} from "@/lib/travhub-queries";
import { ROUND_STATUS_LABELS, formatCurrency, formatDate, formatDateTime } from "@/lib/labels";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/oversikt")({
  head: () => ({
    meta: [
      { title: "Översikt – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Nästa omgång, spelstopp, analysstatus, aktuellt system och gruppens saldo.",
      },
      { property: "og:title", content: "Översikt – Familjen Olssons Travhub" },
      { property: "og:description", content: "Status för gruppens pågående V85-omgång." },
    ],
  }),
  component: OversiktPage,
});

function OversiktPage() {
  const { groupId, groups } = useActiveGroupId();
  const { data: rounds, isLoading } = useRounds(groupId);
  const { data: ledger } = useLedger(groupId);

  const balance = (ledger ?? []).reduce((sum, t) => {
    if (t.transaction_type === "contribution" || t.transaction_type === "winnings")
      return sum + Number(t.amount);
    if (t.transaction_type === "stake" || t.transaction_type === "withdrawal")
      return sum - Number(t.amount);
    return sum + Number(t.amount);
  }, 0);

  const active = rounds?.find((r) => r.status !== "completed");
  const latest = rounds?.find((r) => r.status === "completed");

  if (groups.length === 0) {
    return (
      <>
        <PageHeader title="Översikt" description="Kom igång genom att skapa gruppen." />
        <EmptyState
          title="Du är inte med i någon grupp ännu"
          description="Skapa gruppen och bjud in de andra medlemmarna under Inställningar."
          action={
            <Button asChild>
              <Link to="/installningar">Till inställningar</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Översikt"
        description="Status för gruppens pågående omgång och ekonomi."
        actions={
          <Button asChild variant="secondary">
            <Link to="/omgangar">Alla omgångar</Link>
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !active ? (
        <EmptyState
          title="Ingen pågående omgång"
          description="Skapa en ny V85-omgång för att komma igång."
          action={
            <Button asChild>
              <Link to="/omgangar">Skapa omgång</Link>
            </Button>
          }
        />
      ) : (
        <ActiveRoundCard roundId={active.id} />
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gruppsaldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-3xl font-semibold">{formatCurrency(balance)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Baserat på {ledger?.length ?? 0} bokförda transaktioner.
            </p>
            <Button asChild variant="link" className="mt-2 px-0">
              <Link to="/ekonomi">
                Till ekonomi <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Senaste avslutade omgång</CardTitle>
          </CardHeader>
          <CardContent>
            {latest ? (
              <>
                <p className="font-medium">
                  {formatDate(latest.race_date)} · {latest.tracks?.name ?? "Okänd bana"}
                </p>
                <Button asChild variant="link" className="mt-2 px-0">
                  <Link to="/omgangar/$roundId" params={{ roundId: latest.id }}>
                    Öppna efterrapport <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Ingen avslutad omgång ännu.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ActiveRoundCard({ roundId }: { roundId: string }) {
  const { user } = useAuth();
  const { groupId } = useActiveGroupId();
  const { data: members } = useMembers(groupId);
  const { data, isLoading } = useRoundData(roundId);

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

  const { round, races, systems } = data;
  const totalRaces = races.length;
  const memberStatus = (members ?? []).map((m) => {
    const submitted = races.filter((r) =>
      r.individual_race_assessments?.some(
        (a: any) => a.user_id === m.user_id && a.locked_at !== null,
      ),
    ).length;
    return {
      id: m.user_id,
      name: (m.profiles as any)?.display_name ?? (m.profiles as any)?.email ?? "Medlem",
      submitted,
      isMe: m.user_id === user?.id,
    };
  });

  const lockedVersion = systems
    .flatMap((s: any) => s.system_versions.map((v: any) => ({ ...v, systemName: s.name })))
    .filter((v: any) => v.locked_at)
    .sort((a: any, b: any) => (a.locked_at < b.locked_at ? 1 : -1))[0];

  const betStopSoon =
    round.bet_stop_at && new Date(round.bet_stop_at).getTime() - Date.now() < 1000 * 60 * 60 * 24;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="font-serif text-xl">
            {round.product_type} · {formatDate(round.race_date)} ·{" "}
            {(round.tracks as any)?.name ?? "Bana ej vald"}
          </CardTitle>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            Spelstopp: {formatDateTime(round.bet_stop_at)}
            {betStopSoon && (
              <span className="inline-flex items-center gap-1 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden /> Snart spelstopp
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{ROUND_STATUS_LABELS[round.status]}</Badge>
          <Button asChild size="sm">
            <Link to="/omgangar/$roundId" params={{ roundId }}>
              Öppna omgången
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-medium">Analysstatus</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {memberStatus.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>
                  {m.name}
                  {m.isMe && <span className="text-muted-foreground"> (du)</span>}
                </span>
                <span
                  className={
                    m.submitted === totalRaces && totalRaces > 0
                      ? "font-medium text-success"
                      : "text-muted-foreground"
                  }
                >
                  {m.submitted}/{totalRaces} inlämnade
                </span>
              </li>
            ))}
            {memberStatus.length === 0 && (
              <li className="text-muted-foreground">Inga medlemmar registrerade.</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {round.analyses_revealed_at
              ? `Analyser öppnade ${formatDateTime(round.analyses_revealed_at)}`
              : "Analyserna är blinda tills alla har lämnat in."}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium">Budget</h3>
          <p className="mt-2 font-serif text-2xl font-semibold">
            {formatCurrency(Number(round.budget))}
          </p>
          <p className="text-sm text-muted-foreground">
            Radpris {formatCurrency(Number(round.row_price))}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium">Aktuellt system</h3>
          {lockedVersion ? (
            <div className="mt-2 text-sm">
              <p className="font-medium">
                {lockedVersion.systemName} v{lockedVersion.version_number}
              </p>
              <p className="text-muted-foreground">
                {lockedVersion.calculated_rows} rader ·{" "}
                {formatCurrency(Number(lockedVersion.calculated_cost))}
              </p>
              <p className="text-xs text-muted-foreground">
                Låst {formatDateTime(lockedVersion.locked_at)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Inget system är låst ännu.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
