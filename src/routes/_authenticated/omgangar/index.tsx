import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getDashboard } from "@/lib/dashboard.functions";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { HistoryChartCard } from "@/components/HistoryChartCard";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUND_STATUS_LABELS, formatCurrency, formatDate, formatDateTime } from "@/lib/labels";
import { useActiveGroupId, useRounds } from "@/lib/travhub-queries";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/omgangar/")({
  head: () => ({
    meta: [
      { title: "Omgångar i hubben – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Omgångar som skapats i Travhubben, plus familjens samlade V85-historik.",
      },
      { property: "og:title", content: "Omgångar i hubben – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Följ hur familjens V85-spel gått omgång för omgång.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

  component: OmgangarPage,
});


function kr(v: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(v);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={
            "mt-1 text-2xl font-bold " +
            (tone === "good" ? "text-emerald-500" : tone === "bad" ? "text-destructive" : "")
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function OmgangarPage() {
  const { groupId } = useActiveGroupId();
  const { data: rounds, isLoading, error: roundsError, refetch } = useRounds(groupId);
  const roundsLoading = !groupId || isLoading;
  const run = useServerFn(getDashboard);

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard", groupId],
    enabled: !!groupId,
    queryFn: () => run({ data: { groupId: groupId! } }),
  });

  const byRound = new Map<string, any>((dash?.rounds ?? []).map((r: any) => [r.roundId, r]));

  return (
    <>
      <PageHeader
        title="Omgångar i hubben"
        description="Omgångar som skapats här i Travhubben. Längst ned ser du hur alla våra spel har gått."
        actions={groupId ? <NewRoundDialog groupId={groupId} onCreated={refetch} /> : null}
      />

      {dashLoading ? (
        <Skeleton className="mb-8 h-28 w-full" />
      ) : dash && dash.totals.rounds > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Sammanlagt i hubben</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Spelade omgångar" value={String(dash.totals.rounds)} />
            <Stat label="Satsat totalt" value={kr(dash.totals.cost)} />
            <Stat label="Vunnit totalt" value={kr(dash.totals.winnings)} tone="good" />
            <Stat
              label="Netto"
              value={kr(dash.totals.net)}
              tone={dash.totals.net >= 0 ? "good" : "bad"}
            />
            <Stat
              label="Omgångar med vinst"
              value={`${dash.totals.roundsWithWin} av ${dash.totals.rounds}`}
            />
            <Stat
              label="Rätt avdelningar i snitt"
              value={dash.totals.avgCorrectLegs === null ? "–" : `${dash.totals.avgCorrectLegs} av 8`}
            />
            <Stat
              label="Bästa omgång, rätt"
              value={dash.totals.bestCorrectLegs === null ? "–" : `${dash.totals.bestCorrectLegs} av 8`}
            />
            <Stat
              label="Bästa omgång, netto"
              value={dash.totals.bestRound ? kr(dash.totals.bestRound.net) : "–"}
              tone="good"
            />
          </div>
        </section>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">
          Ingen omgång i hubben har fått resultat inlagt ännu. Alla tidigare spel finns under{" "}
          <Link to="/historik" className="underline">
            Historik
          </Link>
          .
        </p>
      )}



      <h2 className="mb-3 text-lg font-semibold">Omgång för omgång</h2>
      {roundsLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : roundsError ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-base font-medium">Vi kunde inte hämta omgångarna.</p>
            <p className="text-sm text-muted-foreground">
              Kontrollera anslutningen och försök igen.
            </p>
            <Button onClick={() => refetch()}>Försök igen</Button>
          </CardContent>
        </Card>
      ) : !rounds || rounds.length === 0 ? (
        <EmptyState
          title="Inga omgångar ännu"
          description="Det finns ännu ingen V85-omgång här. Mats kan skapa eller importera nästa omgång."
        />
      ) : (
        <div className="space-y-3">
          {rounds.map((r: any) => {
            const d = byRound.get(r.id);
            const hasEconomy = !!d && (d.cost > 0 || d.winnings > 0);
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-serif text-lg font-semibold">
                      {formatDate(r.race_date)} · {r.tracks?.name ?? "Bana ej vald"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Spelstopp {formatDateTime(r.bet_stop_at)} · Budget{" "}
                      {formatCurrency(Number(r.budget))}
                    </p>
                    <p className="mt-1 text-sm">
                      {d && d.correctLegs !== null ? (
                        <span className="font-medium">
                          {d.correctLegs} av {d.legs || 8} rätt
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Inget resultat ännu</span>
                      )}
                      {hasEconomy ? (
                        <>
                          <span className="text-muted-foreground"> · </span>
                          <span>
                            Insats {kr(d.cost)} · Vinst {kr(d.winnings)} ·{" "}
                            <span
                              className={
                                "font-semibold " +
                                (d.net > 0
                                  ? "text-emerald-500"
                                  : d.net < 0
                                    ? "text-destructive"
                                    : "")
                              }
                            >
                              Netto {kr(d.net)}
                            </span>
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.is_demo && <Badge variant="outline">Demo</Badge>}
                    <Badge variant="secondary">{ROUND_STATUS_LABELS[r.status] ?? r.status}</Badge>
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/omgangar/$roundId" params={{ roundId: r.id }}>
                        Öppna
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <HistoryChartCard />
      </div>
    </>

  );
}

function NewRoundDialog({ groupId, onCreated }: { groupId: string; onCreated: () => void }) {
  const navigate = useNavigate();

  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [betStop, setBetStop] = useState("");
  const [budget, setBudget] = useState("450");

  async function create() {
    if (!raceDate || !betStop) return toast.error("Fyll i datum och spelstopp.");
    setBusy(true);
    try {
      let trackId: string | null = null;
      if (trackName.trim()) {
        const { data: existing } = await supabase
          .from("tracks")
          .select("id")
          .ilike("name", trackName.trim())
          .maybeSingle();
        if (existing) trackId = existing.id;
        else {
          const { data: inserted, error } = await supabase
            .from("tracks")
            .insert({ name: trackName.trim() })
            .select("id")
            .single();
          if (error) throw error;
          trackId = inserted.id;
        }
      }

      const { data: round, error } = await supabase
        .from("rounds")
        .insert({
          group_id: groupId,
          created_by: user!.id,
          track_id: trackId,
          race_date: raceDate,
          bet_stop_at: new Date(betStop).toISOString(),
          budget: Number(budget),
        })
        .select("id")
        .single();
      if (error) throw error;

      const races = Array.from({ length: 8 }, (_, i) => ({
        round_id: round.id,
        leg_number: i + 1,
      }));
      const { error: racesError } = await supabase.from("races").insert(races);
      if (racesError) throw racesError;

      toast.success("Omgången är skapad med åtta avdelningar.");
      setOpen(false);
      onCreated();
      navigate({ to: "/omgangar/$roundId", params: { roundId: round.id } });
    } catch (e: any) {
      toast.error("Kunde inte skapa omgången: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Ny omgång</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ny V85-omgång</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="track">Bana</Label>
            <Input
              id="track"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
              placeholder="t.ex. Solvalla"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Speldatum</Label>
            <Input
              id="date"
              type="date"
              value={raceDate}
              onChange={(e) => setRaceDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stop">Spelstopp</Label>
            <Input
              id="stop"
              type="datetime-local"
              value={betStop}
              onChange={(e) => setBetStop(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget">Budget (kr)</Label>
            <Input
              id="budget"
              type="number"
              min="0"
              step="0.5"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={busy}>
            {busy ? "Skapar …" : "Skapa omgång"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
