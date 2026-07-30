/**
 * Bygger tre systemförslag inom budget utifrån gruppens (eller AI:ns) vinstchanser.
 * Endast serverkod. Förslagen är utkast – de låser aldrig något.
 */

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

type Cand = { entryId: string; prob: number; market: number };
type Leg = { raceId: string; legNumber: number; candidates: Cand[] };

export type Profile = "balanserat" | "sakrare" | "varde";

const PROFILE_TITLES: Record<Profile, string> = {
  sakrare: "Tryggt",
  balanserat: "Balanserat",
  varde: "Offensivt",
};

const PROFILE_RISK: Record<Profile, string> = {
  sakrare: "Låg risk",
  balanserat: "Mellanrisk",
  varde: "Hög risk",
};

const PROFILE_RATIONALE: Record<Profile, string> = {
  sakrare: "Prioriterar täckning – fler hästar i de mest osäkra avdelningarna.",
  balanserat: "Bredd där avdelningarna är osäkra, spik där en häst är klart bäst.",
  varde: "Tar med hästar som bedöms bättre än vad spelarna strecker dem.",
};


function latestShare(entry: any): number {
  const snaps = [...(entry.market_snapshots ?? [])].sort((a: any, b: any) =>
    String(b.captured_at).localeCompare(String(a.captured_at)),
  );
  const v = snaps[0]?.bet_share_percent;
  return v ? Number(v) : 0;
}

function build(legs: Leg[], rowPrice: number, budget: number, profile: Profile) {
  const chosen = legs.map((leg) => ({ leg, picked: [leg.candidates[0]] as Cand[] }));

  const rows = () => chosen.reduce((a, c) => a * c.picked.length, 1);
  const cost = () => (rows() * Math.round(rowPrice * 100)) / 100;

  let guard = 0;
  while (guard++ < 200) {
    let best: { idx: number; cand: Cand; score: number } | null = null;
    for (let i = 0; i < chosen.length; i++) {
      const slot = chosen[i];
      const next = slot.leg.candidates[slot.picked.length];
      if (!next) continue;
      const newRows = (rows() / slot.picked.length) * (slot.picked.length + 1);
      const newCost = (newRows * Math.round(rowPrice * 100)) / 100;
      if (newCost > budget) continue;
      const extraCost = newCost - cost();
      let gain = next.prob;
      if (profile === "varde") gain = next.prob - next.market;
      if (profile === "sakrare") {
        const covered = slot.picked.reduce((a, c) => a + c.prob, 0);
        gain = next.prob * (1 + (100 - covered) / 100);
      }
      const score = gain / Math.max(extraCost, 1);
      if (gain <= 0) continue;
      if (!best || score > best.score) best = { idx: i, cand: next, score };
    }
    if (!best) break;
    chosen[best.idx].picked.push(best.cand);
  }

  const coverage = chosen.reduce(
    (a, c) => a * Math.min(1, c.picked.reduce((s, x) => s + x.prob, 0) / 100),
    1,
  );

  const legCoverage = chosen.map((c) => ({
    raceId: c.leg.raceId,
    legNumber: c.leg.legNumber,
    count: c.picked.length,
    covered: Math.round(c.picked.reduce((s, x) => s + x.prob, 0) * 10) / 10,
    entryIds: c.picked.map((p) => p.entryId),
  }));

  const spikes = legCoverage
    .filter((l) => l.count === 1)
    .map((l) => ({
      race_id: l.raceId,
      leg_number: l.legNumber,
      entry_id: l.entryIds[0],
      probability: l.covered,
    }));

  const hedges = legCoverage
    .filter((l) => l.count > 1)
    .map((l) => ({
      race_id: l.raceId,
      leg_number: l.legNumber,
      count: l.count,
      entry_ids: l.entryIds,
      coverage: l.covered,
    }));

  const weakest = [...legCoverage].sort((a, b) => a.covered - b.covered)[0];
  const weakestAssumption = weakest
    ? weakest.count === 1
      ? `Avdelning ${weakest.legNumber}: hela systemet faller om spiken inte vinner (bedömd vinstchans ${weakest.covered} %).`
      : `Avdelning ${weakest.legNumber}: ${weakest.count} hästar täcker bara ${weakest.covered} % av bedömd vinstchans.`
    : null;

  return {
    profile,
    title: PROFILE_TITLES[profile],
    riskLevel: PROFILE_RISK[profile],
    recommended: profile === "balanserat",
    rationale: PROFILE_RATIONALE[profile],
    weakestAssumption,
    spikes,
    hedges,
    rows: rows(),
    cost: cost(),
    coverage: Math.round(coverage * 10000) / 10000,
    selections: chosen.map((c) => ({
      race_id: c.leg.raceId,
      leg_number: c.leg.legNumber,
      entry_ids: c.picked.map((p) => p.entryId),
    })),
  };
}


