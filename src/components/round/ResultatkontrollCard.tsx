import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveSettlement,
  correctSettlement,
  getSettlement,
  refreshSettlement,
  uploadResult,
} from "@/lib/settlement.functions";

const VERIFICATION_LABEL: Record<string, { text: string; tone: string }> = {
  verified_official: { text: "Verifierat mot ATG", tone: "bg-emerald-100 text-emerald-900" },
  parsed_upload: { text: "Tolkat från uppladdning", tone: "bg-sky-100 text-sky-900" },
  partial: { text: "Delvis verifierat", tone: "bg-amber-100 text-amber-900" },
  needs_review: { text: "Behöver granskas", tone: "bg-amber-100 text-amber-900" },
  conflicting: { text: "Motstridiga uppgifter", tone: "bg-red-100 text-red-900" },
};

function kr(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString("sv-SE")} kr` : "–";
}

/**
 * Resultatkontroll för en spelad omgång: hämtar det officiella resultatet,
 * visar den maskinellt beräknade uträkningen och låter veckans ansvarige
 * godkänna och spara den permanent.
 */
export function ResultatkontrollCard({
  roundId,
  onDone,
}: {
  roundId: string;
  onDone?: () => void;
}) {
  const load = useServerFn(getSettlement);
  const refresh = useServerFn(refreshSettlement);
  const approve = useServerFn(approveSettlement);
  const correct = useServerFn(correctSettlement);
  const upload = useServerFn(uploadResult);

  const [settlement, setSettlement] = useState<any>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [winnerInput, setWinnerInput] = useState("");
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    let alive = true;
    load({ data: { roundId } })
      .then((r: any) => {
        if (!alive) return;
        setSettlement(r.settlement);
        setCanApprove(r.canApprove);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [roundId, load]);

  const calc = settlement?.calculation ?? {};
  const verification = VERIFICATION_LABEL[settlement?.verification] ?? {
    text: "Inget resultat hämtat",
    tone: "bg-muted text-muted-foreground",
  };
  const approved = settlement?.status === "approved";

  async function run(name: string, fn: () => Promise<any>, okText: string) {
    setBusy(name);
    try {
      const res = await fn();
      if (res?.settlement) setSettlement(res.settlement);
      toast.success(okText);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Något gick fel. Försök igen.");
    } finally {
      setBusy(null);
    }
  }

  function parseWinnerInput(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    winnerInput
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((part, index) => {
        out[String(index + 1)] = part
          .split(/[\s/+]+/)
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n));
      });
    return out;
  }

  async function onFile(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Filen kunde inte läsas."));
      reader.readAsDataURL(file);
    });
    await run(
      "upload",
      () => upload({ data: { roundId, fileDataUrl: dataUrl, fileName: file.name } }),
      "Resultatet är inläst. Kontrollera uppgifterna innan du sparar.",
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-lg">Resultatkontroll</CardTitle>
        <Badge className={verification.tone}>{verification.text}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!settlement ? (
          <p className="text-sm text-muted-foreground">
            Resultatet hämtas automatiskt när alla åtta avdelningar är avgjorda. Du kan också hämta
            det manuellt här.
          </p>
        ) : (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Datum och bana: </span>
                {settlement.raceDate ?? "–"} {settlement.trackName ?? ""}
              </div>
              <div>
                <span className="text-muted-foreground">Antal rätt: </span>
                {calc.correctLegs ?? 0} av 8
              </div>
              <div>
                <span className="text-muted-foreground">Spikar som höll: </span>
                {calc.winningSpikes ?? 0} av {calc.spikes ?? 0}
              </div>
              <div>
                <span className="text-muted-foreground">Insats: </span>
                {kr(calc.totalCost)}
              </div>
              <div>
                <span className="text-muted-foreground">Utbetalning: </span>
                {kr(calc.payoutTotal)}
              </div>
              <div>
                <span className="text-muted-foreground">Netto: </span>
                <span className={Number(calc.net) >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {kr(calc.net)}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Datakälla: </span>
                {settlement.source === "atg" ? "ATG (officiell)" : "Manuell/uppladdning"}
                {settlement.officialGameId ? ` · ${settlement.officialGameId}` : ""}
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <p className="mb-1 font-medium">Vinnarrad</p>
              <ol className="grid gap-1 sm:grid-cols-2">
                {(settlement.winnerLabels ?? []).map((w: any) => (
                  <li key={w.leg}>
                    Avd {w.leg}: {w.winners?.length ? w.winners.join(" / ") : "saknas"}
                  </li>
                ))}
              </ol>
            </div>

            {Object.keys(calc.rowsByLevel ?? {}).length > 0 && (
              <div className="rounded-md border p-3 text-sm">
                <p className="mb-1 font-medium">Rader per rättnivå</p>
                <p>
                  8 rätt: {calc.rowsByLevel?.[8] ?? 0} · 7 rätt: {calc.rowsByLevel?.[7] ?? 0} · 6
                  rätt: {calc.rowsByLevel?.[6] ?? 0} · 5 rätt: {calc.rowsByLevel?.[5] ?? 0}
                </p>
              </div>
            )}

            {(settlement.issues ?? []).length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Avvikelser att kontrollera</p>
                <ul className="list-disc pl-5">
                  {settlement.issues.map((i: string) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy !== null}
            onClick={() =>
              run("refresh", () => refresh({ data: { roundId } }), "Resultatet är hämtat på nytt.")
            }
          >
            {busy === "refresh" ? "Hämtar…" : "Hämta resultat igen"}
          </Button>

          {canApprove && !approved && settlement && (
            <Button
              className="min-h-11"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "approve",
                  () => approve({ data: { roundId } }),
                  "Resultatet är godkänt och sparat i Historik.",
                )
              }
            >
              {busy === "approve" ? "Sparar…" : "Godkänn och spara"}
            </Button>
          )}

          {canApprove && !approved && (
            <>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setShowCorrect((v) => !v)}
              >
                Rätta uppgifter
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setShowUpload((v) => !v)}
              >
                Ladda upp resultat
              </Button>
            </>
          )}
        </div>

        {approved && (
          <p className="text-sm text-emerald-700">
            Resultatet är godkänt och sparat. Efterrapporten finns nedan.
          </p>
        )}

        {showCorrect && canApprove && (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="winners">Vinnare per avdelning (avd 1–8, komma emellan)</Label>
            <Input
              id="winners"
              placeholder="8, 3, 5, 1, 2, 4, 7, 6"
              value={winnerInput}
              onChange={(e) => setWinnerInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Vid dött lopp: skriv båda numren med mellanslag, till exempel ”3 5”.
            </p>
            <Button
              className="min-h-11"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "correct",
                  () => correct({ data: { roundId, winnersByLeg: parseWinnerInput() } }),
                  "Uppgifterna är rättade och utfallet omräknat.",
                )
              }
            >
              {busy === "correct" ? "Räknar…" : "Räkna om"}
            </Button>
          </div>
        )}

        {showUpload && canApprove && (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="paste">Klistra in resultat eller kvittotext</Label>
            <Textarea
              id="paste"
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy !== null || pasteText.trim().length === 0}
                onClick={() =>
                  run(
                    "upload",
                    () => upload({ data: { roundId, text: pasteText } }),
                    "Texten är tolkad. Kontrollera uppgifterna innan du sparar.",
                  )
                }
              >
                {busy === "upload" ? "Tolkar…" : "Tolka texten"}
              </Button>
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 text-sm">
                Välj bild eller PDF
                <input
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
