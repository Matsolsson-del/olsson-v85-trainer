import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/labels";

export type ExportLeg = {
  legNumber: number;
  numbers: number[];
};

export function AtgExportCard({
  legs,
  rows,
  cost,
  trackName,
  raceDate,
}: {
  legs: ExportLeg[];
  rows: number;
  cost: number;
  trackName?: string | null;
  raceDate?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const lines = legs.map(
    (l) => `Avd ${l.legNumber}: ${l.numbers.length ? l.numbers.join(", ") : "–"}`,
  );
  const text = [
    `V85 ${trackName ?? ""} ${raceDate ?? ""}`.trim(),
    ...lines,
    `${rows} rader · ${formatCurrency(cost)}`,
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Kopierat – klistra in hos ATG.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Kunde inte kopiera. Markera texten och kopiera för hand.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Så här spelar du systemet hos ATG</CardTitle>
        <p className="text-sm text-muted-foreground">
          Spelet lämnas alltid in hos ATG – aldrig här. Den här rutan visar exakt vilka nummer du
          ska kryssa.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5">
          {legs.map((l) => (
            <li key={l.legNumber} className="flex items-baseline gap-3 text-lg">
              <span className="w-24 shrink-0 text-muted-foreground">Avd {l.legNumber}</span>
              <span className="font-mono font-semibold tracking-wide">
                {l.numbers.length ? l.numbers.join("  ") : "–"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-base">
          Totalt <strong>{rows} rader</strong> och <strong>{formatCurrency(cost)}</strong>.
        </p>
        <Button size="lg" onClick={copy}>
          {copied ? "Kopierat!" : "Kopiera raderna"}
        </Button>
      </CardContent>
    </Card>
  );
}
