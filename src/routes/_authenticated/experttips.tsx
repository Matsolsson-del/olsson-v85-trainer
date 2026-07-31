import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/labels";
import { useActiveGroupId } from "@/lib/travhub-queries";
import { listExpertTips, refreshExpertTips } from "@/lib/expert-tips.functions";
import { Sparkles, RefreshCw, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/experttips")({
  head: () => ({
    meta: [
      { title: "Experttips – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Veckans V85-tips från travsajter och bloggar, samlade och sammanfattade så att ni ser vad experterna är eniga och oense om.",
      },
      { property: "og:title", content: "Experttips – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Sammanfattning av vad travexperterna tycker inför veckans V85.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExperttipsPage,
});

type Claim = {
  leg?: number;
  horse?: string;
  note?: string;
  sourceUrls?: string[];
  consensusLevel?: string;
};

type Report = {
  id: string;
  race_date: string;
  track_name: string | null;
  status: string | null;
  summary: string | null;
  trends: Array<{ title?: string; text?: string }>;
  consensus: Claim[];
  disagreements: Claim[];
  legs: Array<{ leg?: number; text?: string; sourceUrls?: string[] }>;
  sources: Array<{ title?: string; url?: string }>;
  updated_at: string;
};

const CONSENSUS_LABEL: Record<string, string> = {
  clear: "Tydlig samsyn – minst tre verifierade källor",
  multiple: "Flera källor",
  single: "En källa",
  split: "Delade meningar",
  none: "Ingen verifierad källa",
};

function legLabel(leg?: number) {
  return leg && leg > 0 ? `Avd ${leg}` : "Allmänt";
}

/** Varje påstående visar hur många verifierade källor som står bakom det. */
function SourceRefs({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
      <span>{urls.length} verifierad(e) källa/källor:</span>
      {urls.slice(0, 4).map((u, i) => (
        <a
          key={i}
          href={u}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline underline-offset-4"
        >
          Källa {i + 1}
        </a>
      ))}
    </p>
  );
}

function HorseList({ items }: { items: Claim[]; tone?: "success" | "warning" }) {
  if (!items?.length)
    return (
      <p className="text-base text-muted-foreground">
        Inga verifierade experttips har hittats för den här delen ännu.
      </p>
    );
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {legLabel(item.leg)}
            </Badge>
            <span className="text-base font-semibold text-foreground">{item.horse ?? "—"}</span>
            {item.consensusLevel && (
              <Badge variant="outline" className="text-xs">
                {CONSENSUS_LABEL[item.consensusLevel] ?? item.consensusLevel}
              </Badge>
            )}
          </div>
          {item.note && <p className="mt-1 text-base text-muted-foreground">{item.note}</p>}
          <SourceRefs urls={item.sourceUrls} />
        </li>
      ))}
    </ul>
  );
}


function ExperttipsPage() {
  const { groupId } = useActiveGroupId();
  const qc = useQueryClient();
  const fetchTips = useServerFn(listExpertTips);
  const refresh = useServerFn(refreshExpertTips);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["expert-tips", groupId],
    enabled: Boolean(groupId),
    queryFn: () => fetchTips({ data: { groupId: groupId! } }) as Promise<Report[]>,
  });

  const mutation = useMutation({
    mutationFn: () => refresh({ data: { groupId: groupId! } }),
    onMutate: () => setError(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert-tips", groupId] }),
    onError: (e: any) =>
      setError(e?.message ?? "Det gick inte att hämta experttips just nu. Försök igen senare."),
  });

  const reports = query.data ?? [];
  const latest = reports[0];
  const older = reports.slice(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experttips"
        description="Varje torsdag samlas tips och analyser in från travsajter och bloggar. Här ser ni vad experterna är eniga om och var de tycker olika. Det är bara underlag – ni bestämmer själva."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base text-muted-foreground">
            {latest
              ? `Senast uppdaterat ${formatDateTime(latest.updated_at)}`
              : "Inga tips insamlade ännu."}
          </p>
          <Button
            size="lg"
            className="h-12 text-base"
            onClick={() => mutation.mutate()}
            disabled={!groupId || mutation.isPending}
          >
            <RefreshCw className={mutation.isPending ? "mr-2 animate-spin" : "mr-2"} />
            {mutation.isPending ? "Hämtar tips…" : "Hämta tips nu"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-base text-destructive">{error}</CardContent>
        </Card>
      )}

      {query.isLoading && <Skeleton className="h-64 w-full" />}

      {!query.isLoading && !latest && (
        <EmptyState
          title="Inga experttips ännu"
          description="Tryck på Hämta tips nu, så samlar hubben in veckans tips från travsajter och bloggar."
        />
      )}

      {latest && (
        <div className="space-y-6">
          {latest.status === "no_verified_tips" && (
            <Card className="border-warning">
              <CardContent className="p-4 text-base">
                Inga verifierade experttips har hittats ännu. Sidorna som granskades gällde en annan
                spelform, en annan omgång eller saknade spelförslag. AI kan ändå analysera
                tävlingsfakta, men ingen expertsamsyn redovisas.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                <Sparkles className="text-primary" />
                Veckans läge – {formatDate(latest.race_date)}
                {latest.track_name && (
                  <Badge variant="secondary" className="text-sm">
                    {latest.track_name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-lg leading-relaxed text-foreground">
                {latest.summary ?? "Ingen sammanfattning."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Trender i resonemangen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latest.trends?.length ? (
                latest.trends.map((t, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-base font-semibold text-foreground">{t.title}</p>
                    <p className="text-base text-muted-foreground">{t.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-base text-muted-foreground">Inga trender hittades.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Här är experterna eniga</CardTitle>
              </CardHeader>
              <CardContent>
                <HorseList items={latest.consensus} tone="success" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Här tycker de olika</CardTitle>
              </CardHeader>
              <CardContent>
                <HorseList items={latest.disagreements} tone="warning" />
              </CardContent>
            </Card>
          </div>

          {latest.legs?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Avdelning för avdelning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latest.legs.map((l, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-base font-semibold text-foreground">{legLabel(l.leg)}</p>
                    <p className="text-base text-muted-foreground">{l.text}</p>
                    <SourceRefs urls={l.sourceUrls} />
                  </div>
                ))}

              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Källor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {latest.sources?.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-base text-primary underline underline-offset-4"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.title || s.url}</span>
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {older.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Tidigare veckor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {older.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-surface p-3 text-base text-muted-foreground"
              >
                <span className="font-semibold text-foreground">
                  {formatDate(r.race_date)} {r.track_name ? `– ${r.track_name}` : ""}
                </span>
                <p className="line-clamp-3">{r.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
