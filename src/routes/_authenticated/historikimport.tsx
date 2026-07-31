import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/labels";
import { useActiveGroupId, useMyProfile, useOwnerStatus } from "@/lib/travhub-queries";
import {
  commitHistoryImport,
  getHistoryImportFormat,
  previewHistoryImport,
} from "@/lib/history-import.functions";

export const Route = createFileRoute("/_authenticated/historikimport")({
  head: () => ({
    meta: [
      { title: "Historikimport – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Klistra in eller ladda upp gamla V85-spel som JSON, validera dem och importera dem som historik utan att påverka ekonomin.",
      },
      { property: "og:title", content: "Historikimport – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Manuell reservväg för att lägga in gamla V85-system som historik.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistorikImportPage,
});

const MAX_FILE_BYTES = 2_000_000;

const QUALITY_LABEL: Record<string, string> = {
  verified: "Verifierad",
  partially_verified: "Delvis verifierad",
  incomplete: "Ofullständig",
};

type StepState = 1 | 2 | 3 | 4 | 5;

function StatusBadge({ item }: { item: any }) {
  if (item.status === "duplicate_skipped") {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        Grå · Redan importerad
      </Badge>
    );
  }
  if (item.warnings?.length) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
        Gul · Kan importeras med varningar
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-600 text-emerald-700 dark:text-emerald-400">
      Grön · Godkänd för import
    </Badge>
  );
}

function StepHeader({ step, current, title, hint }: { step: StepState; current: StepState; title: string; hint: string }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base font-semibold ${
          done
            ? "border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
            : active
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
        }`}
      >
        {step}
      </span>
      <div>
        <CardTitle className="text-base">
          Steg {step} – {title}
          {done ? <span className="sr-only"> (klart)</span> : null}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function HistorikImportPage() {
  const { groupId } = useActiveGroupId();
  const { isOwner, isLoading: ownerLoading, isError: ownerError } = useOwnerStatus(groupId);
  const { data: profile } = useMyProfile();

  const runPreview = useServerFn(previewHistoryImport);
  const runCommit = useServerFn(commitHistoryImport);
  const fetchFormat = useServerFn(getHistoryImportFormat);

  const [json, setJson] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [step, setStep] = useState<StepState>(1);
  const [validation, setValidation] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const format = useQuery({
    queryKey: ["history-import-format"],
    enabled: isOwner,
    queryFn: () => fetchFormat() as Promise<any>,
  });

  const lineCount = useMemo(() => json.split("\n").length, [json]);

  function resetFlow(keepJson = true) {
    setValidation(null);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setBatchId(null);
    setStep(keepJson && json.trim() ? 1 : 1);
    if (!keepJson) {
      setJson("");
      setFileInfo(null);
    }
  }

  function handleJsonChange(value: string) {
    setJson(value);
    setValidation(null);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setStep(1);
  }

  function pasteExample() {
    const example = format.data?.example;
    if (!example) {
      toast.error("Exemplet är inte hämtat än. Försök igen om en stund.");
      return;
    }
    handleJsonChange(JSON.stringify(example, null, 2));
    setFileInfo(null);
    toast.success("Exempel inklistrat.");
  }

  function formatJson() {
    try {
      handleJsonChange(JSON.stringify(JSON.parse(json), null, 2));
      toast.success("JSON formaterad.");
    } catch (e: any) {
      toast.error(`Kunde inte formatera: ${e?.message ?? "ogiltig JSON"}`);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Bara .json-filer går att ladda upp.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Filen är för stor. Max 2 MB.");
      return;
    }
    const text = await file.text();
    handleJsonChange(text);
    setFileInfo({ name: file.name, size: file.size });
    toast.success("Filen är inläst. Inget har skickats till servern än.");
  }

  async function validate() {
    if (!groupId) return;
    setBusy(true);
    try {
      const res: any = await runPreview({ data: { groupId, json, overwriteExisting: overwrite } });
      setValidation(res);
      setPreview(null);
      setResult(null);
      setStep(res.ok ? 3 : 2);
      if (!res.ok) toast.error(res.message ?? "Valideringen misslyckades.");
      else toast.success("Valideringen är klar.");
    } catch (e: any) {
      setValidation({ ok: false, message: e?.message ?? "Något gick fel.", errors: [], preview: [] });
      setStep(2);
      toast.error(e?.message ?? "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  async function doPreview() {
    if (!groupId) return;
    setBusy(true);
    try {
      const res: any = await runPreview({ data: { groupId, json, overwriteExisting: overwrite } });
      setPreview(res);
      setValidation(res);
      setResult(null);
      setStep(res.ok ? 4 : 2);
      if (!res.ok) toast.error(res.message ?? "Förhandsgranskningen misslyckades.");
    } catch (e: any) {
      toast.error(e?.message ?? "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!groupId || !preview?.ok) return;
    setBusy(true);
    try {
      const res: any = await runCommit({
        data: {
          groupId,
          json,
          overwriteExisting: overwrite,
          reason: overwrite ? reason : null,
          batchId: batchId ?? undefined,
        },
      });
      setResult(res);
      setBatchId(res.import_batch_id ?? null);
      setStep(5);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.message ?? "Importen misslyckades.");
    } finally {
      setBusy(false);
    }
  }

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopierad.`);
    } catch {
      toast.error("Kunde inte kopiera. Markera texten och kopiera manuellt.");
    }
  }

  function downloadReceipt(kind: "json" | "csv") {
    if (!result) return;
    const stamp = result.imported_at ?? new Date().toISOString();
    if (kind === "json") {
      download(
        `historikimport-kvitto-${stamp}.json`,
        JSON.stringify(
          {
            import_batch_id: result.import_batch_id,
            imported_at: stamp,
            imported_by: profile?.display_name ?? null,
            summary: {
              created: result.imported,
              overwritten: result.overwritten,
              skipped: result.skipped,
            },
            economy_note: result.economy_note,
            results: result.results ?? [],
          },
          null,
          2,
        ),
        "application/json",
      );
      return;
    }
    const rows = [
      ["idempotency_key", "atgard", "id"],
      ...(result.results ?? []).map((r: any) => [r.idempotency_key, r.action, r.id ?? ""]),
    ];
    download(
      `historikimport-kvitto-${stamp}.csv`,
      rows.map((r) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"),
      "text/csv",
    );
  }

  if (ownerLoading) {
    return (
      <>
        <PageHeader title="Historikimport" description="Hämtar din behörighet …" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  if (ownerError) {
    return (
      <>
        <PageHeader title="Historikimport" />
        <Card>
          <CardContent className="p-6 text-base">
            Det gick inte att kontrollera behörigheten just nu. Ladda om sidan och försök igen.
          </CardContent>
        </Card>
      </>
    );
  }

  if (!isOwner) {
    return (
      <>
        <PageHeader title="Historikimport" description="Endast Mats sköter historikimporten." />
        <Card>
          <CardContent className="p-6 text-base text-muted-foreground">
            Den här sidan sköts av gruppens ägare. Behörigheten kontrolleras även på servern.
          </CardContent>
        </Card>
      </>
    );
  }

  const items: any[] = validation?.preview ?? [];
  const blocked = (validation?.errors?.length ?? 0) > 0;
  const willCreate = items.filter((i) => i.status === "new").length;
  const willOverwrite = items.filter((i) => i.status === "will_overwrite").length;
  const willSkip = items.filter((i) => i.status === "duplicate_skipped").length;
  const hasExisting = items.some((i) => i.existing_id);

  return (
    <>
      <PageHeader
        title="Historikimport"
        description="Lägg in gamla V85-spel som historik. Ekonomin påverkas aldrig."
      />

      <div className="space-y-4">
        {/* Steg 1 */}
        <Card>
          <CardHeader className="pb-3">
            <StepHeader step={1} current={step} title="Lägg till data" hint="Klistra in JSON eller ladda upp en .json-fil." />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button className="h-12" variant="secondary" onClick={pasteExample}>
                Klistra in exempel
              </Button>
              <Button className="h-12" variant="outline" onClick={formatJson} disabled={!json.trim()}>
                Formatera JSON
              </Button>
              <Button
                className="h-12"
                variant="outline"
                onClick={() => {
                  handleJsonChange("");
                  setFileInfo(null);
                }}
                disabled={!json}
              >
                Rensa
              </Button>
              <Button className="h-12" variant="outline" onClick={() => fileRef.current?.click()}>
                Ladda upp .json-fil
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            {fileInfo ? (
              <p className="text-sm text-muted-foreground">
                Fil: <strong>{fileInfo.name}</strong> ({Math.round(fileInfo.size / 1024)} kB). Innehållet är
                inläst lokalt – inget skickas förrän du klickar Validera.
              </p>
            ) : null}

            <div className="flex gap-2">
              <pre
                aria-hidden
                className="hidden select-none rounded-md bg-muted px-2 py-3 text-right font-mono text-xs leading-6 text-muted-foreground sm:block"
              >
                {Array.from({ length: Math.max(lineCount, 12) }, (_, i) => i + 1).join("\n")}
              </pre>
              <div className="flex-1">
                <Label htmlFor="json-input" className="text-sm">
                  JSON-underlag
                </Label>
                <Textarea
                  id="json-input"
                  value={json}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  spellCheck={false}
                  rows={16}
                  placeholder='{ "rounds": [ ... ] }'
                  className="mt-1 font-mono text-xs leading-6"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="h-12" variant="outline" onClick={() => setShowFormat((v) => !v)}>
                {showFormat ? "Dölj importformat" : "Visa importformat"}
              </Button>
              <Button
                className="h-12"
                variant="outline"
                disabled={!format.data}
                onClick={() => copy(JSON.stringify(format.data?.schema ?? {}, null, 2), "JSON-schemat")}
              >
                Kopiera JSON-schema
              </Button>
              <Button
                className="h-12"
                variant="outline"
                disabled={!format.data}
                onClick={() =>
                  download(
                    "exempel.json",
                    JSON.stringify(format.data?.example ?? {}, null, 2),
                    "application/json",
                  )
                }
              >
                Ladda ner exempel.json
              </Button>
            </div>

            {showFormat ? (
              <div className="space-y-3 rounded-md border border-border p-4 text-sm">
                <div>
                  <h3 className="font-semibold">Obligatoriska fält per omgång</h3>
                  <p className="text-muted-foreground">
                    <code>race_date</code> (YYYY-MM-DD), <code>legs</code> (avdelning 1–8 med valda hästar)
                    och <code>data_quality</code>.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Frivilliga fält</h3>
                  <p className="text-muted-foreground">
                    Bana, radpris, budget, angivet radantal och kostnad, vinst, antal rätt, spikträffar,
                    analys, lärdomar, källa, osäkerhetsnotering och tidigare systemversioner.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Tillåten datakvalitet</h3>
                  <p className="text-muted-foreground">
                    <code>verified</code> (allt kontrollerat), <code>partially_verified</code> (delvis) och{" "}
                    <code>incomplete</code> (ofullständigt).
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Okända uppgifter</h3>
                  <p className="text-muted-foreground">
                    Skriv <code>null</code> – aldrig gissade nollor. Osäkra vinnare kräver{" "}
                    <code>winners_verified: false</code>.
                  </p>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {(format.data?.rules ?? []).map((r: string) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <pre className="max-h-64 overflow-auto rounded bg-muted p-3 font-mono text-xs">
                  {JSON.stringify(format.data?.schema ?? {}, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Steg 2 */}
        <Card>
          <CardHeader className="pb-3">
            <StepHeader
              step={2}
              current={step}
              title="Validera"
              hint="Servern kontrollerar hela underlaget. Inget sparas."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="h-12" onClick={validate} disabled={!json.trim() || busy}>
              {busy ? "Arbetar…" : "Validera"}
            </Button>

            {validation ? (
              <>
                <Alert variant={validation.ok ? "default" : "destructive"}>
                  <AlertTitle>{validation.ok ? "Valideringen är klar" : "Valideringen misslyckades"}</AlertTitle>
                  <AlertDescription>{validation.message}</AlertDescription>
                </Alert>

                {validation.errors?.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Omgång</TableHead>
                          <TableHead>Fält</TableHead>
                          <TableHead>Förklaring</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validation.errors.map((e: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{e.round || "–"}</TableCell>
                            <TableCell className="font-mono text-xs">{e.path || "–"}</TableCell>
                            <TableCell>Fel: {e.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                {items.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bana</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead>Rader angivet</TableHead>
                          <TableHead>Rader beräknat</TableHead>
                          <TableHead>Kostnad angivet</TableHead>
                          <TableHead>Kostnad beräknat</TableHead>
                          <TableHead>Rätt</TableHead>
                          <TableHead>Vinst</TableHead>
                          <TableHead>Datakvalitet</TableHead>
                          <TableHead>Dubblett</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Fel</TableHead>
                          <TableHead>Varningar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it) => (
                          <TableRow key={it.idempotency_key}>
                            <TableCell>{it.track_name ?? "Okänd bana"}</TableCell>
                            <TableCell>{formatDate(it.race_date)}</TableCell>
                            <TableCell>{it.stated_rows ?? "–"}</TableCell>
                            <TableCell className={it.rows_mismatch ? "font-semibold text-amber-600" : ""}>
                              {it.computed_rows}
                            </TableCell>
                            <TableCell>{it.stated_cost ?? "–"}</TableCell>
                            <TableCell className={it.cost_mismatch ? "font-semibold text-amber-600" : ""}>
                              {it.computed_cost ?? "–"}
                            </TableCell>
                            <TableCell>{it.correct_count ?? "Okänt"}</TableCell>
                            <TableCell>{it.payout ?? "Okänt"}</TableCell>
                            <TableCell>{QUALITY_LABEL[it.data_quality] ?? it.data_quality}</TableCell>
                            <TableCell>{it.existing_id ? "Finns redan" : "Nej"}</TableCell>
                            <TableCell>
                              <StatusBadge item={it} />
                            </TableCell>
                            <TableCell>0</TableCell>
                            <TableCell>{it.warnings?.length ?? 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                {items.some((i) => i.warnings?.length) ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Varningar</h3>
                    {items.map((it) =>
                      (it.warnings ?? []).map((w: string, i: number) => (
                        <p key={`${it.idempotency_key}-${i}`} className="text-sm text-muted-foreground">
                          <strong>{it.track_name ?? "Okänd bana"} {formatDate(it.race_date)}:</strong> Varning: {w}
                        </p>
                      )),
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Steg 3 */}
        <Card>
          <CardHeader className="pb-3">
            <StepHeader
              step={3}
              current={step}
              title="Förhandsgranska"
              hint="Samma logik som import_betting_history med mode=preview. Skriver aldrig till databasen."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="h-12"
              onClick={doPreview}
              disabled={busy || !validation?.ok || blocked}
              title={!validation?.ok ? "Validera först" : undefined}
            >
              Förhandsgranska import
            </Button>
            {!validation?.ok ? (
              <p className="text-sm text-muted-foreground">Du måste validera underlaget först.</p>
            ) : null}

            {preview?.preview?.length ? (
              <div className="space-y-3">
                {preview.preview.map((it: any) => (
                  <div key={it.idempotency_key} className="rounded-md border border-border p-4 text-sm">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">
                        {it.track_name ?? "Okänd bana"} · {formatDate(it.race_date)}
                      </h3>
                      <StatusBadge item={it} />
                    </div>
                    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      <div>
                        <dt className="inline text-muted-foreground">Rader (angivet/beräknat): </dt>
                        <dd className="inline">
                          {it.stated_rows ?? "–"} / {it.computed_rows}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Kostnad (angivet/beräknat): </dt>
                        <dd className="inline">
                          {it.stated_cost ?? "–"} / {it.computed_cost ?? "–"}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Antal rätt: </dt>
                        <dd className="inline">{it.correct_count ?? "Okänt"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Vinnande spikar: </dt>
                        <dd className="inline">{it.spike_hits ?? "Okänt"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Vinst: </dt>
                        <dd className="inline">{it.payout ?? "Okänt"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Nettoresultat: </dt>
                        <dd className="inline">{it.net_result ?? "Okänt"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Datakvalitet: </dt>
                        <dd className="inline">{QUALITY_LABEL[it.data_quality] ?? it.data_quality}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Källa: </dt>
                        <dd className="inline">{it.source ?? "Okänd"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Spikade avdelningar: </dt>
                        <dd className="inline">{it.spikes?.length ? it.spikes.join(", ") : "Inga"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Systemversioner: </dt>
                        <dd className="inline">{it.systems_count || 1}</dd>
                      </div>
                    </dl>

                    <div className="mt-3 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Avdelning</TableHead>
                            <TableHead>System</TableHead>
                            <TableHead>Spik</TableHead>
                            <TableHead>Vinnare</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(it.legs ?? []).map((leg: any) => (
                            <TableRow key={leg.leg}>
                              <TableCell>V85-{leg.leg}</TableCell>
                              <TableCell>{(leg.selected ?? []).join(", ")}</TableCell>
                              <TableCell>
                                {leg.spike === true || (leg.selected ?? []).length === 1 ? "Ja" : "Nej"}
                              </TableCell>
                              <TableCell>
                                {leg.winner == null
                                  ? "Okänd"
                                  : it.winners_verified
                                    ? String(leg.winner)
                                    : `${leg.winner} (ej verifierad)`}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {it.missing_fields?.length ? (
                      <p className="mt-2 text-muted-foreground">
                        Saknade uppgifter: {it.missing_fields.join(", ")}.
                      </p>
                    ) : null}
                    {it.uncertainty_note ? (
                      <p className="mt-1 text-muted-foreground">Osäkerhet: {it.uncertainty_note}</p>
                    ) : null}
                    {it.rows_mismatch ? (
                      <p className="mt-1 font-semibold text-amber-600 dark:text-amber-400">
                        Obs: angivet och beräknat radantal skiljer sig.
                      </p>
                    ) : null}
                    {it.cost_mismatch ? (
                      <p className="mt-1 font-semibold text-amber-600 dark:text-amber-400">
                        Obs: angiven och beräknad kostnad skiljer sig.
                      </p>
                    ) : null}
                    {!it.winners_verified ? (
                      <p className="mt-1 text-muted-foreground">
                        Vinnarna är inte fullt verifierade – posten används inte för lärande.
                      </p>
                    ) : null}
                    <p className="mt-2 font-medium">
                      {it.status === "new"
                        ? "Posten kommer att skapas."
                        : it.status === "will_overwrite"
                          ? "Posten kommer att skrivas över."
                          : "Posten hoppas över – den finns redan."}
                    </p>

                    {it.differences?.length ? (
                      <div className="mt-2 rounded bg-muted p-3">
                        <h4 className="font-semibold">Skillnader mot befintlig post</h4>
                        <ul className="list-disc pl-5">
                          {it.differences.map((d: any) => (
                            <li key={d.field}>
                              {d.field}: befintligt {String(d.existing ?? "–")} → nytt{" "}
                              {String(d.incoming ?? "–")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ))}
                <Alert>
                  <AlertTitle>Ingenting har sparats</AlertTitle>
                  <AlertDescription>{preview.economy_note}</AlertDescription>
                </Alert>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Steg 4 */}
        <Card>
          <CardHeader className="pb-3">
            <StepHeader
              step={4}
              current={step}
              title="Importera"
              hint="Endast godkända poster sparas som Importerad historik."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border p-4 text-sm">
              <p>Poster som skapas: <strong>{willCreate}</strong></p>
              <p>Poster som hoppas över: <strong>{willSkip}</strong></p>
              <p>Blockerade poster: <strong>{blocked ? items.length || "alla" : 0}</strong></p>
              {overwrite ? <p>Poster som skrivs över: <strong>{willOverwrite}</strong></p> : null}
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
              />
              <Label htmlFor="confirm" className="text-sm leading-6">
                Jag förstår att dessa poster läggs till som historik men inte påverkar gruppens ekonomi.
              </Label>
            </div>

            {hasExisting ? (
              <div className="space-y-3 rounded-md border border-amber-500/50 p-4">
                <h3 className="text-sm font-semibold">Avancerat: skriv över befintliga poster</h3>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="overwrite"
                    checked={overwrite}
                    onCheckedChange={(v) => {
                      setOverwrite(v === true);
                      setPreview(null);
                      setValidation(null);
                      setStep(1);
                    }}
                  />
                  <Label htmlFor="overwrite" className="text-sm leading-6">
                    Skriv över redan importerade omgångar (av som standard).
                  </Label>
                </div>
                {overwrite ? (
                  <>
                    <div>
                      <Label htmlFor="reason" className="text-sm">
                        Motivering (obligatorisk, sparas i revisionsloggen)
                      </Label>
                      <Input
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1 h-12"
                        placeholder="Varför ska den gamla posten ersättas?"
                      />
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="overwrite-confirm"
                        checked={overwriteConfirmed}
                        onCheckedChange={(v) => setOverwriteConfirmed(v === true)}
                      />
                      <Label htmlFor="overwrite-confirm" className="text-sm leading-6">
                        Jag har läst skillnaderna och vill ersätta de befintliga posterna.
                      </Label>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <Button
              className="h-12"
              onClick={commit}
              disabled={
                busy ||
                !preview?.ok ||
                !confirmed ||
                (overwrite && (!overwriteConfirmed || reason.trim().length < 5))
              }
            >
              {busy ? "Importerar…" : "Importera verifierade poster"}
            </Button>
            {!preview?.ok ? (
              <p className="text-sm text-muted-foreground">
                Knappen öppnas när en godkänd förhandsgranskning finns.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Steg 5 */}
        <Card>
          <CardHeader className="pb-3">
            <StepHeader step={5} current={step} title="Resultat" hint="Kvitto och länkar till importerad historik." />
          </CardHeader>
          <CardContent className="space-y-4">
            {!result ? (
              <p className="text-sm text-muted-foreground">Ingen import är genomförd än.</p>
            ) : (
              <>
                <Alert variant={result.ok ? "default" : "destructive"}>
                  <AlertTitle>{result.ok ? "Importen är klar" : "Importen blev delvis klar"}</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
                <div className="rounded-md border border-border p-4 text-sm">
                  <p>Skapade poster: <strong>{result.imported}</strong></p>
                  <p>Överhoppade dubbletter: <strong>{result.skipped}</strong></p>
                  <p>Överskrivna poster: <strong>{result.overwritten}</strong></p>
                  <p>
                    Blockerade/misslyckade:{" "}
                    <strong>{(result.results ?? []).filter((r: any) => r.action === "failed").length}</strong>
                  </p>
                  <p>Importens tidpunkt: {formatDateTime(result.imported_at)}</p>
                  <p>Importerad av: {profile?.display_name ?? "Okänd"}</p>
                  <p className="font-mono text-xs">import_batch_id: {result.import_batch_id}</p>
                  <p className="mt-2 text-muted-foreground">{result.economy_note}</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Omgång</TableHead>
                        <TableHead>Åtgärd</TableHead>
                        <TableHead>Id</TableHead>
                        <TableHead>Meddelande</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(result.results ?? []).map((r: any) => (
                        <TableRow key={r.idempotency_key}>
                          <TableCell>{r.idempotency_key}</TableCell>
                          <TableCell>
                            {r.action === "created"
                              ? "Skapad"
                              : r.action === "overwritten"
                                ? "Överskriven"
                                : r.action === "skipped"
                                  ? "Överhoppad"
                                  : "Misslyckad"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.id ?? "–"}</TableCell>
                          <TableCell>{r.message ?? "–"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="h-12" asChild>
                    <Link to="/historik">Öppna importerad historik</Link>
                  </Button>
                  <Button className="h-12" variant="outline" onClick={() => downloadReceipt("json")}>
                    Ladda ner importkvitto (JSON)
                  </Button>
                  <Button className="h-12" variant="outline" onClick={() => downloadReceipt("csv")}>
                    Ladda ner importkvitto (CSV)
                  </Button>
                  <Button className="h-12" variant="secondary" onClick={() => resetFlow(false)}>
                    Starta ny import
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
