/**
 * Expertkällor: en adapter per källa så att en förändring hos en webbplats
 * aldrig slår ut hela importen.
 *
 * Vi hämtar bara via Firecrawl (som följer robots.txt och webbplatsernas
 * tekniska åtkomstregler) och sparar strukturerade tips, korta sammanfattningar
 * och länkar till originalet. Hela artiklar kopieras aldrig.
 *
 * Viktigt: en träff från webbsökningen är bara en kandidat. Först när
 * valideringsmotorn har bekräftat spelform, datum, bana och tipsinnehåll får
 * sidan bli ett experttips.
 * Endast serverkod.
 */
import type { SourceStatus, TipRecord } from "./automation-core";
import {
  verifyCandidate,
  type CandidateVerification,
  type ExpectedRound,
} from "./tip-validation";

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
  /** Spelformer källan får användas för. */
  supportedGames: string[];
  /** Adressmönster som räknas som tipsavdelning hos källan. */
  allowedUrlPatterns: string[];
  /** Adressmönster som alltid avvisas. */
  rejectUrlPatterns: string[];
  paywall: boolean;
  /** Kortaste tid mellan två automatiska kontroller. */
  minIntervalMinutes: number;
  query?: (track: string, dateLabel: string) => string;
};

/** Mönster som aldrig får bli experttips oavsett källa. */
const UNIVERSAL_REJECT = [
  "/v75", "/v64", "/v65", "/v86", "/v4/", "/v5/", "/gs75", "/top7", "/top-7", "/dd/",
  "/tagg/", "/taggar/", "/kategori/", "/category/", "/amne/", "/arkiv/",
  "/sok", "/search", "\\?q=", "/nyheter/", "/sport/nyheter",
];

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
    supportedGames: ["V85"],
    allowedUrlPatterns: ["travronden\\.se/.*(tips|spel|analys|v85)"],
    rejectUrlPatterns: [...UNIVERSAL_REJECT, "travronden\\.se/plus"],
    paywall: false,
    minIntervalMinutes: 45,
    query: (track, date) => `V85 tips ${track} ${date} site:travronden.se`,
  },
  {
    key: "atg-tipset",
    name: "ATG Tipset",
    domain: "atg.se",
    kind: "search",
    enabled: true,
    accessNote: "ATG:s egna tipssidor. Endast sammanfattning och länk sparas.",
    supportedGames: ["V85"],
    allowedUrlPatterns: ["atg\\.se/.*(tips|analys)"],
    rejectUrlPatterns: [...UNIVERSAL_REJECT, "atg\\.se/v85/?$", "atg\\.se/spel/?$"],
    paywall: false,
    minIntervalMinutes: 45,
    query: (track, date) => `V85 tips ${track} ${date} site:atg.se`,
  },
  {
    key: "sportbladet-trav",
    name: "Sportbladet Trav",
    domain: "aftonbladet.se",
    kind: "search",
    enabled: true,
    accessNote: "Öppna travartiklar. Låst material hämtas inte.",
    supportedGames: ["V85"],
    allowedUrlPatterns: ["aftonbladet\\.se/.*(trav|v85)"],
    rejectUrlPatterns: UNIVERSAL_REJECT,
    paywall: false,
    minIntervalMinutes: 45,
    query: (track, date) => `V85 tips ${track} ${date} site:aftonbladet.se trav`,
  },
  {
    key: "travnytt",
    name: "Travnytt",
    domain: "travnytt.se",
    kind: "search",
    enabled: true,
    accessNote: "Öppet publicerade tips och analyser.",
    supportedGames: ["V85"],
    allowedUrlPatterns: ["travnytt\\.se/.*(tips|spel|analys|v85)"],
    rejectUrlPatterns: UNIVERSAL_REJECT,
    paywall: false,
    minIntervalMinutes: 45,
    query: (track, date) => `V85 spiktips ${track} ${date} site:travnytt.se`,
  },
  {
    key: "jarvsotravet-bloggar",
    name: "Travbloggar",
    domain: null,
    kind: "search",
    enabled: true,
    accessNote: "Öppna travbloggar med publicerade V85-tips.",
    supportedGames: ["V85"],
    allowedUrlPatterns: [],
    rejectUrlPatterns: UNIVERSAL_REJECT,
    paywall: false,
    minIntervalMinutes: 60,
    query: (track, date) => `V85 tips analys ${track} ${date} travblogg`,
  },
  {
    key: "andelstips",
    name: "Andelsspelens tips",
    domain: null,
    kind: "search",
    enabled: true,
    accessNote: "Öppna sammanfattningar av andelsspelens V85-tips.",
    supportedGames: ["V85"],
    allowedUrlPatterns: [],
    rejectUrlPatterns: UNIVERSAL_REJECT,
    paywall: false,
    minIntervalMinutes: 60,
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
    supportedGames: ["V85"],
    allowedUrlPatterns: [],
    rejectUrlPatterns: UNIVERSAL_REJECT,
    paywall: true,
    minIntervalMinutes: 1440,
  },
  {
    key: "facebook-grupper",
    name: "Slutna Facebook-grupper",
    domain: "facebook.com",
    kind: "blocked",
    enabled: false,
    accessNote: "Kräver inloggning och tillåter inte automatisk hämtning.",
    supportedGames: ["V85"],
    allowedUrlPatterns: [],
    rejectUrlPatterns: UNIVERSAL_REJECT,
    paywall: false,
    minIntervalMinutes: 1440,
  },
];

