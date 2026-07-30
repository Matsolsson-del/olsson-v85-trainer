import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveGroupId, useRounds } from "@/lib/travhub-queries";
import { ERROR_CATEGORY_LABELS } from "@/lib/labels";
import { CALIBRATION_BUCKETS, sampleWarning } from "@/lib/system-math";

export const Route = createFileRoute("/_authenticated/larande")({
  head: () => ({
    meta: [
      { title: "Lärande – Familjen Olssons Travhub" },
      { name: "description", content: "Kalibrering, återkommande fel och gruppens utveckling över tid." },
      { property: "og:title", content: "Lärande – Familjen Olssons Travhub" },
      { property: "og:description", content: "Se mönster i gruppens bedömningar över många omgångar." },
    ],
  }),
  component: LarandePage,
});

function LarandePage() {
  const { groupId } = useActiveGroupId();
  const { data: rounds } = useRounds(groupId);
  const completed = (rounds ?? []).filter((r: any) => r.status === "completed").length;

  return (
    <>
      <PageHeader
        title="Lärande"
        description="Statistiken bygger på registrerade resultat och godkända efterrapporter."
      />

      <p className="mb-4 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
        {sampleWarning(completed * 8)}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kalibrering</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {CALIBRATION_BUCKETS.map((b) => (
              <div key={b.label} className="flex justify-between">
                <span>{b.label}</span>
                <span className="text-muted-foreground">underlag saknas</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Kalibrering visas när tillräckligt många lopp har både bedömning och resultat.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Felkategorier som följs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.values(ERROR_CATEGORY_LABELS).map((label) => (
              <div key={label} className="flex justify-between">
                <span>{label}</span>
                <span className="text-muted-foreground">0</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
