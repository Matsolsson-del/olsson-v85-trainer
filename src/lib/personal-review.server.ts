/**
 * Personlig efterhandsanalys: jämför en spelares egna bedömningar med
 * verkliga resultat och skapar personliga råd. Endast serverkod.
 */

const MODEL = "openai/gpt-5.6-sol";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function latestShare(entry: any): number | null {
  const snaps = [...(entry?.market_snapshots ?? [])].sort((a: any, b: any) =>
    String(b.captured_at).localeCompare(String(a.captured_at)),
  );
  return num(snaps[0]?.bet_share_percent);
}

export type PersonalStats = {
  rounds: number;
  races: number;
  topPickWins: number;
  topPickHitRate: number | null;
  avgProbabilityOnWinner: number | null;
  avgProbabilityOnTopPick: number | null;
  mustIncludeCount: number;
  mustIncludeWins: number;
  excludedWinners: number;
  favouriteLean: number | null; // >0 = tror mer på storfavoriter än marknaden
  longshotLean: number | null;
  avgConfidence: number | null;
  missedWinnerAvgMarket: number | null;
};

type RaceLine = {
  date: string;
  leg: number;
  winner: string | null;
  winnerMarket: number | null;
  myTop: string | null;
  myTopProb: number | null;
  myWinnerProb: number | null;
  myWinnerTier: string | null;
  excludedWinner: boolean;
  hit: boolean;
};

export async function collectPersonalData(groupId: string, userId: string) {
  const admin = await getAdmin();

  const { data: assessments, error } = await admin
    .from("individual_race_assessments")
    .select(
      `id, confidence, overall_notes, race_id,
       races!inner(id, leg_number, round_id, rounds!inner(id, group_id, race_date)),
       individual_entry_assessments(rank_position, tier, estimated_win_probability, include_preference, reasoning,
         race_entries(id, start_number, horses(name), market_snapshots(bet_share_percent, captured_at)))`,
    )
    .eq("user_id", userId)
    .eq("races.rounds.group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw error;

  const raceIds = (assessments ?? []).map((a: any) => a.race_id);
  if (raceIds.length === 0) return { lines: [] as RaceLine[], stats: emptyStats(), roundIds: [] as string[] };

  const { data: results } = await admin
    .from("race_results")
    .select("race_id, winner_entry_id")
    .in("race_id", raceIds);

  const winnerByRace = new Map<string, string>();
  for (const r of results ?? []) if (r.winner_entry_id) winnerByRace.set(r.race_id, r.winner_entry_id);

  const lines: RaceLine[] = [];
  const roundIds = new Set<string>();
  let favSum = 0;
  let favCount = 0;
  let longSum = 0;
  let longCount = 0;
  const confidences: number[] = [];
  const winnerProbs: number[] = [];
  const topProbs: number[] = [];
  const missedMarkets: number[] = [];
  let topPickWins = 0;
  let mustIncludeCount = 0;
  let mustIncludeWins = 0;
  let excludedWinners = 0;

  for (const a of assessments ?? []) {
    const winnerEntryId = winnerByRace.get(a.race_id);
    if (!winnerEntryId) continue;

    const race = a.races;
    const round = race?.rounds;
    roundIds.add(race?.round_id);

    const entries = a.individual_entry_assessments ?? [];
    const ranked = [...entries].sort(
      (x: any, y: any) => (x.rank_position ?? 99) - (y.rank_position ?? 99),
    );
    const top = ranked[0];
    const winner = entries.find((e: any) => e.race_entries?.id === winnerEntryId);
    const hit = top?.race_entries?.id === winnerEntryId;
    if (hit) topPickWins++;

    for (const e of entries) {
      const p = num(e.estimated_win_probability);
      const m = latestShare(e.race_entries);
      if (p === null || m === null) continue;
      if (m >= 25) {
        favSum += p - m;
        favCount++;
      }
      if (m <= 8) {
        longSum += p - m;
        longCount++;
      }
      if (e.include_preference === "must_include") {
        mustIncludeCount++;
        if (e.race_entries?.id === winnerEntryId) mustIncludeWins++;
      }
      if (e.include_preference === "exclude" && e.race_entries?.id === winnerEntryId) {
        excludedWinners++;
      }
    }

    const c = num(a.confidence);
    if (c !== null) confidences.push(c);
    const wp = num(winner?.estimated_win_probability);
    if (wp !== null) winnerProbs.push(wp);
    const tp = num(top?.estimated_win_probability);
    if (tp !== null) topProbs.push(tp);
    const wm = latestShare(winner?.race_entries);
    if (!hit && wm !== null) missedMarkets.push(wm);

    lines.push({
      date: round?.race_date ?? "",
      leg: race?.leg_number ?? 0,
      winner: winner?.race_entries?.horses?.name ?? null,
      winnerMarket: wm,
      myTop: top?.race_entries?.horses?.name ?? null,
      myTopProb: tp,
      myWinnerProb: wp,
      myWinnerTier: winner?.tier ?? null,
      excludedWinner: winner?.include_preference === "exclude",
      hit,
    });
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  const stats: PersonalStats = {
    rounds: roundIds.size,
    races: lines.length,
    topPickWins,
    topPickHitRate: lines.length ? Math.round((topPickWins / lines.length) * 1000) / 10 : null,
    avgProbabilityOnWinner: avg(winnerProbs),
    avgProbabilityOnTopPick: avg(topProbs),
    mustIncludeCount,
    mustIncludeWins,
    excludedWinners,
    favouriteLean: favCount ? Math.round((favSum / favCount) * 10) / 10 : null,
    longshotLean: longCount ? Math.round((longSum / longCount) * 10) / 10 : null,
    avgConfidence: avg(confidences),
    missedWinnerAvgMarket: avg(missedMarkets),
  };

  return { lines, stats, roundIds: [...roundIds] };
}

function emptyStats(): PersonalStats {
  return {
    rounds: 0,
    races: 0,
    topPickWins: 0,
    topPickHitRate: null,
    avgProbabilityOnWinner: null,
    avgProbabilityOnTopPick: null,
    mustIncludeCount: 0,
    mustIncludeWins: 0,
    excludedWinners: 0,
    favouriteLean: null,
    longshotLean: null,
    avgConfidence: null,
    missedWinnerAvgMarket: null,
  };
}

async function askModel(prompt: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI-nyckeln saknas.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "none",
      messages: [
        {
          role: "system",
          content:
            "Du är en lugn och vänlig svensk travcoach. Du skriver till en äldre privatspelare i vardagligt " +
            "svenskt språk, utan engelska ord och utan facktermer. Du är konkret, snäll och ärlig, och skiljer " +
            "på tur och beslutskvalitet. Svara ENDAST med giltig JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "personliga_rad",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "strengths", "improvements", "next_focus"],
            properties: {
              summary: { type: "string" },
              strengths: { type: "string" },
              improvements: { type: "string" },
              next_focus: { type: "string" },
            },
          },
        },
      },
    }),
  });

  if (res.status === 429) throw new Error("AI-tjänsten är upptagen just nu. Försök igen om en stund.");
  if (res.status === 402) throw new Error("AI-krediterna är slut. Fyll på i inställningarna för arbetsytan.");
  if (!res.ok) throw new Error("AI-tjänsten svarade inte (" + res.status + ").");

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI-svaret var tomt.");
  return JSON.parse(content) as {
    summary: string;
    strengths: string;
    improvements: string;
    next_focus: string;
  };
}

