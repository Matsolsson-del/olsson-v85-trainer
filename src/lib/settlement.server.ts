/**
 * Automatiskt resultat- och efterrapportsflöde för V85.
 *
 * Hämtar den officiella vinnarraden och utdelningarna från ATG, jämför med den
 * inlämnade (låsta) systemversionen och räknar maskinellt ut radutfallet.
 * Endast serverkod.
 */

import {
  settleRound,
  validateSettlement,
  type PayoutTable,
  type SettlementLegInput,
  type SettlementResult,
} from "@/lib/settlement-math";

const ATG_BASE = "https://www.atg.se/services/racinginfo/v1/api";
const DEFAULT_ROW_PRICE = 0.5;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function arr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [v];
}

function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function atgGet<T>(path: string): Promise<T> {
  const res = await fetch(`${ATG_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ATG svarade ${res.status} på ${path}`);
  return (await res.json()) as T;
}

export type OfficialResult = {
  gameId: string | null;
  sourceUrl: string;
  raceDate: string | null;
  trackName: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  /** Vinnande startnummer per avdelning (flera vid dött lopp). */
  winnersByLeg: Record<number, number[]>;
  scratchedByLeg: Record<number, number[]>;
  payouts: PayoutTable;
  complete: boolean;
};

function payoutsFromGame(game: any): PayoutTable {
  const raw = game?.pools?.V85?.result?.payouts ?? {};
  const table: PayoutTable = {};
  for (const level of [8, 7, 6, 5] as const) {
    const cell = raw[String(level)] ?? raw[level];
    const amount = typeof cell === "number" ? cell : (cell?.payout ?? cell?.amount);
    if (typeof amount === "number") table[level] = Math.round(amount) / 100;
  }
  return table;
}

/** Hämtar och verifierar det officiella resultatet hos ATG. */
export async function fetchOfficialResult(raceDate: string): Promise<OfficialResult> {
  const products = await atgGet<any>("/products/V85");
  const all = [...arr(products.results), ...arr(products.upcoming)];
  const match = all.find((g: any) => String(g.startTime ?? "").slice(0, 10) === raceDate);
  const gameId: string | null = match?.id ?? null;
  const fetchedAt = new Date().toISOString();

  if (!gameId) {
    return {
      gameId: null,
      sourceUrl: "https://www.atg.se/spel/V85",
      raceDate,
      trackName: null,
      publishedAt: null,
      fetchedAt,
      winnersByLeg: {},
      scratchedByLeg: {},
      payouts: {},
      complete: false,
    };
  }

  const game = await atgGet<any>(`/games/${gameId}`);
  const races = arr(game.races)
    .slice()
    .sort((a: any, b: any) => (a.number ?? 0) - (b.number ?? 0));

  const winnersByLeg: Record<number, number[]> = {};
  const scratchedByLeg: Record<number, number[]> = {};
  races.forEach((race: any, index: number) => {
    const leg = index + 1;
    const starts = arr(race.starts);
    winnersByLeg[leg] = starts
      .filter((s: any) => s.result?.place === 1)
      .map((s: any) => Number(s.number))
      .filter((n: number) => Number.isFinite(n));
    scratchedByLeg[leg] = starts
      .filter((s: any) => s.scratched === true)
      .map((s: any) => Number(s.number))
      .filter((n: number) => Number.isFinite(n));
  });

  const payouts = payoutsFromGame(game);
  const legCount = races.length;
  const complete =
    legCount === 8 &&
    Object.values(winnersByLeg).every((w) => w.length > 0) &&
    typeof payouts[8] === "number";

  return {
    gameId,
    sourceUrl: `https://www.atg.se/spel/${gameId}`,
    raceDate: String(game.startTime ?? "").slice(0, 10) || raceDate,
    trackName: arr(game.tracks)[0]?.name ?? races[0]?.track?.name ?? null,
    publishedAt: game?.pools?.V85?.timestamp
      ? new Date(String(game.pools.V85.timestamp).replace(" ", "T") + "+02:00").toISOString()
      : null,
    fetchedAt,
    winnersByLeg,
    scratchedByLeg,
    payouts,
    complete,
  };
}

