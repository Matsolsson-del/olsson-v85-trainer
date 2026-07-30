import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInvalidateRound, type RoundData } from "@/lib/travhub-queries";
import {
  assessRoundQuality,
  parseOdds,
  parseStartList,
  type ParsedEntry,
} from "@/lib/import-parsers";

type ImportType = "startlista" | "spelfordelning";

export function DataTab({ data, roundId }: { data: RoundData; roundId: string }) {
  const invalidate = useInvalidateRound(roundId);
  const quality = useMemo(() => assessRoundQuality(data.races as any[]), [data.races]);
  const [saving, setSaving] = useState(false);

  async function saveQualityReport() {
    setSaving(true);
    const { error } = await supabase.from("data_quality_reports").insert({
      round_id: roundId,
      score: quality.score,
      missing_fields: quality.missingFields,
      warnings: quality.warnings,
      sufficient_for_final: quality.sufficientForFinal,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Datakvalitetsrapport sparad.");
    invalidate();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Datakvalitet</CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant={quality.sufficientForFinal ? "secondary" : "destructive"}>
              {quality.sufficientForFinal
                ? "Tillräcklig för slutligt system"
                : "Otillräcklig – komplettera data"}
            </Badge>
            <Button size="sm" variant="secondary" onClick={saveQualityReport} disabled={saving}>
              Spara rapport
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sammanvägd kvalitet</span>
              <span className="font-medium">{quality.score} / 100</span>
            </div>
            <Progress value={quality.score} />
          </div>
          <ul className="space-y-1 text-sm">
            {quality.legs.map((leg) => (
              <li key={leg.raceId} className="flex flex-wrap justify-between gap-2">
                <span>
                  Avdelning {leg.legNumber} · {leg.entryCount} startande
                </span>
                <span
                  className={
                    leg.missing.length ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {leg.missing.length ? `saknar ${leg.missing.join(", ")}` : "komplett"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Ingen automatik låser systemet – importen skapar bara underlag. Spelansvarig fattar
            besluten och spelet lämnas in hos ATG.
          </p>
        </CardContent>
      </Card>

      {(data.races as any[]).map((race) => (
        <ImportCard key={race.id} race={race} roundId={roundId} onDone={invalidate} />
      ))}
    </div>
  );
}

function ImportCard({
  race,
  roundId,
  onDone,
}: {
  race: any;
  roundId: string;
  onDone: () => void;
}) {
  const [type, setType] = useState<ImportType>("startlista");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const preview =
    type === "startlista" ? parseStartList(text) : (parseOdds(text) as any);

  async function runImport() {
    setBusy(true);
    setErrors([]);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Du är inte inloggad.");

      let summary: Record<string, unknown>;
      if (type === "startlista") {
        const parsed = parseStartList(text);
        setErrors(parsed.errors);
        if (parsed.rows.length === 0) throw new Error("Inga rader kunde tolkas.");
        summary = await importStartList(race.id, parsed.rows);
      } else {
        const parsed = parseOdds(text);
        setErrors(parsed.errors);
        if (parsed.rows.length === 0) throw new Error("Inga rader kunde tolkas.");
        summary = await importOdds(race, parsed.rows, userId);
      }

      await supabase.from("data_imports").insert({
        round_id: roundId,
        created_by: userId,
        import_type: type,
        raw_payload: text,
        result_summary: summary as any,
      });

      toast.success(`Avdelning ${race.leg_number}: import klar.`);
      setText("");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Importen misslyckades.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Avdelning {race.leg_number}
          {race.name ? ` · ${race.name}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div className="space-y-1">
            <Label>Typ av import</Label>
            <Select value={type} onValueChange={(v) => setType(v as ImportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="startlista">Startlista</SelectItem>
                <SelectItem value="spelfordelning">Spelfördelning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Klistra in text</Label>
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                type === "startlista"
                  ? "1 Hästnamn (Kusk Kusksson) [Tränare] 2140\n2 Nästa Häst - Annan Kusk\nStruken: 3 Utgången Häst"
                  : "1 12,5\n2 8.0\n3 21 %"
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {text.trim()
              ? `${preview.rows.length} rader tolkade${
                  preview.errors.length ? `, ${preview.errors.length} fel` : ""
                }`
              : "Manuell reservimport – samma format som automatiska källor levererar."}
          </p>
          <Button size="sm" onClick={runImport} disabled={busy || !text.trim()}>
            Importera
          </Button>
        </div>

        {(errors.length > 0 || (text.trim() && preview.errors.length > 0)) && (
          <ul className="space-y-1 text-xs text-destructive">
            {(errors.length ? errors : preview.errors).slice(0, 8).map((msg: string, i: number) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

async function ensureNamed(
  table: "horses" | "drivers" | "trainers",
  name: string,
): Promise<string> {
  const normalized = name.trim().toLowerCase();
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .ilike("name", name.trim())
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const payload: any = { name: name.trim() };
  if (table === "horses") payload.normalized_name = normalized;
  const { data, error } = await supabase.from(table).insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

async function importStartList(raceId: string, rows: ParsedEntry[]) {
  const { data: existing } = await supabase
    .from("race_entries")
    .select("id, start_number")
    .eq("race_id", raceId);
  const byNumber = new Map((existing ?? []).map((e) => [e.start_number, e.id]));

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const horse_id = await ensureNamed("horses", row.horseName);
    const driver_id = row.driverName ? await ensureNamed("drivers", row.driverName) : null;
    const trainer_id = row.trainerName ? await ensureNamed("trainers", row.trainerName) : null;

    const payload = {
      race_id: raceId,
      start_number: row.startNumber,
      horse_id,
      driver_id,
      trainer_id,
      post_position: row.postPosition ?? row.startNumber,
      base_distance_m: row.baseDistanceM ?? null,
      scratched: row.scratched,
    };

    const id = byNumber.get(row.startNumber);
    if (id) {
      const { error } = await supabase.from("race_entries").update(payload).eq("id", id);
      if (error) throw error;
      updated += 1;
    } else {
      const { error } = await supabase.from("race_entries").insert(payload);
      if (error) throw error;
      created += 1;
    }
  }

  return { created, updated, total: rows.length };
}

async function importOdds(
  race: any,
  rows: { startNumber: number; betSharePercent: number }[],
  userId: string,
) {
  const entries: any[] = race.race_entries ?? [];
  const byNumber = new Map(entries.map((e) => [e.start_number, e.id]));
  const payload: any[] = [];
  const missing: number[] = [];

  for (const row of rows) {
    const entryId = byNumber.get(row.startNumber);
    if (!entryId) {
      missing.push(row.startNumber);
      continue;
    }
    payload.push({
      race_entry_id: entryId,
      bet_share_percent: row.betSharePercent,
      created_by: userId,
    });
  }

  if (payload.length === 0) throw new Error("Inga startnummer matchade startfältet.");
  const { error } = await supabase.from("market_snapshots").insert(payload);
  if (error) throw error;

  return { saved: payload.length, missing };
}
