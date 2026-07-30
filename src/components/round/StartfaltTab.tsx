import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useInvalidateRound, type RoundData } from "@/lib/travhub-queries";

export function StartfaltTab({ data, roundId }: { data: RoundData; roundId: string }) {
  const invalidate = useInvalidateRound(roundId);
  const [openLeg, setOpenLeg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Registrera startfältet per avdelning. Markera strukna hästar – de exkluderas automatiskt ur
        analys och system.
      </p>

      {data.races.map((race: any) => (
        <Card key={race.id}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              Avdelning {race.leg_number}
              {race.name ? ` · ${race.name}` : ""}{" "}
              <span className="font-normal text-muted-foreground">
                ({race.race_entries?.length ?? 0} startande)
              </span>
            </CardTitle>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpenLeg(openLeg === race.id ? null : race.id)}
            >
              {openLeg === race.id ? "Dölj" : "Redigera"}
            </Button>
          </CardHeader>
          <CardContent>
            <EntryTable race={race} onChanged={invalidate} />
            {openLeg === race.id && (
              <div className="mt-4 space-y-4 rounded-md border border-white/10 p-4">
                <RaceMetaForm race={race} onSaved={invalidate} />
                <AddEntryForm raceId={race.id} onAdded={invalidate} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EntryTable({ race, onChanged }: { race: any; onChanged: () => void }) {
  const entries = [...(race.race_entries ?? [])].sort(
    (a: any, b: any) => a.start_number - b.start_number,
  );
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">Inget startfält registrerat ännu.</p>;

  async function toggleScratched(entry: any) {
    const { error } = await supabase
      .from("race_entries")
      .update({ scratched: !entry.scratched })
      .eq("id", entry.id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Nr</TableHead>
          <TableHead>Häst</TableHead>
          <TableHead>Kusk</TableHead>
          <TableHead>Tränare</TableHead>
          <TableHead className="w-20">Spår</TableHead>
          <TableHead className="w-24">Struken</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e: any) => (
          <TableRow key={e.id} className={e.scratched ? "opacity-50" : undefined}>
            <TableCell className="font-mono">{e.start_number}</TableCell>
            <TableCell className="font-medium">{e.horses?.name ?? "—"}</TableCell>
            <TableCell>{e.drivers?.name ?? "—"}</TableCell>
            <TableCell>{e.trainers?.name ?? "—"}</TableCell>
            <TableCell className="font-mono">{e.post_position ?? "—"}</TableCell>
            <TableCell>
              <Switch
                checked={e.scratched}
                onCheckedChange={() => toggleScratched(e)}
                aria-label={`Markera ${e.horses?.name} som struken`}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RaceMetaForm({ race, onSaved }: { race: any; onSaved: () => void }) {
  const [name, setName] = useState(race.name ?? "");
  const [distance, setDistance] = useState(race.distance_m?.toString() ?? "");
  const [paceNotes, setPaceNotes] = useState(race.pace_notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("races")
      .update({
        name: name || null,
        distance_m: distance ? Number(distance) : null,
        pace_notes: paceNotes || null,
      })
      .eq("id", race.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Avdelningen sparad.");
    onSaved();
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Loppnamn</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Distans (m)</Label>
        <Input
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
        />
      </div>
      <div className="space-y-1.5 md:col-span-3">
        <Label>Tempoanteckningar</Label>
        <Textarea value={paceNotes} onChange={(e) => setPaceNotes(e.target.value)} rows={2} />
      </div>
      <div>
        <Button size="sm" onClick={save} disabled={busy}>
          Spara avdelning
        </Button>
      </div>
    </div>
  );
}

async function findOrCreate(table: "horses" | "drivers" | "trainers", name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from(table).insert({ name: trimmed }).select("id").single();
  if (error) throw error;
  return data.id;
}

function AddEntryForm({ raceId, onAdded }: { raceId: string; onAdded: () => void }) {
  const [startNumber, setStartNumber] = useState("");
  const [horse, setHorse] = useState("");
  const [driver, setDriver] = useState("");
  const [trainer, setTrainer] = useState("");
  const [post, setPost] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!startNumber || !horse.trim()) return toast.error("Startnummer och häst krävs.");
    setBusy(true);
    try {
      const horseId = await findOrCreate("horses", horse);
      const driverId = await findOrCreate("drivers", driver);
      const trainerId = await findOrCreate("trainers", trainer);
      const { error } = await supabase.from("race_entries").insert({
        race_id: raceId,
        start_number: Number(startNumber),
        horse_id: horseId!,
        driver_id: driverId,
        trainer_id: trainerId,
        post_position: post ? Number(post) : Number(startNumber),
      });
      if (error) throw error;
      setStartNumber("");
      setHorse("");
      setDriver("");
      setTrainer("");
      setPost("");
      onAdded();
    } catch (e: any) {
      toast.error("Kunde inte lägga till: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-end gap-3 md:grid-cols-6">
      <div className="space-y-1.5">
        <Label>Nr</Label>
        <Input value={startNumber} onChange={(e) => setStartNumber(e.target.value)} type="number" />
      </div>
      <div className="space-y-1.5">
        <Label>Häst</Label>
        <Input value={horse} onChange={(e) => setHorse(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Kusk</Label>
        <Input value={driver} onChange={(e) => setDriver(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Tränare</Label>
        <Input value={trainer} onChange={(e) => setTrainer(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Spår</Label>
        <Input value={post} onChange={(e) => setPost(e.target.value)} type="number" />
      </div>
      <Button onClick={add} disabled={busy}>
        Lägg till
      </Button>
    </div>
  );
}
