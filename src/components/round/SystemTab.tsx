import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInvalidateRound, type RoundData } from "@/lib/travhub-queries";
import { calculateCost, calculateRows, type LegSelection } from "@/lib/system-math";
import { formatCurrency, formatDateTime } from "@/lib/labels";

const SPIKE_FIELDS = [
  { key: "why_spike", label: "Varför spik?" },
  { key: "main_strength", label: "Största styrka" },
  { key: "main_loss_risk", label: "Största förlustrisk" },
  { key: "main_opponent", label: "Farligaste motståndare" },
  { key: "expected_position", label: "Förväntat läge i loppet" },
  { key: "driver_assessment", label: "Kuskbedömning" },
  { key: "revoke_condition", label: "Vad river spiken?" },
] as const;

export function SystemTab({ data, roundId }: { data: RoundData; roundId: string }) {
  const { user } = useAuth();
  const invalidate = useInvalidateRound(roundId);
  const [busy, setBusy] = useState(false);

  const system: any = data.systems[0];
  const versions: any[] = [...(system?.system_versions ?? [])].sort(
    (a, b) => b.version_number - a.version_number,
  );
  const current = versions[0];

  async function createSystem() {
    setBusy(true);
    try {
      const { data: sys, error } = await supabase
        .from("systems")
        .insert({ round_id: roundId, name: "Huvudsystem", created_by: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      const { error: vErr } = await supabase.from("system_versions").insert({
        system_id: sys.id,
        version_number: 1,
        budget: Number(data.round.budget),
        row_price: Number(data.round.row_price),
      });
      if (vErr) throw vErr;
      invalidate();
    } catch (e: any) {
      toast.error("Kunde inte skapa system: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!system || !current) {
    return (
      <div className="rounded-lg border border-dashed border-white/20 px-6 py-12 text-center">
        <p className="font-medium">Inget system byggt ännu</p>
        <p className="mt-1 text-sm text-white/70">
          Skapa ett system för att markera hästar per avdelning inom budget.
        </p>
        <Button className="mt-4" onClick={createSystem} disabled={busy}>
          Skapa system
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SystemVersionEditor
        data={data}
        version={current}
        systemName={system.name}
        onChanged={invalidate}
      />
      {versions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Versionshistorik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {versions.slice(1).map((v) => (
              <div key={v.id} className="flex justify-between gap-3">
                <span>
                  v{v.version_number} · {v.calculated_rows} rader ·{" "}
                  {formatCurrency(Number(v.calculated_cost))}
                </span>
                <span className="text-muted-foreground">
                  {v.locked_at ? `Låst ${formatDateTime(v.locked_at)}` : "Utkast"}
                  {v.change_reason ? ` · ${v.change_reason}` : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SystemVersionEditor({
  data,
  version,
  systemName,
  onChanged,
}: {
  data: RoundData;
  version: any;
  systemName: string;
  onChanged: () => void;
}) {
  const locked = !!version.locked_at;
  const [busy, setBusy] = useState(false);
  const [changeReason, setChangeReason] = useState("");

  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const r of data.races as any[]) init[r.id] = [];
    for (const s of version.system_selections ?? []) {
      init[s.race_id] = [...(init[s.race_id] ?? []), s.race_entry_id];
    }
    return init;
  });

  const legSelections: LegSelection[] = useMemo(
    () => (data.races as any[]).map((r) => ({ raceId: r.id, entryIds: selections[r.id] ?? [] })),
    [data.races, selections],
  );
  const rows = calculateRows(legSelections, data.races.length || 8);
  const cost = calculateCost(rows, Number(version.row_price));
  const budget = Number(version.budget);
  const overBudget = cost > budget;
  const emptyLegs = legSelections.filter((l) => l.entryIds.length === 0).length;
  const spikeRaces = legSelections.filter((l) => l.entryIds.length === 1);

  function toggle(raceId: string, entryId: string) {
    if (locked) return;
    setSelections((s) => {
      const cur = s[raceId] ?? [];
      return {
        ...s,
        [raceId]: cur.includes(entryId) ? cur.filter((x) => x !== entryId) : [...cur, entryId],
      };
    });
  }

  async function save() {
    setBusy(true);
    try {
      await supabase.from("system_selections").delete().eq("system_version_id", version.id);
      const payload = legSelections.flatMap((l) =>
        l.entryIds.map((entryId) => ({
          system_version_id: version.id,
          race_id: l.raceId,
          race_entry_id: entryId,
        })),
      );
      if (payload.length > 0) {
        const { error } = await supabase.from("system_selections").insert(payload);
        if (error) throw error;
      }
      const { error: uErr } = await supabase
        .from("system_versions")
        .update({ calculated_rows: rows, calculated_cost: cost })
        .eq("id", version.id);
      if (uErr) throw uErr;
      toast.success("Systemet är sparat.");
      onChanged();
    } catch (e: any) {
      toast.error("Kunde inte spara: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setBusy(true);
    try {
      await save();
      const { error } = await supabase.rpc("lock_system_version", {
        _system_version_id: version.id,
      });
      if (error) throw error;
      toast.success("Systemet är låst.");
      onChanged();
    } catch (e: any) {
      toast.error("Låsning nekad: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function clone() {
    if (changeReason.trim().length < 5) return toast.error("Ange orsak till ändringen.");
    setBusy(true);
    const { error } = await supabase.rpc("clone_system_version", {
      _system_version_id: version.id,
      _change_reason: changeReason.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ny version skapad.");
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {systemName} v{version.version_number} {locked && <Badge className="ml-2">Låst</Badge>}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows} rader · {formatCurrency(cost)} av {formatCurrency(budget)}
            {overBudget && <span className="ml-2 text-destructive">över budget</span>}
            {emptyLegs > 0 && (
              <span className="ml-2 text-destructive">{emptyLegs} tomma avdelningar</span>
            )}
          </p>
        </div>
        {!locked ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={save} disabled={busy}>
              Spara
            </Button>
            <Button onClick={lock} disabled={busy || overBudget || emptyLegs > 0}>
              Lås system
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-56"
              placeholder="Orsak till ändring"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
            <Button variant="secondary" onClick={clone} disabled={busy}>
              Skapa ny version
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {legSelections.some((l) => l.entryIds.length > 0) && (
          <AtgExportCard
            trackName={(data.round as any)?.tracks?.name}
            raceDate={(data.round as any)?.race_date}
            rows={rows}
            cost={cost}
            legs={(data.races as any[]).map((race) => ({
              legNumber: race.leg_number,
              numbers: (race.race_entries ?? [])
                .filter((e: any) => (selections[race.id] ?? []).includes(e.id))
                .map((e: any) => e.start_number)
                .sort((a: number, b: number) => a - b),
            }))}
          />
        )}
        {(data.races as any[]).map((race) => {
          const entries = [...(race.race_entries ?? [])]
            .filter((e: any) => !e.scratched)
            .sort((a: any, b: any) => a.start_number - b.start_number);
          const picked = selections[race.id] ?? [];
          return (
            <div key={race.id} className="border-b border-white/10 pb-4 last:border-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">Avdelning {race.leg_number}</h3>
                <span className="text-sm text-muted-foreground">
                  {picked.length} valda{picked.length === 1 && " · spik"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {entries.map((e: any) => (
                  <label
                    key={e.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                      picked.includes(e.id)
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-white/15"
                    }`}
                  >
                    <Checkbox
                      checked={picked.includes(e.id)}
                      disabled={locked}
                      onCheckedChange={() => toggle(race.id, e.id)}
                    />
                    <span className="font-mono">{e.start_number}</span>
                    {e.horses?.name}
                  </label>
                ))}
                {entries.length === 0 && (
                  <span className="text-sm text-muted-foreground">Inget startfält registrerat.</span>
                )}
              </div>
            </div>
          );
        })}

        {spikeRaces.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg">Spikprotokoll</h3>
            {spikeRaces.map((l) => {
              const race: any = (data.races as any[]).find((r) => r.id === l.raceId);
              return (
                <SpikeProtocolForm
                  key={l.raceId}
                  versionId={version.id}
                  race={race}
                  entryId={l.entryIds[0]}
                  existing={(version.spike_protocols ?? []).find(
                    (p: any) => p.race_id === l.raceId,
                  )}
                  locked={locked}
                  onSaved={onChanged}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SpikeProtocolForm({
  versionId,
  race,
  entryId,
  existing,
  locked,
  onSaved,
}: {
  versionId: string;
  race: any;
  entryId: string;
  existing: any;
  locked: boolean;
  onSaved: () => void;
}) {
  const entry = (race.race_entries ?? []).find((e: any) => e.id === entryId);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of SPIKE_FIELDS) v[f.key] = existing?.[f.key] ?? "";
    return v;
  });
  const [busy, setBusy] = useState(false);
  const complete = SPIKE_FIELDS.every((f) => (values[f.key] ?? "").trim().length > 0);

  async function save() {
    setBusy(true);
    const payload: any = {
      system_version_id: versionId,
      race_id: race.id,
      race_entry_id: entryId,
      ...values,
    };
    const { error } = existing
      ? await supabase.from("spike_protocols").update(payload).eq("id", existing.id)
      : await supabase.from("spike_protocols").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Spikprotokoll sparat.");
    onSaved();
  }

  return (
    <div className="rounded-md border border-white/15 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium">
          Avdelning {race.leg_number} · {entry?.horses?.name ?? "Häst"}
        </p>
        <Badge variant={complete ? "default" : "secondary"}>
          {complete ? "Komplett" : "Ofullständigt"}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {SPIKE_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Textarea
              rows={2}
              disabled={locked}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {!locked && (
        <Button size="sm" className="mt-3" onClick={save} disabled={busy}>
          Spara spikprotokoll
        </Button>
      )}
    </div>
  );
}
