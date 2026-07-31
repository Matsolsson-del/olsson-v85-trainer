import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/labels";
import { useInvalidateRound } from "@/lib/travhub-queries";
import {
  applyCandidateNow,
  buildSystemsNow,
  generateAiDraftNow,
  importResultsNow,
} from "@/lib/automation.functions";
import { runAiDraftReliably } from "@/lib/ai-analysis-client";

export function AutomatikCard({ roundId }: { roundId: string }) {
  const qc = useQueryClient();
  const invalidateRound = useInvalidateRound(roundId);
  const [busy, setBusy] = useState<string | null>(null);

  const draft = useServerFn(generateAiDraftNow);
  const systems = useServerFn(buildSystemsNow);
  const results = useServerFn(importResultsNow);
  const apply = useServerFn(applyCandidateNow);

  const candidates = useQuery({
    queryKey: ["system-candidates", roundId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_candidates")
        .select("*")
        .eq("round_id", roundId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const applyMutation = useMutation({
    mutationFn: (candidateId: string) => apply({ data: { candidateId, roundId } }),
    onSuccess: (res: any) => {
      toast.success(`Systemet är inlagt som version ${res.versionNumber}. Inget är låst ännu.`);
      invalidateRound();
      candidates.refetch();
    },
    onError: (e: any) => toast.error("Kunde inte lägga in systemet: " + e.message),
  });

  async function run(key: string, fn: () => Promise<any>, done: (r: any) => string) {
    setBusy(key);
    const toastId = toast.loading(
      key === "ai"
        ? "AI:n läser alla åtta avdelningar. Det tar ungefär en minut – stanna kvar på sidan."
        : "Arbetar…",
      { duration: Infinity },
    );
    try {
      const res = await fn();
      toast.success(done(res), { id: toastId, duration: 8000 });
      invalidateRound();
      qc.invalidateQueries({ queryKey: ["system-candidates", roundId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Något gick fel.", { id: toastId, duration: 10000 });
    } finally {
      setBusy(null);
    }
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Låt datorn göra jobbet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Allt här skapar bara förslag. Ingenting låses och inget spel lämnas in automatiskt.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <Button
            size="lg"
            className="h-auto whitespace-normal py-4 text-base"
            disabled={busy !== null}
            onClick={() =>
              run(
                "ai",
                () => runAiDraftReliably(roundId, () => draft({ data: { roundId } })),
                (r) => `Förslag klara för ${r.races} avdelningar.`,
              )
            }
          >
            {busy === "ai" ? "Analyserar…" : "Föreslå analys"}
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="h-auto whitespace-normal py-4 text-base"
            disabled={busy !== null}
            onClick={() =>
              run(
                "system",
                () => systems({ data: { roundId } }),
                () => "Tre systemförslag skapade inom budget.",
              )
            }
          >
            {busy === "system" ? "Bygger…" : "Föreslå system"}
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="h-auto whitespace-normal py-4 text-base"
            disabled={busy !== null}
            onClick={() =>
              run(
                "resultat",
                () => results({ data: { roundId } }),
                (r) =>
                  `Resultat hämtade: ${r.winners} vinnare${
                    r.payout ? `, utdelning ${formatCurrency(r.payout)}` : ""
                  }.`,
              )
            }
          >
            {busy === "resultat" ? "Hämtar…" : "Hämta resultat"}
          </Button>
        </div>

        {(candidates.data?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Systemförslag</p>
            {candidates.data!.map((c: any) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="min-w-[16rem]">
                  <p className="font-medium">
                    {c.title}
                    {c.selected ? " · vald" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">{c.rationale}</p>
                  <p className="text-sm">
                    {formatNumber(c.rows_count)} rader · {formatCurrency(Number(c.cost))} ·
                    chans att ha rätt {formatPercent(Number(c.estimated_coverage) * 100)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={applyMutation.isPending}
                  onClick={() => applyMutation.mutate(c.id)}
                >
                  Använd detta
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
