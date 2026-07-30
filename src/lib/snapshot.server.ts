/**
 * Oföränderlig kopia ("snapshot") av spelet när ansvarig markerar att spelet
 * är inlämnat hos ATG. Kopian kan aldrig skrivas över. Endast serverkod.
 */

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function latestShare(entry: any): number | null {
  const snaps = [...(entry.market_snapshots ?? [])].sort((a: any, b: any) =>
    String(b.captured_at).localeCompare(String(a.captured_at)),
  );
  const v = snaps[0]?.bet_share_percent;
  return v === null || v === undefined ? null : Number(v);
}

/** Skapar snapshoten. Kastar fel om spelet redan är markerat som inlämnat. */
export async function createBetSnapshot(roundId: string, userId: string) {
  const db = await getAdmin();

  const { data: existing } = await db
    .from("bet_snapshots")
    .select("id")
    .eq("round_id", roundId)
    .maybeSingle();
  if (existing) {
    throw new Error("Spelet är redan markerat som inlämnat. Kopian kan inte skrivas över.");
  }

  const { data: round, error: roundError } = await db
    .from("rounds")
    .select("id, group_id, race_date, budget, row_price, weather_notes, track_condition, tracks:track_id(name)")
    .eq("id", roundId)
    .single();
  if (roundError) throw roundError;

  const { data: responsibility } = await db
    .from("round_responsibility")
    .select("user_id")
    .eq("round_id", roundId)
    .maybeSingle();

  const { data: races, error: racesError } = await db
    .from("races")
    .select(
      `id, leg_number, name,
       race_entries(id, start_number, scratched, horses:horse_id(name), drivers:driver_id(name),
         market_snapshots(bet_share_percent, captured_at)),
       group_race_assessments(id, notes, group_entry_assessments(race_entry_id, group_win_probability))`,
    )
    .eq("round_id", roundId)
    .order("leg_number", { ascending: true });
  if (racesError) throw racesError;

  const { data: systems } = await db
    .from("systems")
    .select(
      "id, name, system_versions(id, version_number, locked_at, calculated_rows, calculated_cost, budget, row_price, change_reason, system_selections(race_id, race_entry_id))",
    )
    .eq("round_id", roundId);

  const versions = (systems ?? []).flatMap((s: any) => s.system_versions ?? []);
  const version =
    versions.filter((v: any) => v.locked_at).sort((a: any, b: any) => b.version_number - a.version_number)[0] ??
    versions.sort((a: any, b: any) => b.version_number - a.version_number)[0] ??
    null;
  if (!version) throw new Error("Det finns inget system att spara. Lägg in ett systemförslag först.");

  const selected = new Set<string>((version.system_selections ?? []).map((s: any) => s.race_entry_id));

  const legs = (races ?? []).map((race: any) => {
    const probByEntry = new Map<string, number>();
    for (const ga of race.group_race_assessments ?? [])
      for (const ge of ga.group_entry_assessments ?? [])
        probByEntry.set(ge.race_entry_id, Number(ge.group_win_probability));

    return {
      race_id: race.id,
      leg_number: race.leg_number,
      notes: race.group_race_assessments?.[0]?.notes ?? null,
      entries: (race.race_entries ?? [])
        .filter((e: any) => selected.has(e.id))
        .map((e: any) => ({
          entry_id: e.id,
          start_number: e.start_number,
          horse: e.horses?.name ?? null,
          driver: e.drivers?.name ?? null,
          scratched: !!e.scratched,
          market_percent: latestShare(e),
          ai_probability: probByEntry.get(e.id) ?? null,
        }))
        .sort((a: any, b: any) => a.start_number - b.start_number),
    };
  });

  const raceIds = (races ?? []).map((r: any) => r.id);
  const { data: comments } = await db
    .from("comments")
    .select("id, entity_type, entity_id, body, created_by, created_at")
    .eq("group_id", round.group_id)
    .in("entity_id", [roundId, ...raceIds])
    .order("created_at", { ascending: true });

  const { data: changes } = await db
    .from("activity_log")
    .select("event_type, description, created_at, user_id")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  const { data: finalCheck } = await db
    .from("final_checks")
    .select("run_at, status, findings, suggestions")
    .eq("round_id", roundId)
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    round: {
      race_date: round.race_date,
      track: (round as any).tracks?.name ?? null,
      budget: Number(round.budget),
      row_price: Number(round.row_price),
      weather_notes: round.weather_notes,
      track_condition: round.track_condition,
    },
    system: {
      version_number: version.version_number,
      rows: version.calculated_rows,
      cost: version.calculated_cost,
      change_reason: version.change_reason,
    },
    legs,
    comments: comments ?? [],
    changes: changes ?? [],
    final_check: finalCheck ?? null,
  };

  const responsibleId = (responsibility?.user_id as string) ?? userId;

  const { data: snapshot, error: snapError } = await db
    .from("bet_snapshots")
    .insert({
      round_id: roundId,
      group_id: round.group_id,
      system_version_id: version.id,
      responsible_user_id: responsibleId,
      rows_count: version.calculated_rows,
      cost: version.calculated_cost,
      payload,
    })
    .select("*")
    .single();
  if (snapError) throw snapError;

  await db
    .from("rounds")
    .update({ submitted_manually_at: new Date().toISOString(), submitted_by: responsibleId })
    .eq("id", roundId);

  // Gruppens slutliga beslut sparas som eget lager.
  await db.from("analysis_layers").insert({
    round_id: roundId,
    group_id: round.group_id,
    layer: "decision",
    source_label: "Spelet inlämnat hos ATG",
    created_by: userId,
    content: { system_version_id: version.id, rows: version.calculated_rows, cost: version.calculated_cost },
  });

  await db.from("activity_log").insert({
    group_id: round.group_id,
    round_id: roundId,
    user_id: userId,
    event_type: "bet_submitted",
    description: "Spelet markerat som inlämnat hos ATG. En låst kopia av systemet har sparats.",
  });

  return { snapshotId: snapshot.id as string };
}
