/**
 * AI-utkast för gruppens bedömning av varje avdelning.
 * Utkast – aldrig låsning. Endast serverkod.
 */

const MODEL = "google/gemini-2.5-flash";
const PROMPT_VERSION = "grupputkast-1";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

type DraftEntry = {
  start_number: number;
  probability: number;
  tier: "A" | "B" | "C" | "D";
  comment: string;
};

type DraftRace = {
  pace_scenario: string;
  notes: string;
  entries: DraftEntry[];
};

function latestShare(entry: any): number | null {
  const snaps = [...(entry.market_snapshots ?? [])].sort((a: any, b: any) =>
    String(b.captured_at).localeCompare(String(a.captured_at)),
  );
  const v = snaps[0]?.bet_share_percent;
  return typeof v === "number" ? v : v ? Number(v) : null;
}

function normalize(entries: DraftEntry[]): DraftEntry[] {
  const total = entries.reduce((a, e) => a + (Number(e.probability) || 0), 0);
  if (total <= 0) {
    const even = Math.round((100 / entries.length) * 100) / 100;
    return entries.map((e) => ({ ...e, probability: even }));
  }
  const scaled = entries.map((e) => ({
    ...e,
    probability: Math.round(((Number(e.probability) || 0) / total) * 10000) / 100,
  }));
  const diff = Math.round((100 - scaled.reduce((a, e) => a + e.probability, 0)) * 100) / 100;
  if (scaled.length > 0) {
    scaled[0].probability = Math.round((scaled[0].probability + diff) * 100) / 100;
  }
  return scaled;
}

async function askModel(prompt: string): Promise<DraftRace> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI-nyckeln saknas.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du är en erfaren svensk travanalytiker. Du bedömer hästars vinstchans sakligt, " +
            "skiljer prestationsbedömning från spelmarknadens streckning och skriver kort på svenska. " +
            "Svara ENDAST med giltig JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "avdelning",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["pace_scenario", "notes", "entries"],
            properties: {
              pace_scenario: { type: "string" },
              notes: { type: "string" },
              entries: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["start_number", "probability", "tier", "comment"],
                  properties: {
                    start_number: { type: "number" },
                    probability: { type: "number" },
                    tier: { type: "string", enum: ["A", "B", "C", "D"] },
                    comment: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (res.status === 429) throw new Error("AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund.");
  if (res.status === 402) throw new Error("AI-krediterna är slut.");
  if (!res.ok) throw new Error(`AI-tjänsten svarade ${res.status}.`);

  const json: any = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content) as DraftRace;
}