export type SettlementRecord = {
  id: string;
  status: string;
  verification: string;
  issues: string[];
  raceDate: string | null;
  trackName: string | null;
  source: string | null;
  sourceUrl: string | null;
  officialGameId: string | null;
  publishedAt: string | null;
  fetchedAt: string | null;
  payouts: PayoutTable;
  calculation: SettlementResult;
  winnerLabels: Array<{ leg: number; winners: string[] }>;
  approvedAt: string | null;
  approvedBy: string | null;
};

type OverrideInput = {
  /** Vinnande startnummer per avdelning, t.ex. { 1: [8], 2: [3, 5] } */
  winnersByLeg?: Record<number, number[]>;
  payouts?: PayoutTable;
  fee?: number;
  knownSystemCost?: number | null;
  source?: string;
  sourceUrl?: string | null;
};

/**
 * Räknar ut resultatet för en omgång och sparar det som utkast.
 * Idempotent: samma omgång + systemversion + officiellt id ger samma rad.
 */
export async function buildRoundSettlement(
  roundId: string,
  override?: OverrideInput,
): Promise<SettlementRecord> {
  const admin = await getAdmin();

  const { data: round, error: roundError } = await admin
    .from("rounds")
    .select("id, group_id, race_date, status, tracks(name)")
    .eq("id", roundId)
    .maybeSingle();
  if (roundError) throw roundError;
  if (!round) throw new Error("Omgången hittades inte.");

  const { data: races, error: racesError } = await admin
    .from("races")
    .select(
      "id, leg_number, race_entries(id, start_number, scratched, horses(name)), race_results(winner_entry_id)",
    )
    .eq("round_id", roundId)
    .order("leg_number", { ascending: true });
  if (racesError) throw racesError;

  const { data: systems } = await admin
    .from("systems")
    .select(
      "id, system_versions(id, calculated_rows, calculated_cost, row_price, locked_at, created_at, system_selections(race_id, race_entry_id, reserve_order))",
    )
    .eq("round_id", roundId);

  const versions = arr(systems).flatMap((s: any) => arr(s.system_versions));
  const submitted =
    versions
      .filter((v: any) => v.locked_at)
      .sort((a: any, b: any) => String(b.locked_at).localeCompare(String(a.locked_at)))[0] ?? null;
  if (!submitted) {
    throw new Error(
      "Det finns ingen låst och inlämnad systemversion för omgången, så utfallet går inte att räkna ut.",
    );
  }

  const official = override?.winnersByLeg
    ? null
    : await fetchOfficialResult(round.race_date).catch(() => null);

  const legs: SettlementLegInput[] = [];
  const winnerLabels: Array<{ leg: number; winners: string[] }> = [];

  for (const race of arr(races)) {
    const entries = arr(race.race_entries);
    const byNumber = new Map<number, any>(entries.map((e: any) => [e.start_number, e]));
    const byId = new Map<string, any>(entries.map((e: any) => [e.id, e]));

    // Vinnare: i första hand override, sedan officiell hämtning, sedan sparat resultat.
    let winnerIds: string[] = [];
    const overrideNumbers = override?.winnersByLeg?.[race.leg_number];
    const officialNumbers = official?.winnersByLeg?.[race.leg_number];
    if (overrideNumbers?.length) {
      winnerIds = overrideNumbers.map((n) => byNumber.get(n)?.id).filter(Boolean);
    } else if (officialNumbers?.length) {
      winnerIds = officialNumbers.map((n) => byNumber.get(n)?.id).filter(Boolean);
    } else {
      const stored = arr(race.race_results)[0]?.winner_entry_id;
      if (stored) winnerIds = [stored];
    }

    const scratchedNumbers = official?.scratchedByLeg?.[race.leg_number] ?? [];
    const scratchedIds = new Set<string>([
      ...entries.filter((e: any) => e.scratched).map((e: any) => e.id),
      ...scratchedNumbers.map((n) => byNumber.get(n)?.id).filter(Boolean),
    ]);

    const picks = arr(submitted.system_selections)
      .filter((s: any) => s.race_id === race.id)
      .map((s: any) => {
        const entry = byId.get(s.race_entry_id);
        return {
          entryId: s.race_entry_id,
          startNumber: entry?.start_number ?? 0,
          label: entry ? `${entry.start_number} ${entry.horses?.name ?? "okänd häst"}` : "okänd häst",
          reserveOrder: s.reserve_order ?? null,
        };
      });

    legs.push({
      leg: race.leg_number,
      picks,
      winnerEntryIds: winnerIds,
      scratchedEntryIds: [...scratchedIds],
    });

    winnerLabels.push({
      leg: race.leg_number,
      winners: winnerIds.map((id) => {
        const e = byId.get(id);
        return e ? `${e.start_number} ${e.horses?.name ?? "okänd häst"}` : "okänd häst";
      }),
    });
  }

  const payouts: PayoutTable = override?.payouts ?? official?.payouts ?? {};
  const rowPrice = num(submitted.row_price) ?? DEFAULT_ROW_PRICE;
  const calculation = settleRound({
    legs,
    payouts,
    rowPrice,
    fee: override?.fee ?? 0,
    knownSystemCost: override?.knownSystemCost ?? num(submitted.calculated_cost),
  });

  const trackName = round.tracks?.name ?? official?.trackName ?? null;
  const issues = validateSettlement({
    legs,
    payouts,
    result: calculation,
    raceDate: round.race_date ?? null,
    trackName,
  });

  const source = override?.source ?? (official?.gameId ? "atg" : "manual");
  let verification: string;
  if (override?.winnersByLeg) verification = issues.length === 0 ? "parsed_upload" : "needs_review";
  else if (official?.complete && issues.length === 0) verification = "verified_official";
  else if (official?.gameId && calculation.decidedLegs > 0) verification = "partial";
  else verification = "needs_review";

  // Kontrollera motstridiga uppgifter mellan officiellt och uppladdat resultat.
  if (override?.winnersByLeg && official?.complete) {
    const conflict = legs.some((leg) => {
      const officialNums = official.winnersByLeg[leg.leg] ?? [];
      const uploadNums = override.winnersByLeg?.[leg.leg] ?? [];
      return (
        officialNums.length > 0 &&
        uploadNums.length > 0 &&
        officialNums.slice().sort().join(",") !== uploadNums.slice().sort().join(",")
      );
    });
    if (conflict) {
      verification = "conflicting";
      issues.push("Det uppladdade resultatet stämmer inte med ATG:s officiella resultat.");
    }
  }

  const idempotencyKey = [
    round.group_id,
    official?.gameId ?? round.race_date,
    submitted.id,
  ].join(":");

  const payload = {
    group_id: round.group_id,
    round_id: roundId,
    system_version_id: submitted.id,
    idempotency_key: idempotencyKey,
    verification,
    source,
    source_url: override?.sourceUrl ?? official?.sourceUrl ?? null,
    official_game_id: official?.gameId ?? null,
    race_date: round.race_date ?? null,
    track_name: trackName,
    published_at: official?.publishedAt ?? null,
    fetched_at: new Date().toISOString(),
    winners: winnerLabels,
    scratches: legs.map((l) => ({ leg: l.leg, scratched: l.scratchedEntryIds.length })),
    payouts,
    calculation: JSON.parse(JSON.stringify(calculation)),
    issues,
    system_cost: calculation.systemCost,
    fee: calculation.fee,
    total_cost: calculation.totalCost,
    payout_total: calculation.payoutTotal,
    net: calculation.net,
    return_percent: calculation.returnPercent,
  };

  const { data: existing } = await admin
    .from("round_settlements")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  let saved: any;
  if (existing) {
    if (existing.status === "approved") {
      // Ett godkänt resultat skrivs aldrig över – vi visar bara det som finns.
      const { data } = await admin
        .from("round_settlements")
        .select("*")
        .eq("id", existing.id)
        .single();
      saved = data;
    } else {
      const { data, error } = await admin
        .from("round_settlements")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      saved = data;
    }
  } else {
    const { data, error } = await admin
      .from("round_settlements")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    saved = data;
  }

  return toRecord(saved);
}

