import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateTime } from "@/lib/labels";
import { useActiveGroupId, useOwnerStatus } from "@/lib/travhub-queries";
import { REVIEW_LABEL, type ReviewStatus } from "@/lib/history-review";
import {
  listHistoryDuplicates,
  resolveHistoryDuplicate,
} from "@/lib/history-review.functions";

export const Route = createFileRoute("/_authenticated/historik-dubbletter")({
  head: () => ({
    meta: [
      { title: "Granska dubbletter – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Jämför historikposter som gäller samma bana och tävlingsdag och bestäm vilken som ska räknas.",
      },
      { property: "og:title", content: "Granska dubbletter – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Sida vid sida-jämförelse av dubbla historikposter. Ingen post raderas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DubbletterPage,
});

const ACTIONS = [
  { key: "keep_both", label: "Behåll båda som olika system" },
  { key: "mark_superseded", label: "Markera den andra som ersatt" },
  { key: "merge_metadata", label: "Slå samman metadata till den valda" },
  { key: "archive", label: "Arkivera den andra som felaktig" },
] as const;

const kr = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? formatCurrency(n) : "–";
};
const txt = (v: unknown) => (v === null || v === undefined || v === "" ? "–" : String(v));

function legsText(legs: unknown): string {
  if (!Array.isArray(legs) || legs.length === 0) return "–";
  return legs
    .map((l: any) => {
      const picked = Array.isArray(l?.selected) ? l.selected : [];
      return `V85-${txt(l?.leg)}: ${picked.length ? picked.join(", ") : "–"}`;
    })
    .join(" | ");
}

function DubbletterPage() {
  const { groupId } = useActiveGroupId();
  const { isOwner, isLoading: ownerLoading, isError: ownerError } = useOwnerStatus(groupId);
  const fetchGroups = useServerFn(listHistoryDuplicates);
  const resolveFn = useServerFn(resolveHistoryDuplicate);
  const qc = useQueryClient();

  const [choice, setChoice] = useState<Record<string, { keepId: string; action: string; note: string }>>(
    {},
  );

  const query = useQuery({
    queryKey: ["history-duplicates", groupId],
    enabled: Boolean(groupId) && isOwner,
    queryFn: () => fetchGroups({ data: { groupId: groupId! } }) as Promise<any>,
  });

  const mutation = useMutation({
    mutationFn: (vars: any) => resolveFn({ data: vars }) as Promise<any>,
    onSuccess: () => {
      toast.success("Beslutet är sparat. Ingen post har raderats.");
      qc.invalidateQueries({ queryKey: ["history-duplicates"] });
      qc.invalidateQueries({ queryKey: ["history-stats"] });
      qc.invalidateQueries({ queryKey: ["imported-history"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Det gick inte att spara beslutet."),
  });

  if (ownerLoading) {
    return (
      <>
        <PageHeader title="Granska dubbletter" description="Hämtar din behörighet …" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }
  if (ownerError) {
    return (
      <>
        <PageHeader title="Granska dubbletter" />
        <Card>
          <CardContent className="p-6 text-base">
            Behörigheten kunde inte kontrolleras. Ladda om sidan och försök igen.
          </CardContent>
        </Card>
      </>
    );
  }
  if (!isOwner) {
    return (
      <>
        <PageHeader title="Granska dubbletter" description="Endast Mats granskar historiken." />
        <Card>
          <CardContent className="p-6 text-base text-muted-foreground">
            Den här sidan sköts av gruppens ägare. Behörigheten kontrolleras även på servern.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Granska dubbletter"
        description="Samma bana och tävlingsdag finns med flera gånger. Jämför posterna och bestäm vilken som ska räknas. Ingenting raderas."
      />

      {query.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-base">
            Det gick inte att hämta dubbletterna. Ladda om sidan och försök igen.
          </CardContent>
        </Card>
      ) : (query.data?.groups?.length ?? 0) === 0 ? (
        <EmptyState
          title="Inga dubbletter"
          description="Alla historikposter gäller varsin tävlingsdag."
        />
      ) : (
        <div className="space-y-6">
          <p className="text-base">
            {query.data.unresolved} av {query.data.groups.length} tävlingsdagar väntar på beslut.
            Statistiken är pausad tills alla är granskade.
          </p>

          {query.data.groups.map((g: any) => {
            const sel = choice[g.key] ?? {
              keepId: g.rows[0].id,
              action: "mark_superseded",
              note: "",
            };
            const other = g.rows.find((r: any) => r.id !== sel.keepId) ?? g.rows[1];
            return (
              <Card key={g.key}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl">
                      {g.track} · {g.date}
                    </CardTitle>
                    <Badge variant={g.resolved ? "secondary" : "destructive"}>
                      {g.resolved ? "Granskad" : "Väntar på beslut"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {g.rows.map((r: any) => (
                      <div
                        key={r.id}
                        className={`rounded-lg border p-4 text-base ${
                          r.id === sel.keepId ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">Post {r.idempotency_key}</p>
                          <Badge variant="secondary">
                            {REVIEW_LABEL[(r.review_status ?? "unreviewed") as ReviewStatus]}
                          </Badge>
                        </div>
                        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                          <dt className="text-muted-foreground">Importerad</dt>
                          <dd>{formatDateTime(r.created_at)}</dd>
                          <dt className="text-muted-foreground">Källa</dt>
                          <dd>{txt(r.source)}</dd>
                          <dt className="text-muted-foreground">Val per avdelning</dt>
                          <dd>{legsText(r.legs)}</dd>
                          <dt className="text-muted-foreground">Rader (angivet/beräknat)</dt>
                          <dd>
                            {txt(r.stated_rows)} / {txt(r.computed_rows)}
                          </dd>
                          <dt className="text-muted-foreground">Kostnad (angivet/beräknat)</dt>
                          <dd>
                            {kr(r.stated_cost)} / {kr(r.computed_cost)}
                          </dd>
                          <dt className="text-muted-foreground">Vinnarrad</dt>
                          <dd>
                            {Array.isArray(r.winners) && r.winners.length
                              ? r.winners.join(", ")
                              : "–"}
                            {r.winners_verified ? " (verifierad)" : " (ej verifierad)"}
                          </dd>
                          <dt className="text-muted-foreground">Antal rätt</dt>
                          <dd>{txt(r.correct_count)}</dd>
                          <dt className="text-muted-foreground">Spikar / spikträffar</dt>
                          <dd>
                            {Array.isArray(r.spikes) && r.spikes.length ? r.spikes.join(", ") : "–"}
                            {" / "}
                            {txt(r.spike_hits)}
                          </dd>
                          <dt className="text-muted-foreground">Utbetalning</dt>
                          <dd>{kr(r.payout)}</dd>
                          <dt className="text-muted-foreground">Netto</dt>
                          <dd>{kr(r.net_result)}</dd>
                          <dt className="text-muted-foreground">Datakvalitet</dt>
                          <dd>{txt(r.data_quality)}</dd>
                        </dl>
                        <Button
                          variant={r.id === sel.keepId ? "default" : "secondary"}
                          className="mt-3 h-12 w-full"
                          onClick={() =>
                            setChoice((c) => ({ ...c, [g.key]: { ...sel, keepId: r.id } }))
                          }
                        >
                          {r.id === sel.keepId ? "Vald som huvudpost" : "Välj den här som huvudpost"}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="font-medium">Vad ska hända?</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ACTIONS.map((a) => (
                        <Button
                          key={a.key}
                          variant={sel.action === a.key ? "default" : "secondary"}
                          className="h-12 justify-start text-left"
                          onClick={() =>
                            setChoice((c) => ({ ...c, [g.key]: { ...sel, action: a.key } }))
                          }
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-base font-medium"
                        htmlFor={`note-${g.key}`}
                      >
                        Motivering (sparas i loggen)
                      </label>
                      <Textarea
                        id={`note-${g.key}`}
                        value={sel.note}
                        onChange={(e) =>
                          setChoice((c) => ({ ...c, [g.key]: { ...sel, note: e.target.value } }))
                        }
                        placeholder="T.ex. Kvittot från ATG är rätt, den första posten var en tidig gissning."
                      />
                    </div>
                    <Button
                      className="h-12 w-full sm:w-auto"
                      disabled={mutation.isPending || sel.note.trim().length < 5 || !other}
                      onClick={() =>
                        mutation.mutate({
                          groupId,
                          keepId: sel.keepId,
                          otherId: other.id,
                          action: sel.action,
                          note: sel.note.trim(),
                        })
                      }
                    >
                      {mutation.isPending ? "Sparar …" : "Spara beslutet"}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Ingen post raderas. Arkiverade och ersatta poster finns kvar och kan ändras
                      igen.
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
