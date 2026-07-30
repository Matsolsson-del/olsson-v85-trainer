import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { AiImportCard } from "@/components/round/AiImportCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/labels";
import {
  useActiveGroupId,
  useInvalidateRound,
  useRoundData,
  useRounds,
} from "@/lib/travhub-queries";
import { useRoundResponsibility } from "@/lib/responsibility-queries";
import {
  evaluateReadiness,
  freshnessLabel,
  useBetSnapshot,
  useDataOrigin,
  useFinalCheck,
  useSystemCandidates,
} from "@/lib/readiness-queries";
import {
  applyCandidateNow,
  buildSystemsNow,
  generateAiDraftNow,
  importResultsNow,
} from "@/lib/automation.functions";
import { markBetSubmitted, runFinalCheckNow } from "@/lib/workflow.functions";

export const Route = createFileRoute("/_authenticated/veckans-spel")({
  head: () => ({
    meta: [
      { title: "Veckans spel – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Hela veckans V85 i ett flöde: underlag, AI-analys, kommentarer, systemförslag, ansvarig, inlämning, resultat och efterrapport.",
      },
      { property: "og:title", content: "Veckans spel – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Ett sammanhängande arbetsflöde för familjens V85-omgång.",
      },
    ],
  }),
  component: VeckansSpel,
});

function Step({
  number,
  title,
  state,
  children,
}: {
  number: number;
  title: string;
  state: "klar" | "pagar" | "vantar";
  children: React.ReactNode;
}) {
  const Icon = state === "klar" ? CheckCircle2 : state === "pagar" ? AlertTriangle : Circle;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary">
            {number}
          </span>
          <span className="flex-1">{title}</span>
          <Icon
            className={
              state === "klar"
                ? "h-6 w-6 text-primary"
                : state === "pagar"
                  ? "h-6 w-6 text-amber-400"
                  : "h-6 w-6 text-muted-foreground"
            }
            aria-hidden
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-base leading-relaxed">{children}</CardContent>
    </Card>
  );
}

function VeckansSpel() {
  const { groupId } = useActiveGroupId();
  const { data: rounds, isLoading, error } = useRounds(groupId);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Veckans spel" />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  const active = rounds?.find((r) => r.status !== "completed" && !r.is_demo) ?? null;

  if (error) {
    return (
      <>
        <PageHeader title="Veckans spel" />
        <EmptyState
          title="Det gick inte att hämta omgången"
          description="Prova att ladda om sidan."
        />
      </>
    );
  }

  if (!active) {
    return (
      <>
        <PageHeader title="Veckans spel" />
        <EmptyState
          title="Ingen omgång den här veckan ännu"
          description="Omgången hämtas automatiskt på torsdagar."
          action={
            <Button asChild size="lg" className="h-14 text-lg">
              <Link to="/omgangar">Se tidigare omgångar</Link>
            </Button>
          }
        />
      </>
    );
  }

  return <Workflow roundId={active.id} />;
}

