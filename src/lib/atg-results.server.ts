/**
 * Hämtar färdiga V85-resultat från ATG och skriver in dem i databasen.
 * Endast serverkod.
 */

const ATG_BASE = "https://www.atg.se/services/racinginfo/v1/api";

async function atgGet<T>(path: string): Promise<T> {
  const res = await fetch(`${ATG_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ATG svarade ${res.status} på ${path}`);
  return (await res.json()) as T;
}

const JOB_TYPE = "resultat-v85";

export type ResultImport = {
  roundId: string;
  gameId: string;
  races: number;
  winners: number;
  payout: number | null;
};

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Letar upp ATG:s spel-id för en omgångs datum. */
async function findGameIdForDate(raceDate: string): Promise<string | null> {
  const data = await atgGet<any>("/products/V85");
  const all = [...(data.results ?? []), ...(data.upcoming ?? [])];
  const match = all.find((g: any) => String(g.startTime ?? "").slice(0, 10) === raceDate);
  return match?.id ?? null;
}

function payoutFromGame(game: any): number | null {
  const payouts = game?.pools?.V85?.result?.payouts;
  if (!payouts) return null;
  const eight = payouts["8"] ?? payouts[8];
  const amount = eight?.amount ?? eight;
  if (typeof amount !== "number") return null;
  // ATG anger belopp i ören.
  return Math.round(amount) / 100;
}

/** Hämtar resultat för en omgång. Kan köras om utan att skapa dubbletter. */
export async function importResultsForRound(
  roundId: string,
  triggeredBy: string | null,
): Promise<ResultImport> {
  const db = await getAdmin();

  const { data: round, error: roundError } = await db
    .from("rounds")
    .select("id, group_id, race_date, created_by, status")
    .eq("id", roundId)
    .single();
  if (roundError) throw roundError;

  const { data: run } = await db
    .from("job_runs")
    .insert({
      group_id: round.group_id,
      round_id: roundId,
      job_type: JOB_TYPE,
      status: "running",
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();

  try {
    const gameId = await findGameIdForDate(round.race_date);
    if (!gameId) throw new Error("Hittade ingen V85-omgång hos ATG för det datumet.");

    const game = await atgGet<any>(`/games/${gameId}`);
    const atgRaces = (game.races ?? [])
      .slice()
      .sort((a: any, b: any) => (a.number ?? 0) - (b.number ?? 0));

    const { data: races, error: racesError } = await db
      .from("races")
      .select("id, leg_number, race_entries(id, start_number)")
      .eq("round_id", roundId)
      .order("leg_number", { ascending: true });
    if (racesError) throw racesError;

    let winners = 0;
    for (let i = 0; i < (races ?? []).length; i++) {
      const race = races[i];
      const atgRace = atgRaces[i];
      if (!atgRace) continue;

      const byNumber = new Map<number, string>(
        (race.race_entries ?? []).map((e: any) => [e.start_number, e.id]),
      );
      const starts = (atgRace.starts ?? []).filter((s: any) => s.result);
      if (starts.length === 0) continue;

      const winnerStart = starts.find((s: any) => s.result?.place === 1);
      const winnerEntryId = winnerStart ? (byNumber.get(winnerStart.number) ?? null) : null;

      const { data: existing } = await db
        .from("race_results")
        .select("id")
        .eq("race_id", race.id)
        .maybeSingle();

      let resultId: string;
      if (existing) {
        resultId = existing.id;
        await db
          .from("race_results")
          .update({ winner_entry_id: winnerEntryId })
          .eq("id", resultId);
        await db.from("entry_results").delete().eq("race_result_id", resultId);
      } else {
        const { data: inserted, error } = await db
          .from("race_results")
          .insert({
            race_id: race.id,
            winner_entry_id: winnerEntryId,
            registered_by: round.created_by,
          })
          .select("id")
          .single();
        if (error) throw error;
        resultId = inserted.id;
      }
      if (winnerEntryId) winners++;

      const rows = starts
        .map((s: any) => {
          const entryId = byNumber.get(s.number);
          if (!entryId) return null;
          const place = typeof s.result?.place === "number" ? s.result.place : null;
          return {
            race_result_id: resultId,
            race_entry_id: entryId,
            finish_position: place,
            disqualified: Boolean(s.result?.disqualified ?? s.result?.disqualification),
            galloped: Boolean(s.result?.galloped),
            event_notes: s.result?.finishOrder ? String(s.result.finishOrder) : null,
          };
        })
        .filter(Boolean);
      if (rows.length > 0) await db.from("entry_results").insert(rows);
    }

    const payout = payoutFromGame(game);
    const { data: existingRoundResult } = await db
      .from("round_results")
      .select("id")
      .eq("round_id", roundId)
      .maybeSingle();
    if (existingRoundResult) {
      await db
        .from("round_results")
        .update({ v85_payout: payout })
        .eq("id", existingRoundResult.id);
    } else {
      await db
        .from("round_results")
        .insert({ round_id: roundId, v85_payout: payout, group_winnings: 0 });
    }

    if (
      winners > 0 &&
      ["draft", "individual_analysis", "analyses_revealed", "group_assessment", "system_building", "system_locked"].includes(
        round.status,
      )
    ) {
      await db.from("rounds").update({ status: "results_registered" }).eq("id", roundId);
    }

    const result: ResultImport = {
      roundId,
      gameId,
      races: (races ?? []).length,
      winners,
      payout,
    };

    await db
      .from("job_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        log: JSON.parse(JSON.stringify(result)),
      })
      .eq("id", run!.id);

    await db.from("activity_log").insert({
      group_id: round.group_id,
      round_id: roundId,
      event_type: "results_imported",
      description: `Resultat hämtade automatiskt från ATG: ${winners} vinnare${
        payout !== null ? `, utdelning ${payout} kr` : ""
      }.`,
    });

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

/** Hämtar resultat för alla omgångar de senaste tio dagarna som saknar vinnare. */
export async function importResultsForRecentRounds(): Promise<ResultImport[]> {
  const db = await getAdmin();
  const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: rounds, error } = await db
    .from("rounds")
    .select("id")
    .gte("race_date", since)
    .lte("race_date", today);
  if (error) throw error;

  const results: ResultImport[] = [];
  for (const r of rounds ?? []) {
    try {
      results.push(await importResultsForRound(r.id, null));
    } catch (e) {
      console.error("Resultatimport misslyckades för omgång", r.id, e);
    }
  }
  return results;
}
