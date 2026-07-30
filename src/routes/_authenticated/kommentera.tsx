import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useActiveGroupId, useRoundData, useRounds } from "@/lib/travhub-queries";
import { formatDate } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/kommentera")({
  head: () => ({
    meta: [
      { title: "Kommentera – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Läs datorns analys av veckans V85 och skriv vad du tycker om varje avdelning.",
      },
      { property: "og:title", content: "Kommentera – Familjen Olssons Travhub" },
      { property: "og:description", content: "Läs analysen och tyck till – inget måste godkännas." },
    ],
  }),
  component: KommenteraPage,
});

function KommenteraPage() {
  const { groupId } = useActiveGroupId();
  const { data: rounds, isLoading, error } = useRounds(groupId);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Läs och kommentera" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  const active = rounds?.find((r) => r.status !== "completed") ?? null;

  if (error || !active) {
    return (
      <>
        <PageHeader title="Läs och kommentera" />
        <EmptyState
          title={error ? "Det gick inte att hämta omgången" : "Ingen omgång att kommentera ännu"}
          description={
            error ? "Prova att ladda om sidan." : "Veckans omgång hämtas automatiskt på torsdagar."
          }
        />
      </>
    );
  }

  return <Kommentarer roundId={active.id} groupId={groupId!} />;
}

function Kommentarer({ roundId, groupId }: { roundId: string; groupId: string }) {
  const { data, isLoading, error } = useRoundData(roundId);
  const qc = useQueryClient();

  const { data: comments } = useQuery({
    queryKey: ["comments", roundId],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from("comments")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });
      if (err) throw err;
      return rows ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data)
    return (
      <>
        <PageHeader title="Läs och kommentera" />
        <EmptyState title="Omgången kunde inte visas" description="Prova att ladda om sidan." />
      </>
    );

  return (
    <>
      <PageHeader
        title="Läs och kommentera"
        description={`${formatDate(data.round.race_date)} · ${
          (data.round as any).tracks?.name ?? "Bana ej vald"
        }. Datorn har gjort analysen – du behöver bara läsa och tycka till.`}
      />

      <div className="space-y-5">
        {data.races.map((race: any) => (
          <RaceComment
            key={race.id}
            race={race}
            roundId={roundId}
            groupId={groupId}
            comments={(comments ?? []).filter(
              (c: any) => c.entity_type === "race" && c.entity_id === race.id,
            )}
            onSaved={() => qc.invalidateQueries({ queryKey: ["comments", roundId] })}
          />
        ))}
        {data.races.length === 0 && (
          <EmptyState title="Startfältet är inte inläst ännu" />
        )}
      </div>
    </>
  );
}

function RaceComment({
  race,
  roundId,
  groupId,
  comments,
  onSaved,
}: {
  race: any;
  roundId: string;
  groupId: string;
  comments: any[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const note = race.group_race_assessments?.[0]?.notes ?? race.pace_notes ?? null;

  async function send(asRisk: boolean) {
    if (!text.trim()) return toast.error("Skriv något först.");
    setBusy(true);
    try {
      if (asRisk) {
        const { error } = await supabase.from("risk_flags").insert({
          round_id: roundId,
          race_id: race.id,
          created_by: user!.id,
          flag_type: "observation",
          body: text.trim(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comments").insert({
          group_id: groupId,
          entity_type: "race",
          entity_id: race.id,
          body: text.trim(),
          created_by: user!.id,
        });
        if (error) throw error;
      }
      setText("");
      toast.success(asRisk ? "Varningen är noterad." : "Tack, din kommentar är sparad.");
      onSaved();
    } catch (e: any) {
      console.error("[travhub] kunde inte spara kommentar", e);
      toast.error("Det gick inte att spara just nu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">
          Avdelning {race.leg_number}
          {race.name ? ` · ${race.name}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-base">
        <div>
          <p className="font-medium">Datorns analys</p>
          <p className="text-muted-foreground">
            {note ?? "Ingen analys är gjord för den här avdelningen ännu."}
          </p>
        </div>

        {comments.length > 0 && (
          <ul className="space-y-1 rounded-md bg-muted/40 p-3">
            {comments.map((c) => (
              <li key={c.id} className="text-muted-foreground">
                {c.body}
              </li>
            ))}
          </ul>
        )}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Vad tycker du om den här avdelningen?"
          className="min-h-24 text-base"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={busy} onClick={() => send(false)}>
            Skicka kommentar
          </Button>
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => send(true)}>
            Flagga som varning
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
