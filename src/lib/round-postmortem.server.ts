/**
 * Efteranalys per omgång ("spel"): jämför gruppens inlämnade system med de
 * verkliga vinnarna och skapar en sparad efteranalys. Endast serverkod.
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

export type LegOutcome = {
  leg: number;
  winner: string | null;
  winnerStartNumber: number | null;
  winnerMarketPercent: number | null;
  winnerGroupProbability: number | null;
  played: string[];
  playedCount: number;
  wasSpike: boolean;
  hit: boolean | null;
};

export type RoundOutcome = {
  roundId: string;
  raceDate: string | null;
  trackName: string | null;
  cost: number | null;
  winnings: number | null;
  net: number | null;
  rows: number | null;
  correctLegs: number;
  decidedLegs: number;
  legs: LegOutcome[];
};

/** Samlar ihop allt som behövs för att utvärdera en spelad omgång. */
export async function collectRoundOutcome(roundId: string): Promise<RoundOutcome> {
  const admin = await getAdmin();

  const { data: round, error: roundError } = await admin
    .from("rounds")
    .select("id, race_date, group_id, tracks(name), round_results(group_winnings)")
    .eq("id", roundId)
    .maybeSingle();
  if (roundError) throw roundError;
  if (!round) throw new Error("Omgången hittades inte.");

  const { data: races, error: racesError } = await admin
    .from("races")
    .select(
      `id, leg_number,
       race_results(winner_entry_id),
       race_entries(id, start_number, horses(name), market_snapshots(bet_share_percent, captured_at)),
       group_race_assessments(group_entry_assessments(race_entry_id, group_win_probability))`,
    )
    .eq("round_id", roundId)
    .order("leg_number", { ascending: true });
  if (racesError) throw racesError;

  const { data: systems } = await admin
    .from("systems")
    .select("id, system_versions(id, calculated_rows, calculated_cost, locked_at, created_at, system_selections(race_id, race_entry_id))")
    .eq("round_id", roundId);

  const versions = (systems ?? []).flatMap((s: any) => s.system_versions ?? []);
  const chosen =
    versions
      .filter((v: any) => v.locked_at)
      .sort((a: any, b: any) => String(b.locked_at).localeCompare(String(a.locked_at)))[0] ??
    versions.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ??
    null;

  const selections: any[] = chosen?.system_selections ?? [];

  const legs: LegOutcome[] = (races ?? []).map((race: any) => {
    const entries: any[] = race.race_entries ?? [];
    const byId = new Map(entries.map((e: any) => [e.id, e]));
    const winnerId = (Array.isArray(race.race_results) ? race.race_results[0] : race.race_results)
      ?.winner_entry_id ?? null;
    const winnerEntry = winnerId ? byId.get(winnerId) : null;

    const groupProbs = new Map<string, number | null>();
    for (const gra of race.group_race_assessments ?? []) {
      for (const gea of gra.group_entry_assessments ?? []) {
        groupProbs.set(gea.race_entry_id, num(gea.group_win_probability));
      }
    }

    const legSelections = selections.filter((s) => s.race_id === race.id);
    const played = legSelections
      .map((s) => {
        const e = byId.get(s.race_entry_id);
        return e ? `${e.start_number} ${e.horses?.name ?? "okänd häst"}` : null;
      })
      .filter(Boolean) as string[];

    return {
      leg: race.leg_number,
      winner: winnerEntry ? (winnerEntry.horses?.name ?? "okänd häst") : null,
      winnerStartNumber: winnerEntry?.start_number ?? null,
      winnerMarketPercent: winnerEntry ? latestShare(winnerEntry) : null,
      winnerGroupProbability: winnerId ? (groupProbs.get(winnerId) ?? null) : null,
      played,
      playedCount: legSelections.length,
      wasSpike: legSelections.length === 1,
      hit: winnerId ? legSelections.some((s) => s.race_entry_id === winnerId) : null,
    };
  });

  const decidedLegs = legs.filter((l) => l.hit !== null).length;
  const correctLegs = legs.filter((l) => l.hit === true).length;
  const cost = num(chosen?.calculated_cost);
  const rr = Array.isArray(round.round_results) ? round.round_results[0] : round.round_results;
  const winnings = num(rr?.group_winnings);

  return {
    roundId,
    raceDate: round.race_date ?? null,
    trackName: round.tracks?.name ?? null,
    cost,
    winnings,
    net: cost !== null && winnings !== null ? winnings - cost : null,
    rows: num(chosen?.calculated_rows),
    correctLegs,
    decidedLegs,
    legs,
  };
}