function toRecord(row: any): SettlementRecord {
  return {
    id: row.id,
    status: row.status,
    verification: row.verification,
    issues: arr(row.issues) as string[],
    raceDate: row.race_date ?? null,
    trackName: row.track_name ?? null,
    source: row.source ?? null,
    sourceUrl: row.source_url ?? null,
    officialGameId: row.official_game_id ?? null,
    publishedAt: row.published_at ?? null,
    fetchedAt: row.fetched_at ?? null,
    payouts: row.payouts ?? {},
    calculation: row.calculation ?? ({} as SettlementResult),
    winnerLabels: arr(row.winners),
    approvedAt: row.approved_at ?? null,
    approvedBy: row.approved_by ?? null,
  };
}

/** Hämtar sparad uträkning för en omgång, om den finns. */
export async function getRoundSettlement(roundId: string): Promise<SettlementRecord | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("round_settlements")
    .select("*")
    .eq("round_id", roundId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toRecord(data) : null;
}

/** Kontrollerar att användaren får godkänna resultatet (ansvarig eller gruppägare). */
export async function mayApprove(roundId: string, userId: string): Promise<boolean> {
  const admin = await getAdmin();
  const { data: round } = await admin
    .from("rounds")
    .select("group_id")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return false;

  const { data: owner } = await admin
    .from("group_members")
    .select("role")
    .eq("group_id", round.group_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (owner?.role === "owner") return true;

  const { data: resp } = await admin
    .from("round_responsibility")
    .select("user_id")
    .eq("round_id", roundId)
    .maybeSingle();
  return resp?.user_id === userId;
}

/**
 * Godkänner och sparar resultatet permanent: skriver resultat, ekonomi,
 * historikstatus och skapar efterrapporten om den saknas.
 */
export async function approveRoundSettlement(roundId: string, userId: string) {
  const admin = await getAdmin();
  if (!(await mayApprove(roundId, userId))) {
    throw new Error("Bara veckans ansvarige eller Mats får godkänna resultatet.");
  }

  const settlement = await getRoundSettlement(roundId);
  if (!settlement) throw new Error("Det finns ingen uträkning att godkänna. Hämta resultatet först.");
  if (settlement.status === "approved") return settlement;
  if (settlement.verification === "needs_review" || settlement.verification === "conflicting") {
    throw new Error(
      "Resultatet är inte tillräckligt säkert för att sparas. Rätta uppgifterna eller hämta resultatet igen.",
    );
  }

  const calc = settlement.calculation;

  const { data: existingResult } = await admin
    .from("round_results")
    .select("id")
    .eq("round_id", roundId)
    .maybeSingle();
  const resultPayload = {
    round_id: roundId,
    v85_payout: settlement.payouts?.[8] ?? null,
    group_winnings: calc.payoutTotal ?? 0,
  };
  if (existingResult) {
    await admin.from("round_results").update(resultPayload).eq("id", existingResult.id);
  } else {
    await admin.from("round_results").insert(resultPayload);
  }

  await admin
    .from("round_settlements")
    .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", settlement.id);

  await admin.from("rounds").update({ status: "completed" }).eq("id", roundId);

  const { data: round } = await admin
    .from("rounds")
    .select("group_id")
    .eq("id", roundId)
    .maybeSingle();

  await admin.from("activity_log").insert({
    group_id: round?.group_id ?? null,
    round_id: roundId,
    user_id: userId,
    event_type: "result_approved",
    description: `Resultatet godkändes: ${calc.correctLegs ?? 0} rätt, utbetalning ${
      calc.payoutTotal ?? 0
    } kr, netto ${calc.net ?? 0} kr.`,
    after_value: { settlement_id: settlement.id },
  });

  // Skapa AI-utkastet till efterrapport om det saknas.
  const { data: pm } = await admin
    .from("round_postmortems")
    .select("id, ai_generated_at")
    .eq("round_id", roundId)
    .maybeSingle();
  if (!pm?.ai_generated_at) {
    try {
      const { generateRoundPostmortem } = await import("@/lib/round-postmortem.server");
      await generateRoundPostmortem(roundId);
    } catch (e) {
      console.error("Efterrapporten kunde inte skapas automatiskt:", e);
    }
  }

  return (await getRoundSettlement(roundId))!;
}

/** Kör resultatberäkning för alla nyligen spelade omgångar (schemalagt). */
export async function settleRecentRounds(): Promise<Array<{ roundId: string; status: string }>> {
  const admin = await getAdmin();
  const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: rounds } = await admin
    .from("rounds")
    .select("id, status")
    .gte("race_date", since)
    .lte("race_date", today)
    .neq("status", "completed");

  const out: Array<{ roundId: string; status: string }> = [];
  for (const r of arr(rounds)) {
    try {
      const rec = await buildRoundSettlement(r.id);
      out.push({ roundId: r.id, status: rec.verification });
    } catch (e: any) {
      out.push({ roundId: r.id, status: `fel: ${e?.message ?? String(e)}` });
    }
  }
  return out;
}