export type SourceFetchResult = {
  key: string;
  name: string;
  status: SourceStatus;
  message: string | null;
  /** Endast tips från verifierade sidor. */
  tips: TipRecord[];
  /** Alla prövade sidor med sin bedömning – sparas för revision. */
  candidates: CandidateVerification[];
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

async function searchSource(query: string, limit = 4): Promise<any[]> {
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

/**
 * Låter AI plocka ut tipsen ur EN redan verifierad sida.
 * AI får aldrig avgöra om sidan är ett giltigt tips – det har redan gjorts.
 */
async function extractTips(params: {
  source: SourceDefinition;
  article: { title: string; url: string; markdown: string };
  expected: ExpectedRound;
  dateLabel: string;
}): Promise<TipRecord[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("missing_ai_key");

  const prompt = `Nedan finns en verifierad tipsartikel från ${params.source.name} inför V85 ${params.dateLabel} på ${params.expected.trackName}.

Plocka ut vad experten faktiskt skriver, per avdelning 1–8. Hitta aldrig på hästnamn.
Ta bara med en avdelning om artikeln verkligen ger ett spelförslag för den avdelningen.
Om en uppgift saknas ska fältet vara null. Kopiera inte hela texten – skriv egna korta meningar.

Svara med JSON i exakt denna form:
{"tips":[{"leg":1,"expert":"skribentens namn eller null","topPick":"expertens förstahandsval","alternatives":["andra hästar experten tar med"],"longshot":"skrällförslag eller null","warning":"varning eller null","note":"max två meningar motivering på enkel svenska"}]}

ARTIKEL: ${params.article.title}
URL: ${params.article.url}
${params.article.markdown.slice(0, 20000)}`;

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
              "Detta är experternas åsikter, aldrig fakta. Hitta aldrig på hästnamn. " +
              "Utelämna avdelningar där artikeln saknar spelförslag. Svara enbart med giltig JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
    }),
  );
  if (!res.ok) {
    const text = await res.text();
    console.error(`AI-tolkning misslyckades [${res.status}]: ${text.slice(0, 300)}`);
    throw new Error(res.status === 429 ? "ai_busy" : "ai_error");
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
  for (const row of rows.slice(0, 8)) {
    const leg = Number(row?.leg);
    if (!Number.isInteger(leg) || leg < 1 || leg > 8) continue;
    const topPick = sanitizeText(row?.topPick, 80);
    const alternatives = Array.isArray(row?.alternatives)
      ? (row.alternatives.map((a: unknown) => sanitizeText(a, 80)).filter(Boolean) as string[]).slice(0, 6)
      : [];
    const longshot = sanitizeText(row?.longshot, 80);
    // Ett tips utan namngiven häst är ingen spelrekommendation.
    if (!topPick && alternatives.length === 0 && !longshot) continue;
    tips.push({
      sourceKey: params.source.key,
      sourceName: params.source.name,
      expert: sanitizeText(row?.expert, 80),
      url: params.article.url,
      leg,
      topPick,
      alternatives,
      longshot,
      warning: sanitizeText(row?.warning, 200),
      note: sanitizeText(row?.note, 400),
    });
  }
  return tips;
}

