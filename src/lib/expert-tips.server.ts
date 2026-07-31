/**
 * Experttips: hämtar tips och analyser från svenska travsajter och bloggar,
 * och låter AI sammanfatta dem tydligt på vardagssvenska.
 * Endast serverkod. Producerar alltid underlag – aldrig beslut.
 */

const MODEL = "openai/gpt-5.6-sol";
const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

export type ExpertSource = { title: string; url: string };

type FirecrawlResult = { title?: string; url?: string; markdown?: string; description?: string };

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function firecrawlHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.FIRECRAWL_API_KEY;
  if (!lovableKey) throw new Error("AI-nyckeln saknas.");
  if (!connectionKey) throw new Error("Kopplingen till webbsökningen saknas.");
  return {
    "content-type": "application/json",
    authorization: `Bearer ${lovableKey}`,
    "x-connection-api-key": connectionKey,
  };
}

/** Söker efter experttips på svenska travsajter och bloggar. */
async function searchTips(query: string, limit: number): Promise<FirecrawlResult[]> {
  const res = await fetch(`${GATEWAY}/search`, {
    method: "POST",
    headers: firecrawlHeaders(),
    body: JSON.stringify({
      query,
      limit,
      lang: "sv",
      country: "se",
      tbs: "qdr:w",
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Firecrawl-sökning misslyckades [${res.status}]: ${body}`);
    throw new Error(`Webbsökningen svarade med fel (${res.status}).`);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("Webbsökningen gav ett svar som inte kunde tolkas.");
  }
  const items: FirecrawlResult[] = parsed?.data?.web ?? parsed?.data ?? [];
  return Array.isArray(items) ? items : [];
}

function clip(text: string, max = 6000) {
  return text.length > max ? `${text.slice(0, max)}\n…` : text;
}

async function askModel(prompt: string): Promise<any> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI-nyckeln saknas.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Du sammanfattar svenska travexperters V85-tips för tre äldre familjemedlemmar. " +
            "Skriv enkel svensk vardagssvenska, korta meningar, inga engelska ord och ingen jargong. " +
            "Hitta aldrig på hästnamn eller citat som inte finns i underlaget. Svara enbart med giltig JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (res.status === 429) throw new Error("AI-tjänsten är upptagen just nu. Försök igen om en stund.");
  if (res.status === 402) throw new Error("AI-krediterna är slut. Fyll på i inställningarna för arbetsytan.");
  if (!res.ok) {
    const text = await res.text();
    console.error(`AI-sammanfattning misslyckades [${res.status}]: ${text}`);
    throw new Error("AI-sammanfattningen misslyckades.");
  }
  const json: any = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI-svaret kunde inte tolkas.");
  }
}

const SITE_QUERIES = (track: string, dateLabel: string) => [
  `V85 tips ${track} ${dateLabel} site:travronden.se`,
  `V85 tips ${track} ${dateLabel} site:atg.se`,
  `V85 spiktips ${track} ${dateLabel} travblogg`,
  `V85 andelstips analys ${track} ${dateLabel}`,
];

/**
 * Samlar in och sammanfattar experttips för en omgång.
 * Sparar en rapport per grupp och speldag.
 */
export async function collectExpertTips(params: {
  groupId: string;
  roundId?: string | null;
  raceDate: string;
  trackName?: string | null;
  userId?: string | null;
}) {
  const admin = await getAdmin();
  const track = params.trackName ?? "";
  const dateLabel = new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeZone: "Europe/Stockholm",
  }).format(new Date(`${params.raceDate}T12:00:00Z`));

  const seen = new Set<string>();
  const collected: FirecrawlResult[] = [];
  for (const query of SITE_QUERIES(track, dateLabel)) {
    try {
      const hits = await searchTips(query, 4);
      for (const hit of hits) {
        const url = hit.url ?? "";
        if (!url || seen.has(url)) continue;
        seen.add(url);
        collected.push(hit);
      }
    } catch (error: any) {
      console.error("Sökning misslyckades:", query, error?.message ?? error);
    }
  }

  if (collected.length === 0) {
    throw new Error("Hittade inga experttips den här veckan. Försök igen närmare speldagen.");
  }

  const sources: ExpertSource[] = collected.map((c) => ({
    title: c.title ?? c.url ?? "Källa",
    url: c.url ?? "",
  }));

  const corpus = collected
    .map(
      (c, i) =>
        `### Källa ${i + 1}: ${c.title ?? "okänd"}\nURL: ${c.url ?? ""}\n${clip(
          c.markdown ?? c.description ?? "",
        )}`,
    )
    .join("\n\n");

  const prompt = `Nedan finns texter från svenska travsajter och travbloggar inför V85 ${dateLabel}${
    track ? ` på ${track}` : ""
  }.

Sammanfatta vad experterna tycker. Svara med JSON i exakt denna form:
{
  "summary": "5-8 meningar som förklarar veckans läge i enkel svenska",
  "trends": [{ "title": "kort rubrik", "text": "vad experterna resonerar lika eller olika kring" }],
  "consensus": [{ "leg": 1, "horse": "hästnamn", "note": "varför många tipsar den" }],
  "disagreements": [{ "leg": 1, "horse": "hästnamn", "note": "varför experterna är oense" }],
  "legs": [{ "leg": 1, "text": "kort sammanfattning av avdelningen" }]
}

Regler:
- Använd bara hästar och resonemang som finns i texterna.
- Om avdelningsnummer saknas, sätt leg till 0.
- Max 6 trender, max 8 hästar i varje lista, max 8 avdelningar.
- Skriv aldrig att något är en rekommendation – det här är bara vad andra tycker.

TEXTER:
${clip(corpus, 60000)}`;

  const result = await askModel(prompt);

  const row = {
    group_id: params.groupId,
    round_id: params.roundId ?? null,
    race_date: params.raceDate,
    track_name: params.trackName ?? null,
    status: "ready",
    summary: typeof result?.summary === "string" ? result.summary : null,
    trends: Array.isArray(result?.trends) ? result.trends.slice(0, 6) : [],
    consensus: Array.isArray(result?.consensus) ? result.consensus.slice(0, 8) : [],
    disagreements: Array.isArray(result?.disagreements) ? result.disagreements.slice(0, 8) : [],
    legs: Array.isArray(result?.legs) ? result.legs.slice(0, 8) : [],
    sources,
    model_used: MODEL,
    error_message: null,
    created_by: params.userId ?? null,
  };

  const { data, error } = await admin
    .from("expert_tips_reports")
    .upsert(row, { onConflict: "group_id,race_date" })
    .select("id")
    .maybeSingle();
  if (error) throw error;

  return { id: data?.id as string | undefined, sources: sources.length };
}

/** Torsdagsjobbet: samlar experttips för varje grupps närmaste omgång. */
export async function collectExpertTipsForAllGroups() {
  const admin = await getAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rounds, error } = await admin
    .from("rounds")
    .select("id, group_id, race_date, is_demo, tracks(name)")
    .gte("race_date", today)
    .eq("is_demo", false)
    .order("race_date", { ascending: true });
  if (error) throw error;

  const perGroup = new Map<string, any>();
  for (const round of rounds ?? []) {
    if (!perGroup.has(round.group_id)) perGroup.set(round.group_id, round);
  }

  const results: Array<{ groupId: string; ok: boolean; message?: string }> = [];
  for (const [groupId, round] of perGroup) {
    try {
      await collectExpertTips({
        groupId,
        roundId: round.id,
        raceDate: round.race_date,
        trackName: round.tracks?.name ?? null,
      });
      results.push({ groupId, ok: true });
    } catch (e: any) {
      console.error("Experttips misslyckades för grupp", groupId, e?.message ?? e);
      results.push({ groupId, ok: false, message: e?.message ?? String(e) });
    }
  }
  return results;
}
