import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestRoundPostmortem } from "@/lib/round-postmortem.functions";
import { formatDateTime } from "@/lib/labels";

const SECTIONS: { key: string; title: string }[] = [
  { key: "ai_draft", title: "Så gick omgången" },
  { key: "strengths", title: "Det här gjorde ni bra" },
  { key: "three_main_errors", title: "De tre viktigaste felen" },
  { key: "good_decisions_despite_loss", title: "Kloka beslut trots miss" },
  { key: "bad_decisions_despite_win", title: "Svaga beslut som ändå blev rätt" },
  { key: "max_three_changes_to_test", title: "Testa detta nästa omgång" },
  { key: "do_not_change_yet", title: "Ändra inte detta ännu" },
];

/**
 * Efteranalys för en enskild omgång. Kan begäras av vem som helst i gruppen
 * när resultatet är hämtat, och sparas därefter på omgången.
 */
export function EfteranalysCard({
  roundId,
  postmortem,
  onDone,
}: {
  roundId: string;
  postmortem: any;
  onDone?: () => void;
}) {
  const request = useServerFn(requestRoundPostmortem);
  const [busy, setBusy] = useState(false);

  const pm = postmortem ?? null;
  const hasAnalysis = SECTIONS.some((s) => pm?.[s.key]);
  const stats = pm?.ai_stats ?? null;

  async function run() {
    setBusy(true);
    const id = toast.loading("Efteranalysen skapas – det tar ungefär en halv minut.");
    try {
      const res: any = await request({ data: { roundId } });
      toast.success(
        `Efteranalysen är klar: ${res?.outcome?.correctLegs ?? 0} av ${res?.outcome?.decidedLegs ?? 0} rätt.`,
        { id },
      );
      onDone?.();
    } catch (e: any) {
      toast.error("Kunde inte skapa efteranalysen: " + (e?.message ?? "okänt fel"), { id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Efteranalys av spelet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-base">
        {hasAnalysis ? (
          <>
            {stats ? (
              <p className="text-muted-foreground">
                {stats.correctLegs} av {stats.decidedLegs} rätt
                {stats.rows ? ` · ${stats.rows} rader` : ""}
                {pm?.ai_generated_at ? ` · skapad ${formatDateTime(pm.ai_generated_at)}` : ""}
              </p>
            ) : null}
            <div className="space-y-3">
              {SECTIONS.filter((s) => pm?.[s.key]).map((s) => (
                <div key={s.key} className="rounded-lg border border-border p-4">
                  <p className="font-semibold">{s.title}</p>
                  <p className="whitespace-pre-line text-muted-foreground">{pm[s.key]}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            När resultatet är hämtat kan ni be om en efteranalys. Den jämför ert inlämnade spel med
            vinnarna och sparas här på omgången.
          </p>
        )}
        <Button
          size="lg"
          variant={hasAnalysis ? "secondary" : "default"}
          className="h-14 w-full text-lg sm:w-auto"
          disabled={busy}
          onClick={run}
        >
          {busy ? "Skapar efteranalys…" : hasAnalysis ? "Gör om efteranalysen" : "Begär efteranalys"}
        </Button>
      </CardContent>
    </Card>
  );
}
