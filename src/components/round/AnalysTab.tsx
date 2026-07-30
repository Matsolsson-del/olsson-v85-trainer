import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvalidateRound, type RoundData } from "@/lib/travhub-queries";
import { formatDateTime, formatPercent } from "@/lib/labels";

const TIERS = [
  { value: "a", label: "A – huvudchans" },
  { value: "b", label: "B – utmanare" },
  { value: "c", label: "C – skräll" },
  { value: "d", label: "D – bortval" },
];

export function AnalysTab({ data, roundId }: { data: RoundData; roundId: string }) {
  const { user } = useAuth();
  const invalidate = useInvalidateRound(roundId);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(
    data.races[0]?.id ?? null,
  );
  const revealed = !!data.round.analyses_revealed_at;

  const race: any = data.races.find((r: any) => r.id === activeRaceId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {data.races.map((r: any) => {
          const mine = r.individual_race_assessments?.find((a: any) => a.user_id === user?.id);
          return (
            <Button
              key={r.id}
              size="sm"
              variant={r.id === activeRaceId ? "default" : "secondary"}
              onClick={() => setActiveRaceId(r.id)}
            >
              Avd {r.leg_number}
              {mine?.locked_at && " ✓"}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={revealed ? "default" : "secondary"}>
          {revealed
            ? `Analyser öppnade ${formatDateTime(data.round.analyses_revealed_at)}`
            : "Blindläge – andras analyser är dolda"}
        </Badge>
        {!revealed && <RevealButton roundId={roundId} onDone={invalidate} />}
      </div>

      {race ? (
        <>
          <MyAnalysis race={race} onSaved={invalidate} />
          {revealed && <GroupComparison race={race} />}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Inga avdelningar registrerade.</p>
      )}
    </div>
  );
}

function RevealButton({ roundId, onDone }: { roundId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function reveal() {
    if (reason.trim().length < 5)
      return toast.error("Ange en motivering för tidig öppning (minst 5 tecken).");
    setBusy(true);
    const { error } = await supabase.rpc("reveal_analyses_early", {
      _round_id: roundId,
      _reason: reason.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Analyserna är öppnade.");
    onDone();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="w-64"
        placeholder="Motivering för tidig öppning"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button size="sm" variant="secondary" onClick={reveal} disabled={busy}>
        Öppna analyser tidigt
      </Button>
    </div>
  );
}

function MyAnalysis({ race, onSaved }: { race: any; onSaved: () => void }) {
  const { user } = useAuth();
  const mine = race.individual_race_assessments?.find((a: any) => a.user_id === user?.id);
  const locked = !!mine?.locked_at;
  const entries = useMemo(
    () =>
      [...(race.race_entries ?? [])]
        .filter((e: any) => !e.scratched)
        .sort((a: any, b: any) => a.start_number - b.start_number),
    [race],
  );

  const [rows, setRows] = useState<Record<string, { tier: string; prob: string; note: string }>>(
    () => {
      const init: Record<string, { tier: string; prob: string; note: string }> = {};
      for (const e of race.race_entries ?? []) {
        const ex = mine?.individual_entry_assessments?.find((x: any) => x.race_entry_id === e.id);
        init[e.id] = {
          tier: ex?.tier ?? "",
          prob: ex?.estimated_win_probability != null ? String(ex.estimated_win_probability) : "",
          note: ex?.reasoning ?? "",
        };
      }
      return init;
    },
  );
  const [notes, setNotes] = useState(mine?.overall_notes ?? "");
  const [confidence, setConfidence] = useState(mine?.confidence?.toString() ?? "3");
  const [busy, setBusy] = useState(false);

  const probSum = Object.values(rows).reduce((s, r) => s + (Number(r.prob) || 0), 0);

  async function persist(lock: boolean) {
    setBusy(true);
    try {
      let assessmentId = mine?.id as string | undefined;
      if (!assessmentId) {
        const { data, error } = await supabase
          .from("individual_race_assessments")
          .insert({
            race_id: race.id,
            user_id: user!.id,
            overall_notes: notes || null,
            confidence: Number(confidence),
          })
          .select("id")
          .single();
        if (error) throw error;
        assessmentId = data.id;
      } else {
        const { error } = await supabase
          .from("individual_race_assessments")
          .update({ overall_notes: notes || null, confidence: Number(confidence) })
          .eq("id", assessmentId);
        if (error) throw error;
      }

      const payload = entries
        .filter((e: any) => rows[e.id]?.tier || rows[e.id]?.prob)
        .map((e: any) => ({
          individual_race_assessment_id: assessmentId!,
          race_entry_id: e.id,
          tier: (rows[e.id].tier || null) as any,
          estimated_win_probability: rows[e.id].prob ? Number(rows[e.id].prob) : null,
          reasoning: rows[e.id].note || null,
        }));

      await supabase
        .from("individual_entry_assessments")
        .delete()
        .eq("individual_race_assessment_id", assessmentId!);
      if (payload.length > 0) {
        const { error } = await supabase.from("individual_entry_assessments").insert(payload);
        if (error) throw error;
      }

      if (lock) {
        const { error } = await supabase.rpc("submit_individual_analysis", {
          _assessment_id: assessmentId!,
        });
        if (error) throw error;
        toast.success("Analysen är inlämnad och låst.");
      } else {
        toast.success("Utkastet är sparat.");
      }
      onSaved();
    } catch (e: any) {
      toast.error("Kunde inte spara: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">
          Min analys – avdelning {race.leg_number}
          {locked && <Badge className="ml-2">Låst</Badge>}
        </CardTitle>
        <span
          className={
            Math.abs(probSum - 100) > 5 ? "text-sm text-destructive" : "text-sm text-success"
          }
        >
          Summa vinstchans: {formatPercent(probSum)}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {entries.map((e: any) => (
            <div key={e.id} className="grid items-end gap-2 md:grid-cols-12">
              <div className="md:col-span-3">
                <span className="font-mono text-sm text-muted-foreground">{e.start_number}</span>{" "}
                <span className="font-medium">{e.horses?.name}</span>
                <p className="text-xs text-muted-foreground">{e.drivers?.name ?? "—"}</p>
              </div>
              <div className="md:col-span-3">
                <Select
                  value={rows[e.id]?.tier || undefined}
                  disabled={locked}
                  onValueChange={(v) =>
                    setRows((r) => ({ ...r, [e.id]: { ...r[e.id], tier: v } }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="Vinst-%"
                  disabled={locked}
                  value={rows[e.id]?.prob ?? ""}
                  onChange={(ev) =>
                    setRows((r) => ({ ...r, [e.id]: { ...r[e.id], prob: ev.target.value } }))
                  }
                />
              </div>
              <div className="md:col-span-4">
                <Input
                  placeholder="Motivering"
                  disabled={locked}
                  value={rows[e.id]?.note ?? ""}
                  onChange={(ev) =>
                    setRows((r) => ({ ...r, [e.id]: { ...r[e.id], note: ev.target.value } }))
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5 md:col-span-3">
            <Label>Sammanfattning</Label>
            <Textarea
              rows={2}
              disabled={locked}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Säkerhet (1–5)</Label>
            <Input
              type="number"
              min="1"
              max="5"
              disabled={locked}
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
            />
          </div>
        </div>

        {!locked && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => persist(false)} disabled={busy}>
              Spara utkast
            </Button>
            <Button onClick={() => persist(true)} disabled={busy}>
              Lämna in och lås
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GroupComparison({ race }: { race: any }) {
  const assessments = race.individual_race_assessments ?? [];
  const entries = [...(race.race_entries ?? [])].sort(
    (a: any, b: any) => a.start_number - b.start_number,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gruppens analyser – avdelning {race.leg_number}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((e: any) => {
          const probs = assessments
            .map((a: any) =>
              a.individual_entry_assessments?.find((x: any) => x.race_entry_id === e.id),
            )
            .filter(Boolean)
            .map((x: any) => Number(x.estimated_win_probability ?? 0));
          if (probs.length === 0) return null;
          const avg = probs.reduce((s: number, v: number) => s + v, 0) / probs.length;
          const spread = Math.max(...probs) - Math.min(...probs);
          return (
            <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-mono text-muted-foreground">{e.start_number}</span>{" "}
                {e.horses?.name}
              </span>
              <span className="text-muted-foreground">
                snitt {formatPercent(avg)} · spridning {formatPercent(spread)}
                {spread >= 15 && <span className="ml-2 text-primary">oenighet</span>}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