/** Skapar (eller ersätter) tre systemförslag för omgången. */
export async function buildSystemCandidates(roundId: string, userId: string) {
  const db = await getAdmin();

  const { data: round, error: roundError } = await db
    .from("rounds")
    .select("id, group_id, budget, row_price")
    .eq("id", roundId)
    .single();
  if (roundError) throw roundError;

  const { data: races, error } = await db
    .from("races")
    .select(
      `id, leg_number,
       race_entries(id, scratched, market_snapshots(bet_share_percent, captured_at)),
       group_race_assessments(id, group_entry_assessments(race_entry_id, group_win_probability))`,
    )
    .eq("round_id", roundId)
    .order("leg_number", { ascending: true });
  if (error) throw error;

  const legs: Leg[] = [];
  for (const race of races ?? []) {
    const probByEntry = new Map<string, number>();
    for (const ga of race.group_race_assessments ?? []) {
      for (const ge of ga.group_entry_assessments ?? []) {
        probByEntry.set(ge.race_entry_id, Number(ge.group_win_probability));
      }
    }
    const candidates: Cand[] = (race.race_entries ?? [])
      .filter((e: any) => !e.scratched)
      .map((e: any) => {
        const market = latestShare(e);
        return { entryId: e.id, prob: probByEntry.get(e.id) ?? market, market };
      })
      .filter((c: Cand) => c.prob > 0)
      .sort((a: Cand, b: Cand) => b.prob - a.prob);
    if (candidates.length === 0) continue;
    legs.push({ raceId: race.id, legNumber: race.leg_number, candidates });
  }

  if (legs.length === 0) {
    throw new Error("Det saknas startfält och bedömningar att bygga system av.");
  }

  const budget = Number(round.budget);
  const rowPrice = Number(round.row_price);
  const proposals = (["balanserat", "sakrare", "varde"] as Profile[]).map((p) =>
    build(legs, rowPrice, budget, p),
  );

  await db.from("system_candidates").delete().eq("round_id", roundId).eq("selected", false);

  const rows = proposals.map((p) => ({
    round_id: roundId,
    profile: p.profile,
    title: p.title,
    rationale: p.rationale,
    selections: p.selections,
    rows_count: p.rows,
    cost: p.cost,
    estimated_coverage: p.coverage,
    selected: false,
  }));
  const { error: insertError } = await db.from("system_candidates").insert(rows);
  if (insertError) throw insertError;

  await db.from("activity_log").insert({
    group_id: round.group_id,
    round_id: roundId,
    user_id: userId,
    event_type: "system_candidates_generated",
    description: "Tre systemförslag skapade automatiskt inom budget.",
  });

  return proposals.map((p) => ({
    profile: p.profile,
    rows: p.rows,
    cost: p.cost,
    coverage: p.coverage,
  }));
}

/** Skriver in ett valt förslag som en ny (olåst) systemversion. */
export async function applySystemCandidate(candidateId: string, userId: string) {
  const db = await getAdmin();

  const { data: candidate, error } = await db
    .from("system_candidates")
    .select("id, round_id, title, profile, selections")
    .eq("id", candidateId)
    .single();
  if (error) throw error;

  const { data: round, error: roundError } = await db
    .from("rounds")
    .select("id, group_id, budget, row_price, status")
    .eq("id", candidate.round_id)
    .single();
  if (roundError) throw roundError;

  const { data: existingSystem } = await db
    .from("systems")
    .select("id")
    .eq("round_id", candidate.round_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let systemId = existingSystem?.id as string | undefined;
  if (!systemId) {
    const { data: sys, error: sysError } = await db
      .from("systems")
      .insert({ round_id: candidate.round_id, name: "Huvudsystem", created_by: userId })
      .select("id")
      .single();
    if (sysError) throw sysError;
    systemId = sys.id;
  }

  const { data: versions } = await db
    .from("system_versions")
    .select("version_number")
    .eq("system_id", systemId)
    .order("version_number", { ascending: false })
    .limit(1);
  const nextNumber = (versions?.[0]?.version_number ?? 0) + 1;

  const { data: version, error: versionError } = await db
    .from("system_versions")
    .insert({
      system_id: systemId,
      version_number: nextNumber,
      budget: Number(round.budget),
      row_price: Number(round.row_price),
      change_reason: `Automatiskt förslag: ${candidate.title}`,
    })
    .select("id")
    .single();
  if (versionError) throw versionError;

  const selections: any[] = [];
  for (const leg of (candidate.selections as any[]) ?? []) {
    for (const entryId of leg.entry_ids ?? []) {
      selections.push({
        system_version_id: version.id,
        race_id: leg.race_id,
        race_entry_id: entryId,
      });
    }
  }
  if (selections.length > 0) {
    const { error: selError } = await db.from("system_selections").insert(selections);
    if (selError) throw selError;
  }

  await db
    .from("system_candidates")
    .update({ selected: false })
    .eq("round_id", candidate.round_id);
  await db.from("system_candidates").update({ selected: true }).eq("id", candidateId);

  if (
    ["draft", "individual_analysis", "analyses_revealed", "group_assessment"].includes(
      round.status,
    )
  ) {
    await db.from("rounds").update({ status: "system_building" }).eq("id", candidate.round_id);
  }

  await db.from("activity_log").insert({
    group_id: round.group_id,
    round_id: candidate.round_id,
    user_id: userId,
    event_type: "system_candidate_applied",
    description: `Systemförslaget "${candidate.title}" lades in som version ${nextNumber}. Inget är låst.`,
  });

  return { systemVersionId: version.id, versionNumber: nextNumber };
}
