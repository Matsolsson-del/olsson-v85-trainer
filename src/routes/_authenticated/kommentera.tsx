import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useActiveGroupId, useRoundData } from "@/lib/travhub-queries";
import { useCurrentRound } from "@/lib/current-round-queries";
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
  validateSearch: (search: Record<string, unknown>): { omgang?: string } =>
    typeof search.omgang === "string" && search.omgang ? { omgang: search.omgang } : {},
  component: KommenteraPage,
});

function KommenteraPage() {
  const { groupId } = useActiveGroupId();
  const { omgang } = Route.useSearch();
  const { data: active, isLoading, error } = useCurrentRound(groupId, omgang ?? null, "comment");

  if (isLoading) {
    return (
      <>
        <PageHeader title="Läs och kommentera" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

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

  return <Kommentarer key={active.id} roundId={active.id} groupId={groupId!} />;
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

        <GeneralComment
          roundId={roundId}
          groupId={groupId}
          comments={(comments ?? []).filter(
            (c: any) => c.entity_type === "round" && c.entity_id === roundId,
          )}
          onSaved={() => qc.invalidateQueries({ queryKey: ["comments", roundId] })}
        />
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
  const draftKey = `travhub-utkast-avd-${race.id}`;
  const [text, setText] = useState(() => readDraft(draftKey));
  const [spik, setSpik] = useState(() => readDraft(draftKey + "-spik"));
  const [skrall, setSkrall] = useState(() => readDraft(draftKey + "-skrall"));
  const [busy, setBusy] = useState(false);

  useEffect(() => saveDraft(draftKey, text), [draftKey, text]);
  useEffect(() => saveDraft(draftKey + "-spik", spik), [draftKey, spik]);
  useEffect(() => saveDraft(draftKey + "-skrall", skrall), [draftKey, skrall]);

  const note = race.group_race_assessments?.[0]?.notes ?? race.pace_notes ?? null;

  async function send(asRisk: boolean) {
    const extra = [
      spik.trim() ? `Min spik: ${spik.trim()}` : "",
      skrall.trim() ? `Min skräll: ${skrall.trim()}` : "",
    ]
      .filter(Boolean)
      .join(". ");
    const fullText = [text.trim(), extra].filter(Boolean).join(" — ");
    if (!fullText) return toast.error("Skriv något först.");
    setBusy(true);
    try {
      if (asRisk) {
        const { error } = await supabase.from("risk_flags").insert({
          round_id: roundId,
          race_id: race.id,
          created_by: user!.id,
          flag_type: "observation",
          body: fullText,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comments").insert({
          group_id: groupId,
          entity_type: "race",
          entity_id: race.id,
          body: fullText,
          created_by: user!.id,
        });
        if (error) throw error;
      }
      setText("");
      setSpik("");
      setSkrall("");
      saveDraft(draftKey, "");
      saveDraft(draftKey + "-spik", "");
      saveDraft(draftKey + "-skrall", "");
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-medium" htmlFor={`spik-${race.id}`}>
              Min spik här
            </label>
            <input
              id={`spik-${race.id}`}
              value={spik}
              onChange={(e) => setSpik(e.target.value)}
              placeholder="Nummer och namn"
              className="h-12 w-full rounded-md border border-border bg-card px-3 text-base text-card-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium" htmlFor={`skrall-${race.id}`}>
              Min skräll här
            </label>
            <input
              id={`skrall-${race.id}`}
              value={skrall}
              onChange={(e) => setSkrall(e.target.value)}
              placeholder="Nummer och namn"
              className="h-12 w-full rounded-md border border-border bg-card px-3 text-base text-card-foreground"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" className="h-14 text-lg" disabled={busy} onClick={() => send(false)}>
            Spara mina kommentarer
          </Button>
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => send(true)}>
            Flagga som varning
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function readDraft(key: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* utkastet sparas inte om lagringen är full */
  }
}

function GeneralComment({
  roundId,
  groupId,
  comments,
  onSaved,
}: {
  roundId: string;
  groupId: string;
  comments: any[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const draftKey = `travhub-utkast-omgang-${roundId}`;
  const [text, setText] = useState(() => readDraft(draftKey));
  const [busy, setBusy] = useState(false);

  useEffect(() => saveDraft(draftKey, text), [draftKey, text]);

  async function save() {
    if (!text.trim()) return toast.error("Skriv något först.");
    setBusy(true);
    try {
      const { error } = await supabase.from("comments").insert({
        group_id: groupId,
        entity_type: "round",
        entity_id: roundId,
        body: text.trim(),
        created_by: user!.id,
      });
      if (error) throw error;
      setText("");
      saveDraft(draftKey, "");
      toast.success("Tack, din kommentar är sparad.");
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
        <CardTitle className="text-xl">Något mer om hela omgången?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-base">
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
          placeholder="Skriv fritt om veckans omgång."
          className="min-h-24 text-base"
        />
        <p className="text-sm text-muted-foreground">
          Din text sparas automatiskt medan du skriver, även om du lämnar sidan.
        </p>
        <Button size="lg" className="h-14 text-lg" disabled={busy} onClick={save}>
          Spara mina kommentarer
        </Button>
      </CardContent>
    </Card>
  );
}