/** Hämtar en enda källa. Kastar aldrig – felet blir en status. */
export async function fetchSource(params: {
  source: SourceDefinition;
  expected: ExpectedRound;
  dateLabel: string;
}): Promise<SourceFetchResult> {
  const { source, expected } = params;
  const base = {
    key: source.key,
    name: source.name,
    tips: [] as TipRecord[],
    candidates: [] as CandidateVerification[],
    articles: [] as { title: string; url: string; publishedAt: string | null }[],
  };

  if (source.kind === "blocked" || !source.enabled) {
    return { ...base, status: "manual_only", message: source.accessNote };
  }
  if (!source.supportedGames.includes(expected.gameType)) {
    return { ...base, status: "no_tips", message: "Källan täcker inte den här spelformen." };
  }

  try {
    const hits = await searchSource(source.query!(expected.trackName, params.dateLabel));

    const candidates: CandidateVerification[] = [];
    const accepted: { title: string; url: string; markdown: string }[] = [];

    for (const hit of hits) {
      const url = sanitizeUrl(hit?.url) ?? "";
      const title = sanitizeText(hit?.title, 160) ?? "Utan rubrik";
      const markdown = typeof hit?.markdown === "string" ? hit.markdown : "";
      const verification = verifyCandidate(
        {
          sourceKey: source.key,
          sourceName: source.name,
          url,
          title,
          content: markdown,
          allowedUrlPatterns: source.allowedUrlPatterns,
          rejectUrlPatterns: source.rejectUrlPatterns,
          supportedGames: source.supportedGames,
          paywall: source.paywall,
        },
        expected,
      );
      candidates.push(verification);
      if (verification.accepted) accepted.push({ title, url, markdown });
    }

    if (candidates.length === 0) {
      return { ...base, status: "no_tips", message: "Inga kandidatsidor hittades ännu.", candidates };
    }

    if (accepted.length === 0) {
      return {
        ...base,
        status: "checked_no_tips",
        candidates,
        message: `${source.name} kontrollerad – inget verifierat V85-tips hittat ännu.`,
      };
    }

    const tips: TipRecord[] = [];
    for (const article of accepted) {
      try {
        tips.push(
          ...(await extractTips({ source, article, expected, dateLabel: params.dateLabel })),
        );
      } catch (error: any) {
        console.error(`Tolkning misslyckades för ${article.url}:`, error?.message ?? error);
      }
    }

    if (tips.length === 0) {
      return {
        ...base,
        status: "format_changed",
        candidates,
        articles: accepted.map((a) => ({ title: a.title, url: a.url, publishedAt: null })),
        message: "Sidan gick att läsa men inga spelförslag kunde tolkas.",
      };
    }

    return {
      key: source.key,
      name: source.name,
      status: "ok",
      message: null,
      tips,
      candidates,
      articles: accepted.map((a) => ({ title: a.title, url: a.url, publishedAt: null })),
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
      return { ...base, status: "manual_only", message: "Källan tillåter inte automatisk hämtning." };
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
  expected: ExpectedRound;
  dateLabel: string;
}): Promise<SourceFetchResult[]> {
  const queue = [...params.sources];
  const results: SourceFetchResult[] = [];

  async function worker() {
    for (;;) {
      const source = queue.shift();
      if (!source) return;
      results.push(
        await fetchSource({ source, expected: params.expected, dateLabel: params.dateLabel }),
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_PARALLEL_SOURCES, params.sources.length) }, worker),
  );
  return results;
}
