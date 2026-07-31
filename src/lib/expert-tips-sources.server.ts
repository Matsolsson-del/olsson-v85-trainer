/**
 * Expertkällor: en adapter per källa så att en förändring hos en webbplats
 * aldrig slår ut hela importen.
 *
 * Vi hämtar bara via Firecrawl (som följer robots.txt och webbplatsernas
 * tekniska åtkomstregler) och sparar strukturerade tips, korta sammanfattningar
 * och länkar till originalet. Hela artiklar kopieras aldrig.
 * Endast serverkod.
 */
import type { SourceStatus, TipRecord } from "./automation-core";

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const MODEL = "openai/gpt-5.6-sol";
/** Högst så här många källanrop samtidigt. */
export const MAX_PARALLEL_SOURCES = 2;
const REQUEST_TIMEOUT_MS = 45_000;

export type SourceDefinition = {
  key: string;
  name: string;
  domain: string | null;
  /** search = sökmotorträffar hos källan, blocked = får inte hämtas automatiskt */
  kind: "search" | "blocked";
  enabled: boolean;
  accessNote: string;
  query?: (track: string, dateLabel: string) => string;
};

/**
 * Källregistret. Ändras bara här.
 * Källor med kind "blocked" hämtas aldrig automatiskt – de redovisas öppet
 * i automationsvyn med orsaken i stället för att döljas.
 */
export const SOURCE_REGISTRY: SourceDefinition[] = [
  {
    key: "travronden",
    name: "Travronden",
    domain: "travronden.se",
    kind: "search",
    enabled: true,
    accessNote: "Öppet publicerade tipsartiklar. Endast sammanfattning och länk sparas.",
    query: (track, date) => `V85 tips ${track} ${date} site:travronden.se`,
  },
  {
    key: "atg-tipset",
    name: "ATG Tipset",
    domain: "atg.se",
    kind: "search",
    enabled: true,
    accessNote: "ATG:s egna tipssidor. Endast sammanfattning och länk sparas.",
    query: (track, date) => `V85 tips ${track} ${date} site:atg.se`,
  },
  {
    key: "sportbladet-trav",
    name: "Sportbladet Trav",
    domain: "aftonbladet.se",
    kind: "search",
    enabled: true,
    accessNote: "Öppna travartiklar. Låst material hämtas inte.",
    query: (track, date) => `V85 tips ${track} ${date} site:aftonbladet.se trav`,
  },
  {
    key: "travnytt",
    name: "Travnytt",
    domain: "travnytt.se",
    kind: "search",
    enabled: true,
    accessNote: "Öppet publicerade tips och analyser.",
    query: (track, date) => `V85 spiktips ${track} ${date} site:travnytt.se`,
  },
  {
    key: "jarvsotravet-bloggar",
    name: "Travbloggar",
    domain: null,
    kind: "search",
    enabled: true,
    accessNote: "Öppna travbloggar med publicerade V85-tips.",
    query: (track, date) => `V85 tips analys ${track} ${date} travblogg`,
  },
  {
    key: "andelstips",
    name: "Andelsspelens tips",
    domain: null,
    kind: "search",
    enabled: true,
    accessNote: "Öppna sammanfattningar av andelsspelens V85-tips.",
    query: (track, date) => `V85 andelstips systemförslag ${track} ${date}`,
  },
  {
    key: "travronden-plus",
    name: "Travronden Plus (betalvägg)",
    domain: "travronden.se",
    kind: "blocked",
    enabled: false,
    accessNote:
      "Materialet ligger bakom betalvägg. Får inte hämtas automatiskt och kringgås inte.",
  },
  {
    key: "facebook-grupper",
    name: "Slutna Facebook-grupper",
    domain: "facebook.com",
    kind: "blocked",
    enabled: false,
    accessNote: "Kräver inloggning och tillåter inte automatisk hämtning.",
  },
];

export type SourceFetchResult = {
  key: string;
  name: string;
  status: SourceStatus;
  message: string | null;
  tips: TipRecord[];
  articles: { title: string; url: string; publishedAt: string | null }[];
};

function firecrawlHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.FIRECRAWL_API_KEY;
  if (!lovableKey) throw new Error("missing_ai_key");
  if (!connectionKey) throw new Error("missing_firecrawl");
  return {
    "content-type": "application/json",
    authorization: `Bearer ${lovableKey}`,
    "x-connection-api-key": connectionKey,
  };
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Enkel sanering: importerat innehåll får aldrig innehålla kod eller taggar. */
export function sanitizeText(value: unknown, max = 600): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function searchSource(query: string, limit = 3): Promise<any[]> {
  const res = await withTimeout((signal) =>
    fetch(`${GATEWAY}/search`, {
      method: "POST",
      signal,
      headers: firecrawlHeaders(),
      body: JSON.stringify({
        query,
        limit,
        lang: "sv",
        country: "se",
        tbs: "qdr:w",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    }),
  );
  const body = await res.text();
  if (!res.ok) {
    console.error(`Firecrawl [${res.status}] för "${query}": ${body.slice(0, 400)}`);
    const err: any = new Error(`gateway_${res.status}`);
    err.status = res.status;
    throw err;
  }
  const parsed = JSON.parse(body);
  const items = parsed?.data?.web ?? parsed?.data ?? [];
  return Array.isArray(items) ? items : [];
}

async function extractTips(params: {
  source: SourceDefinition;
  articles: { title: string; url: string; markdown: string }[];
  track: string;
  dateLabel: string;
}): Promise<TipRecord[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("missing_ai_key");

  const corpus = params.articles
    .map(
      (a, i) =>
        `### Artikel ${i + 1}: ${a.title}\nURL: ${a.url}\n${a.markdown.slice(0, 8000)}`,
    )
    .join("\n\n");

  const prompt = `Nedan finns öppet publicerade texter från ${params.source.name} inför V85 ${params.dateLabel}${
    params.track ? ` på ${params.track}` : ""
  }.

Plocka ut vad experten faktiskt skriver, per avdelning 1–8. Hitta aldrig på hästnamn.
Om en uppgift saknas ska fältet vara null. Kopiera inte hela texten – skriv egna korta meningar.

Svara med JSON i exakt denna form:
{"tips":[{"leg":1,"expert":"skribentens namn eller null","url":"artikelns url","topPick":"expertens förstahandsval","alternatives":["andra hästar experten tar med"],"longshot":"skrällförslag eller null","warning":"varning eller null","note":"max två meningar motivering på enkel svenska"}]}

TEXTER:
${corpus.slice(0, 50000)}`;

  const res = await withTimeout((signal) =>
    fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Du strukturerar svenska travexperters V85-tips. Skriv enkel svensk vardagssvenska. " +
              "Detta är experternas åsikter, aldrig fakta. Hitta aldrig på hästnamn. Svara enbart med giltig JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
    }),
  );
  if (!res.ok) {
    const text = await res.text();
    console.error(`AI-tolkning misslyckades [${res.status}]: ${text.slice(0, 300)}`);
    const err: any = new Error(res.status === 429 ? "ai_busy" : "ai_error");
    throw err;
  }
  const json: any = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("invalid_content");
    parsed = JSON.parse(match[0]);
  }

  const rows = Array.isArray(parsed?.tips) ? parsed.tips : [];
  const tips: TipRecord[] = [];
  for (const row of rows.slice(0, 16)) {
    const leg = Number(row?.leg);
    if (!Number.isInteger(leg) || leg < 1 || leg > 8) continue;
    tips.push({
      sourceKey: params.source.key,
      sourceName: params.source.name,
      expert: sanitizeText(row?.expert, 80),
      url: sanitizeUrl(row?.url) ?? params.articles[0]?.url ?? null,
      leg,
      topPick: sanitizeText(row?.topPick, 80),
      alternatives: Array.isArray(row?.alternatives)
        ? row.alternatives.map((a: unknown) => sanitizeText(a, 80)).filter(Boolean).slice(0, 6)
        : [],
      longshot: sanitizeText(row?.longshot, 80),
      warning: sanitizeText(row?.warning, 200),
      note: sanitizeText(row?.note, 400),
    });
  }
  return tips;
}

/** Hämtar en enda källa. Kastar aldrig – felet blir en status. */
export async function fetchSource(params: {
  source: SourceDefinition;
  track: string;
  dateLabel: string;
}): Promise<SourceFetchResult> {
  const { source } = params;
  const base = { key: source.key, name: source.name, tips: [], articles: [] };

  if (source.kind === "blocked" || !source.enabled) {
    return { ...base, status: "access_denied", message: source.accessNote };
  }

  try {
    const hits = await searchSource(source.query!(params.track, params.dateLabel));
    const articles = hits
      .map((hit) => ({
        title: sanitizeText(hit?.title, 160) ?? "Artikel",
        url: sanitizeUrl(hit?.url) ?? "",
        markdown: typeof hit?.markdown === "string" ? hit.markdown : "",
        publishedAt: null as string | null,
      }))
      .filter((a) => a.url && a.markdown.length > 200);

    if (articles.length === 0) {
      return { ...base, status: "no_tips", message: "Inga publicerade tips hittades ännu." };
    }

    const tips = await extractTips({ source, articles, track: params.track, dateLabel: params.dateLabel });
    if (tips.length === 0) {
      return {
        ...base,
        status: "format_changed",
        articles: articles.map(({ title, url, publishedAt }) => ({ title, url, publishedAt })),
        message: "Sidan gick att läsa men inga tips kunde tolkas.",
      };
    }

    return {
      key: source.key,
      name: source.name,
      status: "ok",
      message: null,
      tips,
      articles: articles.map(({ title, url, publishedAt }) => ({ title, url, publishedAt })),
    };
  } catch (error: any) {
    const code = error?.message ?? "";
    if (code === "missing_ai_key" || code === "missing_firecrawl") {
      return { ...base, status: "permanent_error", message: "Kopplingen till webbsökningen saknas." };
    }
    if (code === "invalid_content") {
      return { ...base, status: "invalid_content", message: "Innehållet kunde inte tolkas." };
    }
    if (error?.status === 401 || error?.status === 403) {
      return { ...base, status: "access_denied", message: "Källan tillåter inte hämtning." };
    }
    return {
      ...base,
      status: "temporary_error",
      message: "Källan svarade inte. Appen försöker igen automatiskt.",
    };
  }
}

/** Kör flera källor med begränsat antal samtidiga anrop. */
export async function fetchSources(params: {
  sources: SourceDefinition[];
  track: string;
  dateLabel: string;
}): Promise<SourceFetchResult[]> {
  const queue = [...params.sources];
  const results: SourceFetchResult[] = [];

  async function worker() {
    for (;;) {
      const source = queue.shift();
      if (!source) return;
      results.push(await fetchSource({ source, track: params.track, dateLabel: params.dateLabel }));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_PARALLEL_SOURCES, params.sources.length) }, worker),
  );
  return results;
}