/** Skapar personliga rekommendationer för en spelare baserat på tidigare omgångar. */
export async function generatePersonalReview(groupId: string, userId: string, displayName: string) {
  const admin = await getAdmin();
  const { lines, stats } = await collectPersonalData(groupId, userId);

  if (lines.length < 3) {
    throw new Error(
      "Det finns för lite att lära av ännu – du behöver ha gjort egna bedömningar i minst tre lopp som är avgjorda.",
    );
  }

  const recent = lines.slice(0, 40);
  const prompt = [
    `Spelare: ${displayName}.`,
    `Sammanställning över ${stats.races} avgjorda lopp i ${stats.rounds} omgångar:`,
    JSON.stringify(stats),
    "",
    "Lopp för lopp (mitt förstaval, vinnaren, min sannolikhet på vinnaren, marknadens procent):",
    JSON.stringify(recent),
    "",
    "Skriv fyra korta stycken på svenska:",
    "1. summary: vad statistiken säger om hur den här personen bedömer lopp.",
    "2. strengths: två till tre saker personen gör bra, med siffror som stöd.",
    "3. improvements: två till tre konkreta svagheter eller mönster, utan att skylla på otur.",
    "4. next_focus: en enda sak att fokusera på nästa omgång, formulerad som en enkel regel att följa.",
    "Varje stycke högst 90 ord. Enkla ord, ingen jargong.",
  ].join("\n");

  const advice = await askModel(prompt);

  const { data, error } = await admin
    .from("personal_recommendations")
    .insert({
      group_id: groupId,
      user_id: userId,
      rounds_analyzed: stats.rounds,
      stats,
      summary: advice.summary,
      strengths: advice.strengths,
      improvements: advice.improvements,
      next_focus: advice.next_focus,
      model_used: MODEL,
    })
    .select()
    .single();
  if (error) throw error;

  return data;
}