/** Skapar eller uppdaterar gruppbedömningens utkast för alla olåsta avdelningar. */
export async function generateAiDraftForRound(roundId: string, userId: string) {
  const db = await getAdmin();

  const { data: round, error: roundError } = await db
    .from("rounds")
    .select("id, group_id, race_date")
    .eq("id", roundId)
    .single();
  if (roundError) throw roundError;

  const { data: races, error: racesError } = await db
    .from("races")
    .select(
      `id, leg_number, distance_m, start_method,
       race_entries(id, start_number, post_position, base_distance_m, age, sex, earnings, scratched,
         horses:horse_id(name), drivers:driver_id(name), trainers:trainer_id(name),
         market_snapshots(bet_share_percent, captured_at)),
       group_race_assessments(id, status)`,
    )
    .eq("round_id", roundId)
    .order("leg_number", { ascending: true });
  if (racesError) throw racesError;

  const failures: string[] = [];

  async function processRace(race: any): Promise<boolean> {
    const assessment = race.group_race_assessments?.[0];
    if (assessment?.status === "locked") return false;


    const entries = (race.race_entries ?? []).filter((e: any) => !e.scratched);
    if (entries.length === 0) return false;

    const lines = entries
      .slice()
      .sort((a: any, b: any) => a.start_number - b.start_number)
      .map((e: any) => {
        const share = latestShare(e);
        return `${e.start_number}. ${e.horses?.name ?? "?"} — kusk ${
          e.drivers?.name ?? "okänd"
        }, tränare ${e.trainers?.name ?? "okänd"}, spår ${e.post_position ?? "?"}, distans ${
          e.base_distance_m ?? race.distance_m ?? "?"
        } m, ${e.age ?? "?"} år ${e.sex ?? ""}, insprunget ${e.earnings ?? "?"} kr, ATG-streck ${
          share ?? "?"
        } %`;
      })
      .join("\n");

    const prompt = `V85 avdelning ${race.leg_number}, ${round.race_date}. Startsätt: ${
      race.start_method === "volt" ? "volt" : "auto"
    }, distans ${race.distance_m ?? "okänd"} m.

Startfält:
${lines}

Uppgift:
1. Bedöm varje ostruken hästs vinstchans i procent. Summan ska bli 100.
2. Sätt nivå: A = huvudchans, B = utmanare, C = skräll, D = liten chans.
3. Skriv en mening per häst om varför.
4. Beskriv troligt tempo-/loppupplägg och en kort sammanfattning.
Låt inte streckprocenten styra – motivera avvikelser mot marknaden.`;

    const draft = await askModel(prompt);
    const byNumber = new Map<number, any>(entries.map((e: any) => [e.start_number, e]));
    const valid = (draft.entries ?? []).filter((d) => byNumber.has(Number(d.start_number)));
    if (valid.length === 0) return false;
    const normalized = normalize(valid);

    let assessmentId = assessment?.id as string | undefined;
    if (!assessmentId) {
      // Kan finnas sedan tidigare även om inbäddningen inte gav något träff.
      const { data: found } = await db
        .from("group_race_assessments")
        .select("id, status")
        .eq("race_id", race.id)
        .maybeSingle();
      if (found?.status === "locked") return false;
      assessmentId = found?.id as string | undefined;
    }

    if (assessmentId) {
      await db
        .from("group_race_assessments")
        .update({ pace_scenario: draft.pace_scenario ?? null, notes: draft.notes ?? null })
        .eq("id", assessmentId);
    } else {
      const { data: inserted, error } = await db
        .from("group_race_assessments")
        .upsert(
          {
            race_id: race.id,
            status: "draft",
            pace_scenario: draft.pace_scenario ?? null,
            notes: draft.notes ?? null,
          },
          { onConflict: "race_id" },
        )
        .select("id")
        .single();
      if (error) throw error;
      assessmentId = inserted.id;
    }


    const { data: existingEntries } = await db
      .from("group_entry_assessments")
      .select("id, race_entry_id")
      .eq("group_race_assessment_id", assessmentId);
    const existingByEntry = new Map<string, string>(
      (existingEntries ?? []).map((e: any) => [e.race_entry_id, e.id]),
    );

    const ranked = [...normalized].sort((a, b) => b.probability - a.probability);
    for (let i = 0; i < ranked.length; i++) {
      const d = ranked[i];
      const entry = byNumber.get(Number(d.start_number));
      const payload = {
        group_race_assessment_id: assessmentId,
        race_entry_id: entry.id,
        final_rank: i + 1,
        tier: (["A", "B", "C", "D"].includes(d.tier) ? d.tier : "C") as string,
        group_win_probability: d.probability,
        value_comment: d.comment ?? null,
      };
      const existingId = existingByEntry.get(entry.id);
      if (existingId) {
        await db.from("group_entry_assessments").update(payload).eq("id", existingId);
      } else {
        await db.from("group_entry_assessments").insert(payload);
      }
    }

    await db.from("ai_analysis_runs").insert({
      group_id: round.group_id,
      round_id: roundId,
      race_id: race.id,
      run_type: "group_draft",
      prompt_version: PROMPT_VERSION,
      response: JSON.stringify(draft),
      approved: false,
      created_by: userId,
    });

    updated++;
  }

  await db.from("activity_log").insert({
    group_id: round.group_id,
    round_id: roundId,
    user_id: userId,
    event_type: "ai_draft_generated",
    description: `AI-utkast skapade för ${updated} avdelning(ar). Utkast – inget är låst.`,
  });

  return { races: updated };
}
