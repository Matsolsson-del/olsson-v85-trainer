import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { HistoryChartCard } from "@/components/HistoryChartCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveGroupId, useMyProfile, useRoundData, useRounds } from "@/lib/travhub-queries";
import { useRoundResponsibility } from "@/lib/responsibility-queries";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/labels";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/oversikt")({
  head: () => ({
    meta: [
      { title: "Översikt – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Veckans V85, vem som är ansvarig, din uppgift, AI:ns analys och senaste resultat.",
      },
      { property: "og:title", content: "Översikt – Familjen Olssons Travhub" },
      { property: "og:description", content: "Allt du behöver inför veckans V85, på ett ställe." },
    ],
  }),
  component: OversiktPage,
});

function BigCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg">{children}</CardContent>
    </Card>
  );
}

function OversiktPage() {
  const { groupId, groups } = useActiveGroupId();
  const { data: rounds, isLoading, error } = useRounds(groupId);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Översikt" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Översikt" />
        <EmptyState
          title="Det gick inte att hämta informationen"
          description="Prova att ladda om sidan."
        />
      </>
    );
  }

  if (groups.length === 0) {
    return (
      <>
        <PageHeader title="Översikt" />
        <EmptyState title="Du är inte med i någon grupp ännu" />
      </>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  // Spelbara omgångar = ej avgjorda, sorterade med närmast tävlingsdag först.
  const upcoming = (rounds ?? [])
    .filter((r) => r.status !== "completed")
    .sort((a, b) => String(a.race_date).localeCompare(String(b.race_date)));
  const playable = upcoming.filter((r) => String(r.race_date) >= today);
  // Den aktuella omgången är den vi faktiskt spelar nu; helst en riktig (ej demo).
  const active =
    playable.find((r) => !(r as any).is_demo) ?? playable[0] ?? upcoming[upcoming.length - 1] ?? null;
  const next = playable.find((r) => r.id !== active?.id) ?? null;
  const latest =
    (rounds ?? [])
      .filter((r) => r.status === "completed")
      .sort((a, b) => String(b.race_date).localeCompare(String(a.race_date)))[0] ?? null;

  return (
    <>
      <PageHeader title="Översikt" description="Det här gäller den här veckan." />
      {active ? (
        <ActiveRound roundId={active.id} latestId={latest?.id ?? null} />
      ) : (
        <div className="space-y-5">
          <BigCard title="Veckans V85">
            <p>Ingen omgång är inlagd ännu. Den hämtas automatiskt på torsdagar.</p>
          </BigCard>
          <BigCard title="Min uppgift">
            <p className="font-medium">Du behöver inte göra något just nu.</p>
          </BigCard>
          {latest && <SenasteResultat roundId={latest.id} />}
        </div>
      )}
      {next && (
        <div className="mt-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Nästa vecka</CardTitle>
            </CardHeader>
            <CardContent className="text-lg">
              <p className="font-semibold">
                {formatDate(next.race_date)} ·{" "}
                {(next as any).tracks?.name ?? "Bana inte klar ännu"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Den här omgången är inte aktuell ännu. Uppgifterna fylls på automatiskt på
                torsdagen.
              </p>
              <Button asChild variant="secondary" className="mt-3 h-12">
                <Link to="/omgangar/$roundId" params={{ roundId: next.id }}>
                  Titta på nästa omgång
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="mt-5">
        <HistoryChartCard />
      </div>
    </>
  );
}

function ActiveRound({ roundId, latestId }: { roundId: string; latestId: string | null }) {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const { data, isLoading, error } = useRoundData(roundId);
  const { data: responsibility, isLoading: respLoading } = useRoundResponsibility(roundId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data)
    return (
      <EmptyState
        title="Omgången kunde inte visas"
        description="Prova att ladda om sidan."
      />
    );

  const { round, races, systems } = data;
  const responsibleName =
    (responsibility as any)?.profiles?.display_name ??
    (respLoading ? "Hämtar …" : "Ingen utsedd ännu");
  const iAmResponsible = !!user && (responsibility as any)?.user_id === user.id;

  const aiNotes = races
    .map((r: any) => ({
      leg: r.leg_number,
      note: r.group_race_assessments?.[0]?.notes ?? r.pace_notes ?? null,
    }))
    .filter((r) => r.note);

  const versions = (systems as any[]).flatMap((s) =>
    (s.system_versions ?? []).map((v: any) => ({ ...v, systemName: s.name })),
  );
  const currentVersion =
    versions.filter((v) => v.locked_at).sort((a, b) => (a.locked_at < b.locked_at ? 1 : -1))[0] ??
    versions.sort((a, b) => (a.version_number < b.version_number ? 1 : -1))[0] ??
    null;

  return (
    <div className="space-y-5">
      <BigCard title="Veckans V85 – den här spelar vi nu">
        <p className="text-2xl font-semibold">
          {formatDate(round.race_date)} · {(round as any).tracks?.name ?? "Bana ej vald"}
        </p>
        <p className="mt-1 text-muted-foreground">
          Spelstopp {formatDateTime(round.bet_stop_at)} · Budget {formatCurrency(Number(round.budget))}
        </p>
        <Button asChild size="lg" className="mt-4 h-14 w-full text-lg sm:w-auto">
          <Link to="/omgangar/$roundId" params={{ roundId }}>
            Öppna omgången
          </Link>
        </Button>
      </BigCard>

      <BigCard title="Veckans ansvarige">
        <p className="text-2xl font-semibold">{responsibleName}</p>
        <p className="mt-1 text-muted-foreground">
          Ansvarig väljer system och lämnar in spelet hos ATG.
        </p>
      </BigCard>

      <BigCard title="Min uppgift">
        {iAmResponsible ? (
          <>
            <p className="font-medium">
              {profile?.display_name ?? "Du"}, du är ansvarig den här veckan.
            </p>
            <p className="mt-1 text-muted-foreground">
              Välj systemförslag, gör eventuella justeringar och lämna in hos ATG.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">Du behöver inte göra något just nu.</p>
            <p className="mt-1 text-muted-foreground">
              Vill du vara med och tycka till? Läs analysen och skriv en kommentar.
            </p>
          </>
        )}
      </BigCard>

      <BigCard title="AI:s senaste analys">
        {aiNotes.length === 0 ? (
          <p className="text-muted-foreground">Ingen analys är gjord ännu för den här omgången.</p>
        ) : (
          <ul className="space-y-2">
            {aiNotes.slice(0, 3).map((r) => (
              <li key={r.leg}>
                <span className="font-medium">Avdelning {r.leg}: </span>
                <span className="text-muted-foreground">{String(r.note).slice(0, 180)}</span>
              </li>
            ))}
          </ul>
        )}
      </BigCard>

      <BigCard title="Aktuellt systemförslag">
        {!currentVersion ? (
          <p className="text-muted-foreground">Inget systemförslag är skapat ännu.</p>
        ) : (
          <>
            <p className="text-2xl font-semibold">
              {currentVersion.calculated_rows} rader ·{" "}
              {formatCurrency(Number(currentVersion.calculated_cost))}
            </p>
            <p className="mt-1 text-muted-foreground">
              {currentVersion.locked_at ? "Färdigt system" : "Förslag, ej färdigt"}
            </p>
          </>
        )}
      </BigCard>

      <Button asChild size="lg" className="h-16 w-full text-xl">
        <Link to="/kommentera">
          Läs och kommentera <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
        </Link>
      </Button>

      {latestId ? (
        <SenasteResultat roundId={latestId} />
      ) : (
        <BigCard title="Senaste resultat">
          <p className="text-muted-foreground">Inga avgjorda omgångar ännu.</p>
        </BigCard>
      )}
    </div>
  );
}

function SenasteResultat({ roundId }: { roundId: string }) {
  const { data, isLoading, error } = useRoundData(roundId);

  return (
    <BigCard title="Senaste resultat">
      {isLoading ? (
        <p className="text-muted-foreground">Hämtar …</p>
      ) : error || !data ? (
        <p className="text-muted-foreground">Resultatet kunde inte hämtas just nu.</p>
      ) : (
        <>
          <p className="text-xl font-semibold">
            {formatDate(data.round.race_date)} ·{" "}
            {(data.round as any).tracks?.name ?? "Bana ej vald"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {data.roundResult
              ? `Vinst ${formatCurrency(Number(data.roundResult.group_winnings ?? 0))}`
              : "Inget resultat registrerat."}
          </p>
          <Button asChild variant="link" className="mt-2 px-0 text-lg">
            <Link to="/resultat">Se alla resultat</Link>
          </Button>
        </>
      )}
    </BigCard>
  );
}
