/**
 * Automatisk slutkontroll före spelstopp.
 * Kontrollerar strykningar, kuskbyten, balans/utrustning, bana, väder och
 * större streckförändringar. Den föreslår ändringar men ändrar aldrig
 * själv ett fastställt system. Endast serverkod.
 */

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

type Finding = {
  severity: "info" | "varning" | "allvarlig";
  area: string;
  leg: number | null;
  message: string;
};

function sortedSnaps(entry: any) {
  return [...(entry.market_snapshots ?? [])].sort((a: any, b: any) =>
    String(a.captured_at).localeCompare(String(b.captured_at)),
  );
}

/** Kör slutkontrollen och sparar resultatet som förslag. */
export async function runFinalCheck(roundId: string, userId: string) {
  const db = await getAdmin();

  const { data: round, error: roundError } = await db
    .from("rounds")
    .select("id, group_id, bet_stop_at, weather_notes, track_condition, track_id")
    .eq("id", roundId)
    .single();
  if (roundError) throw roundError;

  const { data: races, error } = await db
    .from("races")
    .select(
      `id, leg_number, start_at,
       race_entries(id, start_number, scratched, shoe_info, cart_info, equipment_notes, updated_at,
         horses:horse_id(name), drivers:driver_id(name),
         market_snapshots(bet_share_percent, captured_at))`,
    )
    .eq("round_id", roundId)
    .order("leg_number", { ascending: true });
  if (error) throw error;

  // Vilka hästar ingår i det aktuella systemet?
  const { data: systems } = await db
    .from("systems")
    .select("id, system_versions(id, version_number, locked_at, system_selections(race_id, race_entry_id))")
    .eq("round_id", roundId);

  const versions = (systems ?? []).flatMap((s: any) => s.system_versions ?? []);
  const current =
    versions.filter((v: any) => v.locked_at).sort((a: any, b: any) => b.version_number - a.version_number)[0] ??
    versions.sort((a: any, b: any) => b.version_number - a.version_number)[0] ??
    null;
  const selectedEntryIds = new Set<string>(
    (current?.system_selections ?? []).map((s: any) => s.race_entry_id),
  );

  // Tidigare faktabaslinje att jämföra mot (kusk, utrustning).
  const { data: baselineRow } = await db
    .from("analysis_layers")
    .select("id, content, created_at")
    .eq("round_id", roundId)
    .eq("layer", "fact")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const baseline: Record<string, any> = (baselineRow?.content as any)?.entries ?? {};

  const findings: Finding[] = [];
  const suggestions: string[] = [];
  const currentFacts: Record<string, any> = {};

  for (const race of races ?? []) {
    for (const entry of race.race_entries ?? []) {
      const label = `${entry.start_number} ${entry.horses?.name ?? "häst"}`;
      const inSystem = selectedEntryIds.has(entry.id);

      currentFacts[entry.id] = {
        driver: entry.drivers?.name ?? null,
        shoe: entry.shoe_info ?? null,
        cart: entry.cart_info ?? null,
        equipment: entry.equipment_notes ?? null,
        scratched: !!entry.scratched,
      };
      const before = baseline[entry.id];

      if (entry.scratched) {
        findings.push({
          severity: inSystem ? "allvarlig" : "info",
          area: "Strykning",
          leg: race.leg_number,
          message: `${label} är struken${inSystem ? " och ingår i systemet" : ""}.`,
        });
        if (inSystem) {
          suggestions.push(
            `Avdelning ${race.leg_number}: byt ut strukna ${label} mot nästa häst i turordningen.`,
          );
        }
      }

      if (before) {
        if (before.driver && currentFacts[entry.id].driver && before.driver !== currentFacts[entry.id].driver) {
          findings.push({
            severity: inSystem ? "varning" : "info",
            area: "Kuskbyte",
            leg: race.leg_number,
            message: `${label}: kusk ändrad från ${before.driver} till ${currentFacts[entry.id].driver}.`,
          });
          if (inSystem)
            suggestions.push(
              `Avdelning ${race.leg_number}: kontrollera om kuskbytet på ${label} ändrar bedömningen.`,
            );
        }
        const equipBefore = [before.shoe, before.cart, before.equipment].join("|");
        const equipNow = [
          currentFacts[entry.id].shoe,
          currentFacts[entry.id].cart,
          currentFacts[entry.id].equipment,
        ].join("|");
        if (equipBefore !== equipNow) {
          findings.push({
            severity: "info",
            area: "Balans och utrustning",
            leg: race.leg_number,
            message: `${label}: skor, sulky eller utrustning har ändrats sedan importen.`,
          });
        }
      }

      const snaps = sortedSnaps(entry);
      if (snaps.length >= 2) {
        const first = Number(snaps[0].bet_share_percent ?? 0);
        const last = Number(snaps[snaps.length - 1].bet_share_percent ?? 0);
        const diff = Math.round((last - first) * 10) / 10;
        if (Math.abs(diff) >= 5) {
          findings.push({
            severity: Math.abs(diff) >= 10 ? "varning" : "info",
            area: "Streckförändring",
            leg: race.leg_number,
            message: `${label}: streckprocenten har ${diff > 0 ? "ökat" : "minskat"} med ${Math.abs(
              diff,
            )} procentenheter (${first} → ${last} %).`,
          });
          if (diff >= 10 && !inSystem)
            suggestions.push(
              `Avdelning ${race.leg_number}: ${label} spelas kraftigt men saknas i systemet – överväg gardering.`,
            );
        }
      }
    }
  }

  if (!round.track_condition) {
    findings.push({
      severity: "info",
      area: "Bana",
      leg: null,
      message: "Banans underlag är inte noterat inför spelstopp.",
    });
  }
  if (!round.weather_notes) {
    findings.push({
      severity: "info",
      area: "Väder",
      leg: null,
      message: "Väderläget är inte noterat inför spelstopp.",
    });
  }
  if (!current) {
    findings.push({
      severity: "varning",
      area: "System",
      leg: null,
      message: "Det finns inget system att kontrollera ännu.",
    });
  }

  // Spara/uppdatera faktalagret (verifierade uppgifter från källan).
  if (baselineRow) {
    await db
      .from("analysis_layers")
      .insert({
        round_id: roundId,
        group_id: round.group_id,
        layer: "fact",
        source_label: "Slutkontroll före spelstopp",
        created_by: userId,
        content: { entries: currentFacts },
      });
  } else {
    await db.from("analysis_layers").insert({
      round_id: roundId,
      group_id: round.group_id,
      layer: "fact",
      source_label: "Baslinje vid första slutkontrollen",
      created_by: userId,
      content: { entries: currentFacts },
    });
  }

  const status = findings.some((f) => f.severity === "allvarlig")
    ? "allvarlig"
    : findings.some((f) => f.severity === "varning")
      ? "varning"
      : "ok";

  const { data: saved, error: saveError } = await db
    .from("final_checks")
    .insert({
      round_id: roundId,
      group_id: round.group_id,
      status,
      findings,
      suggestions,
      created_by: userId,
    })
    .select("*")
    .single();
  if (saveError) throw saveError;

  await db.from("activity_log").insert({
    group_id: round.group_id,
    round_id: roundId,
    user_id: userId,
    event_type: "final_check_run",
    description: `Slutkontroll körd: ${findings.length} noteringar, ${suggestions.length} förslag. Inget har ändrats automatiskt.`,
  });

  return saved;
}
