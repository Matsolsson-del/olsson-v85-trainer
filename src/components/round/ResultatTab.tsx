import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
import { ERROR_CATEGORY_LABELS, formatCurrency } from "@/lib/labels";
import { useInvalidateRound, type RoundData } from "@/lib/travhub-queries";

export function ResultatTab({ data, roundId }: { data: RoundData; roundId: string }) {
  const invalidate = useInvalidateRound(roundId);

  return (
    <div className="space-y-4">
      {(data.races as any[]).map((race) => (
        <RaceResultCard key={race.id} race={race} onSaved={invalidate} />
      ))}
      <RoundSummary data={data} roundId={roundId} onSaved={invalidate} />
      <EfteranalysCard roundId={roundId} postmortem={data.postmortem} onDone={invalidate} />
    </div>
  );
}

function RaceResultCard({ race, onSaved }: { race: any; onSaved: () => void }) {
  const { user } = useAuth();
  const existing = race.race_results?.[0];
  const postmortem = race.race_postmortems?.[0];
  const entries = [...(race.race_entries ?? [])].sort(
    (a: any, b: any) => a.start_number - b.start_number,
  );

  const [winner, setWinner] = useState<string>(existing?.winner_entry_id ?? "");
  const [errorCategory, setErrorCategory] = useState<string>(
    postmortem?.primary_error_category ?? "",
  );
  const [lesson, setLesson] = useState(postmortem?.concrete_lesson ?? "");
  const [actual, setActual] = useState(postmortem?.actual_scenario ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!winner) return toast.error("Välj vinnare.");
    setBusy(true);
    try {
      if (existing) {
        const { error } = await supabase
          .from("race_results")
          .update({ winner_entry_id: winner })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("race_results").insert({
          race_id: race.id,
          winner_entry_id: winner,
          registered_by: user!.id,
        });
        if (error) throw error;
      }

      const pmPayload: any = {
        race_id: race.id,
        actual_scenario: actual || null,
        primary_error_category: errorCategory || null,
        concrete_lesson: lesson || null,
      };
      const { error: pmError } = postmortem
        ? await supabase.from("race_postmortems").update(pmPayload).eq("id", postmortem.id)
        : await supabase.from("race_postmortems").insert(pmPayload);
      if (pmError) throw pmError;

      toast.success("Resultat och efterrapport sparade.");
      onSaved();
    } catch (e: any) {
      toast.error("Kunde inte spara: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avdelning {race.leg_number}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Vinnare</Label>
          <Select value={winner || undefined} onValueChange={setWinner}>
            <SelectTrigger>
              <SelectValue placeholder="Välj vinnare" />
            </SelectTrigger>
            <SelectContent>
              {entries.map((e: any) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.start_number} {e.horses?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Huvudsaklig felkategori</Label>
          <Select value={errorCategory || undefined} onValueChange={setErrorCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Ingen / ej relevant" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ERROR_CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Faktiskt loppförlopp</Label>
          <Textarea rows={2} value={actual} onChange={(e) => setActual(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Konkret lärdom</Label>
          <Textarea rows={2} value={lesson} onChange={(e) => setLesson(e.target.value)} />
        </div>
        <div>
          <Button size="sm" onClick={save} disabled={busy}>
            Spara avdelning
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RoundSummary({
  data,
  roundId,
  onSaved,
}: {
  data: RoundData;
  roundId: string;
  onSaved: () => void;
}) {
  const result: any = data.roundResult;
  const pm: any = data.postmortem;
  const [winnings, setWinnings] = useState(result?.group_winnings?.toString() ?? "0");
  const [strengths, setStrengths] = useState(pm?.strengths ?? "");
  const [errors, setErrors] = useState(pm?.three_main_errors ?? "");
  const [changes, setChanges] = useState(pm?.max_three_changes_to_test ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const rPayload = { round_id: roundId, group_winnings: Number(winnings) };
      const { error: rErr } = result
        ? await supabase.from("round_results").update(rPayload).eq("id", result.id)
        : await supabase.from("round_results").insert(rPayload);
      if (rErr) throw rErr;

      const pPayload = {
        round_id: roundId,
        strengths: strengths || null,
        three_main_errors: errors || null,
        max_three_changes_to_test: changes || null,
      };
      const { error: pErr } = pm
        ? await supabase.from("round_postmortems").update(pPayload).eq("id", pm.id)
        : await supabase.from("round_postmortems").insert(pPayload);
      if (pErr) throw pErr;

      toast.success("Omgångens efterrapport sparad.");
      onSaved();
    } catch (e: any) {
      toast.error("Kunde inte spara: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Omgångens efterrapport ·{" "}
          <span className="font-normal text-muted-foreground">
            vinst {formatCurrency(Number(winnings) || 0)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Gruppens vinst (kr)</Label>
          <Input
            type="number"
            step="0.5"
            value={winnings}
            onChange={(e) => setWinnings(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Styrkor</Label>
          <Textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tre viktigaste felen</Label>
          <Textarea rows={2} value={errors} onChange={(e) => setErrors(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Max tre förändringar att testa</Label>
          <Textarea rows={2} value={changes} onChange={(e) => setChanges(e.target.value)} />
        </div>
        <div>
          <Button size="sm" onClick={save} disabled={busy}>
            Spara efterrapport
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
