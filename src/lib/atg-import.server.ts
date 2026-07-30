/**
 * Skapar/uppdaterar veckans V85-omgång utifrån ATG:s data.
 * Endast serverkod (service role) – aldrig importerad i webbläsaren.
 */
import {
  betDistributionToPercent,
  fetchNextV85,
  fetchV85Game,
  fullName,
  mapStartMethod,
  normalizeName,
  type AtgRace,
} from "./atg.server";

const JOB_TYPE = "atg_v85_import";
const JOB_CRON = "0 6 * * 4"; // torsdag morgon

export type ImportResult = {
  roundId: string;
  gameId: string;
  raceDate: string;
  trackName: string;
  created: boolean;
  races: number;
  entries: number;
  marketRows: number;
};

type Admin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Admin;
}

/** Hämtar eller skapar en aktör (häst/kusk/tränare) och returnerar dess id. */
async function resolveActor(
  db: any,
  table: "horses" | "drivers" | "trainers",
  externalId: string | null,
  name: string,
  cache: Map<string, string>,
): Promise<string> {
  const key = `${table}:${externalId ?? normalizeName(name)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  if (externalId) {
    const { data } = await db
      .from(table)
      .select("id")
      .eq("external_id", externalId)
      .maybeSingle();
    if (data?.id) {
      cache.set(key, data.id);
      return data.id;
    }
  }

  const normalized = normalizeName(name);
  const { data: byName } = await db
    .from(table)
    .select("id")
    .eq("normalized_name", normalized)
    .maybeSingle();
  if (byName?.id) {
    if (externalId) await db.from(table).update({ external_id: externalId }).eq("id", byName.id);
    cache.set(key, byName.id);
    return byName.id;
  }

  const { data: inserted, error } = await db
    .from(table)
    .insert({ name, normalized_name: normalized, external_id: externalId })
    .select("id")
    .single();
  if (error) throw error;
  cache.set(key, inserted.id);
  return inserted.id;
}

async function resolveTrack(db: any, name: string): Promise<string> {
  const normalized = normalizeName(name);
  const { data } = await db
    .from("tracks")
    .select("id")
    .eq("normalized_name", normalized)
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: inserted, error } = await db
    .from("tracks")
    .insert({ name, normalized_name: normalized })
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id;
}

async function resolveSource(db: any, groupId: string): Promise<string> {
  const { data } = await db
    .from("data_sources")
    .select("id")
    .eq("group_id", groupId)
    .eq("name", "ATG")
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: inserted, error } = await db
    .from("data_sources")
    .insert({
      group_id: groupId,
      name: "ATG",
      kind: "api",
      note: "Automatisk hämtning från ATG:s öppna racing-API.",
    })
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id;
}

async function ensureJob(db: any, groupId: string): Promise<string> {
  const { data } = await db
    .from("jobs")
    .select("id")
    .eq("group_id", groupId)
    .eq("job_type", JOB_TYPE)
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: inserted, error } = await db
    .from("jobs")
    .insert({
      group_id: groupId,
      job_type: JOB_TYPE,
      schedule_cron: JOB_CRON,
      description: "Skapar veckans V85-omgång med startfält och spelfördelning från ATG.",
      active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id;
}

/** Importerar nästa V85-omgång till en grupp. Körs om utan att skapa dubbletter. */
export async function importNextV85Round(
  groupId: string,
  triggeredBy: string | null,
): Promise<ImportResult> {
  const db = await getAdmin();
  const jobId = await ensureJob(db, groupId);

  const { data: run } = await db
    .from("job_runs")
    .insert({
      job_id: jobId,
      group_id: groupId,
      job_type: JOB_TYPE,
      status: "running",
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();

  try {
    const result = await runImport(db, groupId);
    await db
      .from("job_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        round_id: result.roundId,
        log: JSON.parse(JSON.stringify(result)),
      })
      .eq("id", run!.id);
    return result;
  } catch (error: any) {
    await db
      .from("job_runs")
      .update({
        status: "needs_manual",
        finished_at: new Date().toISOString(),
        error_message: error?.message ?? String(error),
      })
      .eq("id", run!.id);
    throw error;
  }
}

async function runImport(db: any, groupId: string): Promise<ImportResult> {
  const upcoming = await fetchNextV85();
  if (!upcoming) throw new Error("ATG har ingen kommande V85-omgång just nu.");

  const game = await fetchV85Game(upcoming.id);
  const races = (game.races ?? [])
    .slice()
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  if (races.length === 0) throw new Error("ATG returnerade inga avdelningar för omgången.");

  const trackName = upcoming.tracks?.[0]?.name ?? races[0].track?.name ?? "Okänd bana";
  const raceDate = upcoming.startTime.slice(0, 10);

  const { data: group, error: groupError } = await db
    .from("groups")
    .select("owner_id, default_row_price, default_budget")
    .eq("id", groupId)
    .single();
  if (groupError) throw groupError;

  const trackId = await resolveTrack(db, trackName);
  const sourceId = await resolveSource(db, groupId);

  const { data: existingRound } = await db
    .from("rounds")
    .select("id")
    .eq("group_id", groupId)
    .eq("product_type", "V85")
    .eq("race_date", raceDate)
    .maybeSingle();

  let roundId: string;
  const created = !existingRound;
  if (existingRound) {
    roundId = existingRound.id;
    await db
      .from("rounds")
      .update({ track_id: trackId, bet_stop_at: upcoming.startTime })
      .eq("id", roundId);
  } else {
    const { data: inserted, error } = await db
      .from("rounds")
      .insert({
        group_id: groupId,
        product_type: "V85",
        track_id: trackId,
        race_date: raceDate,
        bet_stop_at: upcoming.startTime,
        row_price: group.default_row_price,
        budget: group.default_budget,
        status: "draft",
        created_by: group.owner_id,
        general_notes: `Automatiskt importerad från ATG (${upcoming.id}).`,
      })
      .select("id")
      .single();
    if (error) throw error;
    roundId = inserted.id;
  }

  const cache = new Map<string, string>();
  let entryCount = 0;
  let marketRows = 0;

  for (let i = 0; i < races.length; i++) {
    const race: AtgRace = races[i];
    const legNumber = i + 1;

    const racePayload = {
      round_id: roundId,
      leg_number: legNumber,
      external_race_number: race.number ?? null,
      name: race.name ?? null,
      start_at: race.startTime ?? null,
      distance_m: race.distance ?? null,
      start_method: mapStartMethod(race.startMethod),
    };

    const { data: existingRace } = await db
      .from("races")
      .select("id")
      .eq("round_id", roundId)
      .eq("leg_number", legNumber)
      .maybeSingle();

    let raceId: string;
    if (existingRace) {
      raceId = existingRace.id;
      await db.from("races").update(racePayload).eq("id", raceId);
    } else {
      const { data: insertedRace, error } = await db
        .from("races")
        .insert(racePayload)
        .select("id")
        .single();
      if (error) throw error;
      raceId = insertedRace.id;
    }

    const { data: existingEntries } = await db
      .from("race_entries")
      .select("id, start_number")
      .eq("race_id", raceId);
    const byNumber = new Map<number, string>(
      (existingEntries ?? []).map((e: any) => [e.start_number, e.id]),
    );

    for (const start of race.starts ?? []) {
      const horseId = await resolveActor(
        db,
        "horses",
        String(start.horse.id),
        start.horse.name,
        cache,
      );
      const driverName = fullName(start.driver);
      const driverId = driverName
        ? await resolveActor(db, "drivers", String(start.driver!.id), driverName, cache)
        : null;
      const trainerName = fullName(start.horse.trainer);
      const trainerId = trainerName
        ? await resolveActor(
            db,
            "trainers",
            String(start.horse.trainer!.id),
            trainerName,
            cache,
          )
        : null;

      const payload = {
        race_id: raceId,
        horse_id: horseId,
        driver_id: driverId,
        trainer_id: trainerId,
        start_number: start.number,
        post_position: start.postPosition ?? null,
        base_distance_m: start.distance ?? race.distance ?? null,
        age: start.horse.age ?? null,
        sex: start.horse.sex ?? null,
        earnings: typeof start.horse.money === "number" ? start.horse.money : null,
        scratched: Boolean(start.scratched),
        source_id: sourceId,
        verified_at: new Date().toISOString(),
      };

      let entryId = byNumber.get(start.number) ?? null;
      if (entryId) {
        await db.from("race_entries").update(payload).eq("id", entryId);
      } else {
        const { data: insertedEntry, error } = await db
          .from("race_entries")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        entryId = insertedEntry.id;
      }
      entryCount++;

      const share = betDistributionToPercent(start.pools?.V85?.betDistribution);
      if (share !== null) {
        const { error: snapError } = await db.from("market_snapshots").insert({
          race_entry_id: entryId,
          bet_share_percent: share,
          source_id: sourceId,
        });
        if (!snapError) marketRows++;
      }
    }
  }

  return {
    roundId,
    gameId: upcoming.id,
    raceDate,
    trackName,
    created,
    races: races.length,
    entries: entryCount,
    marketRows,
  };
}

/** Kör importen för alla grupper (används av veckoschemat). */
export async function importForAllGroups(): Promise<ImportResult[]> {
  const db = await getAdmin();
  const { data: groups, error } = await db.from("groups").select("id");
  if (error) throw error;
  const results: ImportResult[] = [];
  for (const g of groups ?? []) {
    results.push(await importNextV85Round(g.id, null));
  }
  return results;
}
