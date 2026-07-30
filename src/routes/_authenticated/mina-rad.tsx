import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useActiveGroupId } from "@/lib/travhub-queries";
import { generateMyReview } from "@/lib/personal-review.functions";

export const Route = createFileRoute("/_authenticated/mina-rad")({
  head: () => ({
    meta: [
      { title: "Mina råd – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Personlig genomgång av dina egna bedömningar mot facit, med råd inför nästa V85-omgång.",
      },
      { property: "og:title", content: "Mina råd – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Se vad du är bra på och vad du kan träna på till nästa omgång.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MinaRadPage,
});

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}

function MinaRadPage() {
  const { user } = useAuth();
  const { groupId } = useActiveGroupId();
  const qc = useQueryClient();
  const run = useServerFn(generateMyReview);

  const latest = useQuery({
    queryKey: ["personal-review", groupId, user?.id],
    enabled: !!groupId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_recommendations")
        .select("*")
        .eq("group_id", groupId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: () => run({ data: { groupId: groupId! } }),
    onSuccess: () => {
      toast.success("Din genomgång är klar.");
      qc.invalidateQueries({ queryKey: ["personal-review", groupId, user?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Något gick fel."),
  });

  const review: any = latest.data;
  const stats: any = review?.stats ?? {};

  const pct = (v: any) => (v === null || v === undefined ? "–" : `${v} %`);
  const lean = (v: any) =>
    v === null || v === undefined
      ? "–"
      : v > 0
        ? `+${v} procentenheter över marknaden`
        : `${v} procentenheter under marknaden`;

  return (
    <>
      <PageHeader
        title="Mina råd"
        description="En genomgång av dina egna bedömningar jämfört med hur loppen faktiskt gick."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-muted-foreground">
            Tryck på knappen så går datorn igenom dina tidigare bedömningar och skriver personliga råd till just
            dig. Ingen annan ser dina råd, och ingenting ändras i era spel.
          </p>
          <Button
            size="lg"
            className="h-14 text-base"
            disabled={!groupId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Går igenom dina lopp…" : "Gör en genomgång åt mig"}
          </Button>
        </CardContent>
      </Card>

      {latest.isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar…</p>
      ) : !review ? (
        <p className="rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          Du har ingen genomgång ännu. Den bygger på lopp där du gjort en egen bedömning och resultatet är
          registrerat – minst tre lopp behövs.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Så här bedömer du lopp</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-line text-base leading-relaxed">
                {review.summary}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Det här gör du bra</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-line text-base leading-relaxed">
                {review.strengths}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Det här kan du bli bättre på</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-line text-base leading-relaxed">
                {review.improvements}
              </CardContent>
            </Card>
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Din enda uppgift till nästa omgång</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-line text-base font-medium leading-relaxed">
                {review.next_focus}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Dina siffror</CardTitle>
            </CardHeader>
            <CardContent>
              <StatRow label="Omgångar med i underlaget" value={String(stats.rounds ?? 0)} />
              <StatRow label="Avgjorda lopp" value={String(stats.races ?? 0)} />
              <StatRow
                label="Ditt förstaval vann"
                value={`${stats.topPickWins ?? 0} gånger (${pct(stats.topPickHitRate)})`}
              />
              <StatRow label="Din tro på vinnaren i snitt" value={pct(stats.avgProbabilityOnWinner)} />
              <StatRow label="Din tro på ditt förstaval" value={pct(stats.avgProbabilityOnTopPick)} />
              <StatRow label="Storfavoriter" value={lean(stats.favouriteLean)} />
              <StatRow label="Lågt streckade hästar" value={lean(stats.longshotLean)} />
              <StatRow
                label="Spärrade hästar som vann"
                value={String(stats.excludedWinners ?? 0)}
              />
              <StatRow
                label="Missade vinnare, snittstreck"
                value={pct(stats.missedWinnerAvgMarket)}
              />
              <p className="pt-3 text-xs text-muted-foreground">
                Skapad {new Date(review.created_at).toLocaleDateString("sv-SE")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