async function askModel(prompt: string) {
  const key = process.env['LOVABLE_API_KEY'];
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
            "Du är en lugn svensk travcoach som skriver till tre äldre privatspelare. Vardagligt svenskt " +
            "språk, inga engelska ord, inga facktermer. Du skiljer tydligt på otur och dåliga beslut och " +
            "hittar aldrig på fakta. Svara ENDAST med giltig JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "efteranalys",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "summary",
              "strengths",
              "three_main_errors",
              "good_decisions_despite_loss",
              "bad_decisions_despite_win",
              "max_three_changes_to_test",
              "do_not_change_yet",
            ],
            properties: {
              summary: { type: "string" },
              strengths: { type: "string" },
              three_main_errors: { type: "string" },
              good_decisions_despite_loss: { type: "string" },
              bad_decisions_despite_win: { type: "string" },
              max_three_changes_to_test: { type: "string" },
              do_not_change_yet: { type: "string" },
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
  return JSON.parse(content) as Record<string, string>;
}

/** Begär en efteranalys för en omgång och sparar den på omgången. */
export async function generateRoundPostmortem(roundId: string) {
  const admin = await getAdmin();
  const outcome = await collectRoundOutcome(roundId);

  if (outcome.decidedLegs === 0) {
    throw new Error(
      "Det finns inga registrerade vinnare för den här omgången ännu. Hämta resultatet först.",
    );
  }

  const { historyContextForGroup } = await import("@/lib/history-stats.server");
  const { data: round } = await admin.from("rounds").select("group_id").eq("id", roundId).maybeSingle();
  const historyText = round?.group_id ? await historyContextForGroup(round.group_id) : "";

  const prompt = [
    historyText ? `Gruppens spelhistorik (bakgrund):\n${historyText}\n` : "",
    `Omgång: ${outcome.raceDate ?? "okänt datum"} på ${outcome.trackName ?? "okänd bana"}.`,
    `Kostnad ${outcome.cost ?? "okänd"} kr, utdelning ${outcome.winnings ?? 0} kr, ${outcome.rows ?? "okänt"} rader.`,
    `Rätt avdelningar: ${outcome.correctLegs} av ${outcome.decidedLegs}.`,
    "",
    "Avdelning för avdelning (vad ni spelade, vem som vann, vinnarens streckprocent och er bedömda vinstchans):",
    JSON.stringify(outcome.legs),
    "",
    "Skriv sju korta stycken på svenska:",
    "1. summary: vad som hände i omgången och hur spelet fungerade, i klartext.",
    "2. strengths: vad ni gjorde bra.",
    "3. three_main_errors: de tre viktigaste felen, om de finns. Skyll inte på otur.",
    "4. good_decisions_despite_loss: beslut som var kloka trots att de inte gav rätt.",
    "5. bad_decisions_despite_win: beslut som var svaga trots att de råkade bli rätt.",
    "6. max_three_changes_to_test: högst tre konkreta förändringar att testa nästa omgång.",
    "7. do_not_change_yet: vad ni inte ska ändra på ännu, eftersom en enda omgång inte är bevis.",
    "Varje stycke högst 80 ord. Enkla ord.",
  ].join("\n");

  const text = await askModel(prompt);

  const payload = {
    round_id: roundId,
    ai_draft: text['summary'] ?? null,
    strengths: text['strengths'] ?? null,
    three_main_errors: text['three_main_errors'] ?? null,
    good_decisions_despite_loss: text['good_decisions_despite_loss'] ?? null,
    bad_decisions_despite_win: text['bad_decisions_despite_win'] ?? null,
    max_three_changes_to_test: text['max_three_changes_to_test'] ?? null,
    do_not_change_yet: text['do_not_change_yet'] ?? null,
    ai_generated_at: new Date().toISOString(),
    ai_model: MODEL,
    ai_stats: outcome as any,
  };

  const { data: saved, error } = await admin
    .from("round_postmortems")
    .upsert(payload, { onConflict: "round_id" })
    .select()
    .single();
  if (error) throw error;

  await admin.from("activity_log").insert({
    group_id: round?.group_id ?? null,
    round_id: roundId,
    event_type: "round_postmortem_generated",
    description: `Efteranalys skapad: ${outcome.correctLegs} av ${outcome.decidedLegs} rätt.`,
  });

  return { postmortem: saved, outcome };
}
