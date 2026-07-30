import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/AppShell";
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

export const Route = createFileRoute("/_authenticated/omgangar/")({
  head: () => ({
    meta: [
      { title: "Omgångar – Travhubben" },
      { name: "description", content: "Alla V85-omgångar: pågående, kommande och avslutade." },
      { property: "og:title", content: "Omgångar – Travhubben" },
      { property: "og:description", content: "Skapa och följ gruppens V85-omgångar." },
    ],
  }),
  component: OmgangarPage,
});

function OmgangarPage() {
  const { groupId } = useActiveGroupId();
  const { data: rounds, isLoading, refetch } = useRounds(groupId);

  return (
    <>
      <PageHeader
        title="Omgångar"
        description="Varje omgång innehåller åtta avdelningar, analyser, system och efterrapport."
        actions={groupId ? <NewRoundDialog groupId={groupId} onCreated={refetch} /> : null}
      />

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !rounds || rounds.length === 0 ? (
        <EmptyState
          title="Inga omgångar ännu"
          description="Skapa den första V85-omgången för gruppen."
        />
      ) : (
        <div className="space-y-3">
          {rounds.map((r: any) => (
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
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{ROUND_STATUS_LABELS[r.status] ?? r.status}</Badge>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/omgangar/$roundId" params={{ roundId: r.id }}>
                      Öppna
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function NewRoundDialog({ groupId, onCreated }: { groupId: string; onCreated: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [betStop, setBetStop] = useState("");
  const [budget, setBudget] = useState("500");

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