function Workflow({ roundId }: { roundId: string }) {
  const qc = useQueryClient();
  const invalidateRound = useInvalidateRound(roundId);
  const { data, isLoading } = useRoundData(roundId);
  const { data: responsibility } = useRoundResponsibility(roundId);
  const { data: origin } = useDataOrigin(roundId);
  const { data: candidates } = useSystemCandidates(roundId);
  const { data: finalCheck } = useFinalCheck(roundId);
  const { data: snapshot } = useBetSnapshot(roundId);
  const [busy, setBusy] = useState<string | null>(null);

  const comments = useQuery({
    queryKey: ["round-comments", roundId],
    queryFn: async () => {
      const raceIds = (data?.races ?? []).map((r: any) => r.id);
      const { data: rows, error } = await supabase
        .from("comments")
        .select("id, body, created_at, entity_id")
        .in("entity_id", [roundId, ...raceIds])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return rows ?? [];
    },
    enabled: !!data,
  });

  const draft = useServerFn(generateAiDraftNow);
  const systems = useServerFn(buildSystemsNow);
  const results = useServerFn(importResultsNow);
  const apply = useServerFn(applyCandidateNow);
  const finalCheckFn = useServerFn(runFinalCheckNow);
  const submitFn = useServerFn(markBetSubmitted);

  const readiness = useMemo(() => evaluateReadiness(data), [data]);

  const entryById = useMemo(() => {
    const map = new Map<string, any>();
    for (const race of (data?.races ?? []) as any[])
      for (const e of race.race_entries ?? []) map.set(e.id, e);
    return map;
  }, [data]);

  const applyMutation = useMutation({
    mutationFn: (candidateId: string) => apply({ data: { candidateId, roundId } }),
    onSuccess: (res: any) => {
      toast.success(`Systemet är inlagt som version ${res.versionNumber}. Inget är låst ännu.`);
      invalidateRound();
      qc.invalidateQueries({ queryKey: ["system-candidates", roundId] });
    },
    onError: (e: any) => toast.error("Kunde inte lägga in systemet: " + e.message),
  });

  async function run(key: string, fn: () => Promise<any>, done: (r: any) => string) {
    setBusy(key);
    try {
      const res = await fn();
      toast.success(done(res));
      invalidateRound();
      qc.invalidateQueries({ queryKey: ["system-candidates", roundId] });
      qc.invalidateQueries({ queryKey: ["final-check", roundId] });
      qc.invalidateQueries({ queryKey: ["bet-snapshot", roundId] });
      qc.invalidateQueries({ queryKey: ["data-origin", roundId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Något gick fel.");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { round, races, systems: roundSystems, roundResult, postmortem } = data as any;
  const responsibleName = (responsibility as any)?.profiles?.display_name ?? "Ingen utsedd ännu";
  const isResponsible = !!responsibility && !!(responsibility as any).user_id;

  const aiNotes = (races as any[])
    .map((r) => ({ leg: r.leg_number, note: r.group_race_assessments?.[0]?.notes ?? null }))
    .filter((r) => r.note);

  const versions = (roundSystems as any[]).flatMap((s) => s.system_versions ?? []);
  const currentVersion =
    versions.filter((v: any) => v.locked_at).sort((a: any, b: any) => b.version_number - a.version_number)[0] ??
    versions.sort((a: any, b: any) => b.version_number - a.version_number)[0] ??
    null;

  const latestImport = origin?.imports?.[0] as any;
  const quality = origin?.quality as any;

  function entryLabel(id: string) {
    const e = entryById.get(id);
    if (!e) return "häst";
    return `${e.start_number} ${e.horses?.name ?? ""}`.trim();
  }

  return (
    <>
      <PageHeader
        title="Veckans spel"
        description={`${formatDate(round.race_date)} · ${round.tracks?.name ?? "Bana ej vald"} · Spelstopp ${formatDateTime(
          round.bet_stop_at,
        )} · Budget ${formatCurrency(Number(round.budget))}`}
        actions={
          <Button asChild variant="secondary" size="lg" className="h-12 text-base">
            <Link to="/omgangar/$roundId" params={{ roundId }}>
              Alla detaljer
            </Link>
          </Button>
        }
      />

      <div className="space-y-5 pb-10">
        {/* 1. Underlaget */}
        <Step number={1} title="Underlaget" state={readiness.ready ? "klar" : "pagar"}>
          <p className="text-muted-foreground">
            Källa: {latestImport?.data_sources?.name ?? "ATG:s öppna API"} ·{" "}
            {freshnessLabel(latestImport?.created_at ?? readiness.latestMarketAt)}
          </p>
          <p className="text-muted-foreground">
            Senaste streckprocent hämtad {formatDateTime(readiness.latestMarketAt)} ·{" "}
            {readiness.legs} avdelningar, {readiness.entries} hästar
          </p>
          {quality && (
            <p className="text-muted-foreground">
              Datakvalitet: {quality.score ?? "–"} av 100
              {quality.sufficient_for_final ? " · tillräckligt" : " · behöver kompletteras"}
            </p>
          )}
          {readiness.ready ? (
            <p className="font-medium text-primary">Underlaget är komplett och analysklart.</p>
          ) : (
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
              <p className="text-lg font-semibold">Underlaget är inte komplett</p>
              <p className="mt-1 text-muted-foreground">Det här saknas:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {readiness.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </Step>

        {/* 2. AI-analys */}
        <Step number={2} title="AI:ns analys" state={aiNotes.length ? "klar" : "vantar"}>
          <AiImportCard roundId={roundId} />
          {aiNotes.length === 0 ? (
            <p className="text-muted-foreground">Ingen analys är gjord ännu.</p>
          ) : (
            <ul className="space-y-2">
              {aiNotes.slice(0, 4).map((r) => (
                <li key={r.leg}>
                  <span className="font-medium">Avdelning {r.leg}: </span>
                  <span className="text-muted-foreground">{String(r.note).slice(0, 200)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button
            size="lg"
            className="h-14 w-full text-lg sm:w-auto"
            disabled={busy !== null || !readiness.ready}
            onClick={() =>
              run("ai", () => draft({ data: { roundId } }), (r) => `Analys klar för ${r.races} avdelningar.`)
            }
          >
            {busy === "ai" ? "Analyserar…" : "Låt AI:n analysera"}
          </Button>
          {!readiness.ready && (
            <p className="text-sm text-muted-foreground">
              Knappen öppnas när underlaget är komplett.
            </p>
          )}
        </Step>

        {/* 3. Kommentarer */}
        <Step
          number={3}
          title="Familjens kommentarer"
          state={(comments.data?.length ?? 0) > 0 ? "klar" : "vantar"}
        >
          {(comments.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">Ingen har kommenterat ännu.</p>
          ) : (
            <ul className="space-y-2">
              {comments.data!.map((c: any) => (
                <li key={c.id} className="text-muted-foreground">
                  {String(c.body).slice(0, 160)}
                </li>
              ))}
            </ul>
          )}
          <Button asChild size="lg" variant="secondary" className="h-14 w-full text-lg sm:w-auto">
            <Link to="/kommentera">Läs och kommentera</Link>
          </Button>
        </Step>

        {/* 4. Systemförslag */}
        <Step number={4} title="Tre systemförslag" state={(candidates?.length ?? 0) > 0 ? "klar" : "vantar"}>
          {(candidates?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">Inga förslag är skapade ännu.</p>
          ) : (
            <div className="space-y-4">
              {[...(candidates as any[])]
                .sort((a, b) => Number(b.recommended) - Number(a.recommended))
                .map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg border p-4 ${
                      c.recommended ? "border-primary bg-primary/5" : "border-white/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xl font-semibold">{c.title}</p>
                      {c.recommended && <Badge>Huvudrekommendation</Badge>}
                      {c.risk_level && <Badge variant="secondary">{c.risk_level}</Badge>}
                      {c.selected && <Badge variant="secondary">Valt</Badge>}
                    </div>
                    <p className="mt-2 text-muted-foreground">{c.rationale}</p>
                    <p className="mt-2">
                      {c.rows_count} rader · {formatCurrency(Number(c.cost))} · täckning{" "}
                      {formatPercent(Number(c.estimated_coverage ?? 0) * 100)}
                    </p>
                    <p className="mt-2">
                      <span className="font-medium">Spikar: </span>
                      {(c.spikes ?? []).length === 0
                        ? "Inga spikar"
                        : (c.spikes as any[])
                            .map((s) => `avd ${s.leg_number}: ${entryLabel(s.entry_id)}`)
                            .join(" · ")}
                    </p>
                    <p>
                      <span className="font-medium">Garderingar: </span>
                      {(c.hedges ?? []).length === 0
                        ? "Inga garderingar"
                        : (c.hedges as any[])
                            .map((h) => `avd ${h.leg_number}: ${h.count} hästar`)
                            .join(" · ")}
                    </p>
                    {c.weakest_assumption && (
                      <p className="mt-2 rounded-md bg-amber-400/10 p-3">
                        <span className="font-medium">Svagaste antagande: </span>
                        {c.weakest_assumption}
                      </p>
                    )}
                    <Button
                      size="lg"
                      className="mt-3 h-14 w-full text-lg sm:w-auto"
                      disabled={applyMutation.isPending || !!snapshot}
                      onClick={() => applyMutation.mutate(c.id)}
                    >
                      Välj det här systemet
                    </Button>
                  </div>
                ))}
            </div>
          )}
          <Button
            size="lg"
            variant="secondary"
            className="h-14 w-full text-lg sm:w-auto"
            disabled={busy !== null || !readiness.ready}
            onClick={() =>
              run("system", () => systems({ data: { roundId } }), () => "Tre systemförslag skapade inom budget.")
            }
          >
            {busy === "system" ? "Bygger…" : "Skapa nya förslag"}
          </Button>
        </Step>

        {/* 5. Veckans ansvarige */}
        <Step number={5} title="Veckans ansvarige" state={isResponsible ? "klar" : "vantar"}>
          <p className="text-2xl font-semibold">{responsibleName}</p>
          <p className="text-muted-foreground">
            Ansvarig väljer system, gör eventuella justeringar och lämnar in spelet hos ATG.
          </p>
        </Step>

        {/* 6. Slutkontroll */}
        <Step number={6} title="Slutkontroll före spelstopp" state={finalCheck ? "klar" : "vantar"}>
          <p className="text-muted-foreground">
            Kontrollerar strykningar, kuskbyten, balans och utrustning, bana, väder samt större
            odds- och streckförändringar. Kontrollen föreslår bara ändringar – den ändrar aldrig
            systemet själv.
          </p>
          {finalCheck ? (
            <>
              <p>
                Körd {formatDateTime((finalCheck as any).run_at)} ·{" "}
                {(finalCheck as any).status === "ok" ? "Inget allvarligt hittat" : "Se noteringar"}
              </p>
              <ul className="list-disc space-y-1 pl-6">
                {((finalCheck as any).findings ?? []).slice(0, 8).map((f: any, i: number) => (
                  <li key={i}>
                    <span className="font-medium">{f.area}: </span>
                    {f.message}
                  </li>
                ))}
              </ul>
              {((finalCheck as any).suggestions ?? []).length > 0 && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
                  <p className="font-semibold">Förslag till ansvarig</p>
                  <ul className="mt-2 list-disc space-y-1 pl-6">
                    {((finalCheck as any).suggestions as string[]).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Slutkontrollen är inte körd ännu.</p>
          )}
          <Button
            size="lg"
            variant="secondary"
            className="h-14 w-full text-lg sm:w-auto"
            disabled={busy !== null}
            onClick={() =>
              run("kontroll", () => finalCheckFn({ data: { roundId } }), () => "Slutkontrollen är klar.")
            }
          >
            {busy === "kontroll" ? "Kontrollerar…" : "Kör slutkontroll"}
          </Button>
        </Step>

        {/* 7. Slutligt system och inlämning */}
        <Step number={7} title="Slutligt system och inlämning" state={snapshot ? "klar" : "vantar"}>
          {!currentVersion ? (
            <p className="text-muted-foreground">Inget system är valt ännu.</p>
          ) : (
            <p className="text-xl font-semibold">
              Version {currentVersion.version_number} · {currentVersion.calculated_rows} rader ·{" "}
              {formatCurrency(Number(currentVersion.calculated_cost))}
            </p>
          )}
          {snapshot ? (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <p className="text-lg font-semibold">Spelet är inlämnat hos ATG</p>
              <p className="text-muted-foreground">
                Inlämnat {formatDateTime((snapshot as any).submitted_at)} ·{" "}
                {(snapshot as any).rows_count} rader ·{" "}
                {formatCurrency(Number((snapshot as any).cost ?? 0))}
              </p>
              <p className="mt-2 text-muted-foreground">
                En låst kopia av systemet, streckprocenten, AI:ns sannolikheter, kommentarerna och
                alla ändringar är sparad. Den används i efterrapporten och kan inte skrivas över.
              </p>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground">
                Spelet lämnas alltid in manuellt hos ATG. Markera här när det är gjort.
              </p>
              <Button
                size="lg"
                className="h-16 w-full text-xl"
                disabled={busy !== null || !currentVersion}
                onClick={() =>
                  run("inlamnat", () => submitFn({ data: { roundId } }), () => "Spelet är markerat som inlämnat och kopian är sparad.")
                }
              >
                {busy === "inlamnat" ? "Sparar…" : "Spelet är inlämnat"}
              </Button>
            </>
          )}
        </Step>

        {/* 8. Resultat och efterrapport */}
        <Step number={8} title="Resultat och efterrapport" state={roundResult ? "klar" : "vantar"}>
          {roundResult ? (
            <p className="text-xl font-semibold">
              Vinst {formatCurrency(Number(roundResult.group_winnings ?? 0))}
            </p>
          ) : (
            <p className="text-muted-foreground">Resultatet är inte hämtat ännu.</p>
          )}
          <p className="text-muted-foreground">
            {postmortem?.approved_at
              ? "Efterrapporten är godkänd."
              : "Efterrapporten skrivs när resultatet är hämtat."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              variant="secondary"
              className="h-14 text-lg"
              disabled={busy !== null}
              onClick={() =>
                run("resultat", () => results({ data: { roundId } }), (r) => `Resultat hämtade: ${r.winners} vinnare.`)
              }
            >
              {busy === "resultat" ? "Hämtar…" : "Hämta resultat"}
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-14 text-lg">
              <Link to="/efterrapporter">Till efterrapporten</Link>
            </Button>
          </div>
        </Step>

        {/* Tre lager */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Så här hänger det ihop</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-base md:grid-cols-3">
            <div className="rounded-lg border border-white/10 p-4">
              <p className="font-semibold">Verifierade fakta</p>
              <p className="text-muted-foreground">
                Startfält, kuskar, utrustning och streckprocent, hämtat från ATG.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 p-4">
              <p className="font-semibold">AI:ns bedömning</p>
              <p className="text-muted-foreground">
                Vinstchanser och systemförslag. Alltid förslag – aldrig beslut.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 p-4">
              <p className="font-semibold">Gruppens beslut</p>
              <p className="text-muted-foreground">
                Det system ni valde och lämnade in. Sparas separat så efterrapporten kan se om ett
                fel berodde på data, analys eller systembygge.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
