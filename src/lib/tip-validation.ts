/**
 * Valideringsmotor för experttips.
 *
 * Ren logik utan nätverksanrop – allt går att testa.
 * Grundregeln: en sida får bara klassas som experttips om vi kan verifiera
 * spelform, tävlingsdatum, bana och att sidan faktiskt innehåller ett tips.
 * Hellre två verifierade källor än åtta osäkra.
 */

/* -------------------------------------------------------------------------- */
/* Innehållstyper                                                             */
/* -------------------------------------------------------------------------- */

export type ContentType =
  | "official_race_data"
  | "expert_tip"
  | "race_news"
  | "horse_news"
  | "general_information"
  | "wrong_game_type"
  | "wrong_round"
  | "generic_page"
  | "paywalled"
  | "unverified"
  | "rejected";

/** Vardagliga förklaringar som visas för familjen. */
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  official_race_data: "Officiella tävlingsuppgifter",
  expert_tip: "Verifierat experttips",
  race_news: "Nyhet om loppet",
  horse_news: "Nyhet om en häst",
  general_information: "Allmän information",
  wrong_game_type: "Gäller en annan spelform",
  wrong_round: "Gäller en annan omgång",
  generic_page: "Allmän sida utan aktuellt tips",
  paywalled: "Bakom betalvägg",
  unverified: "Kunde inte verifieras",
  rejected: "Underkänd",
};

/** Endast den här typen får ingå i expertsammanställningen. */
export function isExpertTip(type: ContentType): boolean {
  return type === "expert_tip";
}

/** Nyheter visas separat under "Aktuella nyheter om hästarna". */
export function isNews(type: ContentType): boolean {
  return type === "race_news" || type === "horse_news";
}

/* -------------------------------------------------------------------------- */
/* Datum- och spelformshjälp                                                  */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

/** Skrivsätt som ett svenskt travdatum kan förekomma i. */
export function dateVariants(raceDate: string): string[] {
  const [y, m, d] = raceDate.split("-").map((v) => Number(v));
  if (!y || !m || !d) return [raceDate];
  const month = MONTHS[m - 1];
  return [
    raceDate,
    `${d} ${month}`,
    `${d}:e ${month}`,
    `${d}/${m}`,
    `${d}-${m}`,
    `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
    `${month} ${d}`,
  ];
}

const OTHER_GAMES = ["v75", "v64", "v65", "v86", "v4", "v5", "gs75", "dd", "ld", "top 7", "top7"];

function normalize(text: string): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ");
}

function hasGame(text: string, game: string): boolean {
  const g = game.toLowerCase().replace(/\s+/g, "\\s*");
  return new RegExp(`(^|[^a-z0-9])${g}([^a-z0-9]|$)`, "i").test(text);
}

/* -------------------------------------------------------------------------- */
/* Sidmönster                                                                 */
/* -------------------------------------------------------------------------- */

const GENERIC_PATH = [
  /^\/?$/,
  /^\/(v85|v75|trav|travtips|tips|sport|sportbladet|spel|nyheter)\/?$/i,
  /\/(tagg|taggar|amne|ämne|kategori|category|tag|arkiv)\//i,
  /\/(sok|sök|search|serp)(\/|\?|$)/i,
];

const SEARCH_QUERY = /[?&](q|query|s|sok|search)=/i;

/** Sidor som är start-, sök-, tagg- eller kategorisidor. */
export function isGenericPage(url: string): boolean {
  let path = url;
  let query = "";
  try {
    const parsed = new URL(url);
    path = parsed.pathname;
    query = parsed.search;
  } catch {
    /* relativ url – använd strängen som den är */
  }
  if (SEARCH_QUERY.test(query)) return true;
  return GENERIC_PATH.some((re) => re.test(path));
}

const PAYWALL_SIGNALS = [
  "endast för prenumeranter",
  "för prenumeranter",
  "plus-artikel",
  "logga in för att läsa",
  "betalvägg",
  "bli prenumerant",
  "lås upp artikeln",
];

/* -------------------------------------------------------------------------- */
/* Tipssignaler                                                               */
/* -------------------------------------------------------------------------- */

const TIP_SIGNALS: { re: RegExp; label: string }[] = [
  { re: /\bspik(en|förslag|ar|as)?\b/i, label: "spikförslag" },
  { re: /\bskräll(en|förslag|ar)?\b/i, label: "skrällförslag" },
  { re: /\bgarder(a|ing|ingar|ingsförslag)\b/i, label: "garderingsförslag" },
  { re: /\brangordn|\branking\b|\brankar\b/i, label: "rangordning" },
  { re: /\bsystemförslag\b|\bsystem för\b|\btipsrad\b|\bandelsrad\b/i, label: "systemförslag" },
  { re: /\bförstahäst|förstaval|huvudbud|bästa bud\b/i, label: "namngiven förstahäst" },
  { re: /\bstreckförslag|\breservhäst\b|\butgångshäst\b/i, label: "spelanalys" },
];

const LEG_SIGNAL = /\b(avd(elning)?\.?\s*[1-8]|lopp\s*[1-8])\b/i;

const NEWS_SIGNALS: { re: RegExp; type: ContentType }[] = [
  { re: /byter tränare|tränarbyte|ny tränare|flyttar till|såld till|köpt av/i, type: "horse_news" },
  { re: /skadad|opererad|avstängd|sjukdom|comeback efter/i, type: "horse_news" },
  { re: /anmäld till|siktar mot|planeras för|kommande start|nästa start/i, type: "horse_news" },
  { re: /intervju|krönika|reportage|prispengar höjs|banan rustas/i, type: "race_news" },
];

/* -------------------------------------------------------------------------- */
/* Verifiering                                                                */
/* -------------------------------------------------------------------------- */

export type ExpectedRound = {
  /** Alltid "V85" i den här appen. */
  gameType: string;
  raceDate: string;
  trackName: string;
  gameId?: string | null;
};

export type CandidateInput = {
  sourceKey: string;
  sourceName: string;
  url: string;
  title?: string | null;
  content?: string | null;
  publishedAt?: string | null;
  /** Källans egna mönster från källregistret. */
  allowedUrlPatterns?: string[];
  rejectUrlPatterns?: string[];
  supportedGames?: string[];
  paywall?: boolean;
};

export type CandidateVerification = {
  sourceKey: string;
  sourceName: string;
  url: string;
  title: string;
  classification: ContentType;
  gameTypeVerified: boolean;
  dateVerified: boolean;
  trackVerified: boolean;
  roundVerified: boolean;
  tipSignals: string[];
  accepted: boolean;
  /** Kort maskinläsbar orsak, t.ex. rejected_wrong_game_type. */
  code: string;
  /** Vardagliga förklaringar. */
  reasons: string[];
};

function matchAny(patterns: string[] | undefined, url: string): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((p) => {
    try {
      return new RegExp(p, "i").test(url);
    } catch {
      return url.toLowerCase().includes(p.toLowerCase());
    }
  });
}

/**
 * Bedömer en kandidatsida mot veckans officiella omgång.
 * Returnerar alltid ett svar – kastar aldrig.
 */
export function verifyCandidate(
  candidate: CandidateInput,
  expected: ExpectedRound,
): CandidateVerification {
  const title = (candidate.title ?? "").trim() || "Utan rubrik";
  const url = candidate.url ?? "";
  const haystack = normalize(`${title} ${url} ${candidate.content ?? ""}`);
  const reasons: string[] = [];

  const base = {
    sourceKey: candidate.sourceKey,
    sourceName: candidate.sourceName,
    url,
    title,
    tipSignals: [] as string[],
    gameTypeVerified: false,
    dateVerified: false,
    trackVerified: false,
    roundVerified: false,
  };

  const reject = (classification: ContentType, code: string, reason: string) => ({
    ...base,
    classification,
    accepted: false,
    code,
    reasons: [...reasons, reason],
  });

  /* Teknisk kontroll ------------------------------------------------------ */
  if (!url) return reject("rejected", "rejected_no_url", "Sidan saknar adress.");
  if (matchAny(candidate.rejectUrlPatterns, url)) {
    return reject("generic_page", "rejected_generic_page", "Adressen är undantagen i källregistret.");
  }
  if (isGenericPage(url)) {
    return reject(
      "generic_page",
      "rejected_generic_page",
      "Sidan är en start-, sök-, tagg- eller kategorisida.",
    );
  }
  const text = candidate.content ?? "";
  if (text.replace(/\s+/g, "").length < 400) {
    return reject("unverified", "rejected_empty_page", "Sidan innehöll för lite läsbar text.");
  }
  if (candidate.paywall || PAYWALL_SIGNALS.some((s) => haystack.includes(s))) {
    return reject("paywalled", "rejected_paywalled", "Materialet ligger bakom betalvägg.");
  }
  if (
    candidate.allowedUrlPatterns &&
    candidate.allowedUrlPatterns.length > 0 &&
    !matchAny(candidate.allowedUrlPatterns, url)
  ) {
    return reject(
      "general_information",
      "rejected_unexpected_url",
      "Adressen ligger utanför källans godkända tipsavdelning.",
    );
  }

  /* Omgångskontroll ------------------------------------------------------- */
  const game = expected.gameType.toLowerCase();
  const gameOk = hasGame(haystack, game);
  const otherGames = OTHER_GAMES.filter((g) => g !== game && hasGame(haystack, g));
  const urlOther = otherGames.filter((g) => hasGame(normalize(url), g));

  if (!gameOk) {
    return reject(
      otherGames.length > 0 ? "wrong_game_type" : "general_information",
      otherGames.length > 0 ? "rejected_wrong_game_type" : "rejected_no_game_type",
      otherGames.length > 0
        ? `Sidan handlar om ${otherGames[0].toUpperCase()} och inte om ${expected.gameType}.`
        : `Sidan nämner aldrig ${expected.gameType}.`,
    );
  }
  base.gameTypeVerified = true;
  reasons.push(`${expected.gameType} bekräftad på sidan.`);

  if (urlOther.length > 0) {
    return reject(
      "wrong_game_type",
      "rejected_wrong_game_type",
      `Adressen tillhör ${urlOther[0].toUpperCase()} och inte ${expected.gameType}.`,
    );
  }

  const variants = dateVariants(expected.raceDate);
  base.dateVerified = variants.some((v) => haystack.includes(v.toLowerCase()));
  base.trackVerified = expected.trackName
    ? haystack.includes(expected.trackName.toLowerCase())
    : false;
  const gameIdOk = expected.gameId ? haystack.includes(expected.gameId.toLowerCase()) : false;

  if (!base.dateVerified) {
    return reject("wrong_round", "rejected_wrong_round", "Sidans tävlingsdatum kunde inte bekräftas.");
  }
  reasons.push(`Tävlingsdatum ${expected.raceDate} bekräftat.`);

  if (!base.trackVerified && !gameIdOk) {
    return reject("wrong_round", "rejected_wrong_round", "Sidans bana kunde inte bekräftas.");
  }
  reasons.push(gameIdOk ? "Officiellt omgångs-ID bekräftat." : `Banan ${expected.trackName} bekräftad.`);
  base.roundVerified = true;

  /* Innehållskontroll ----------------------------------------------------- */
  const signals = TIP_SIGNALS.filter((s) => s.re.test(haystack)).map((s) => s.label);
  const legMentioned = LEG_SIGNAL.test(haystack);
  base.tipSignals = signals;

  if (signals.length === 0 || !legMentioned) {
    const news = NEWS_SIGNALS.find((n) => n.re.test(normalize(title)));
    if (news) {
      return {
        ...base,
        classification: news.type,
        accepted: false,
        code: "reclassified_as_news",
        reasons: [...reasons, "Sidan är en nyhetsartikel, inte ett spelförslag."],
      };
    }
    return reject(
      "general_information",
      "rejected_no_tip_content",
      "Sidan innehåller ingen rangordning, spik, skräll eller gardering för en aktuell avdelning.",
    );
  }

  reasons.push(`Tipsinnehåll hittat: ${signals.join(", ")}.`);
  return {
    ...base,
    classification: "expert_tip",
    accepted: true,
    code: "accepted_expert_tip",
    reasons,
  };
}

/* -------------------------------------------------------------------------- */
/* Konsensusnivåer                                                            */
/* -------------------------------------------------------------------------- */

export type ConsensusLevel = "none" | "single" | "multiple" | "clear" | "split";

/**
 * Hur många oberoende verifierade källor står bakom slutsatsen?
 * En källa får aldrig bli "experterna är eniga".
 */
export function consensusLevel(input: {
  supportingSources: number;
  totalSources: number;
}): ConsensusLevel {
  const { supportingSources, totalSources } = input;
  if (supportingSources <= 0) return "none";
  if (totalSources > supportingSources && supportingSources / totalSources < 0.5) return "split";
  if (supportingSources >= 3) return "clear";
  if (supportingSources === 2) return "multiple";
  return "single";
}

export function consensusText(level: ConsensusLevel, horse: string, sources: number): string {
  switch (level) {
    case "clear":
      return `Tydlig samsyn – ${horse} lyfts fram av ${sources} oberoende verifierade källor.`;
    case "multiple":
      return `Flera källor lyfter fram ${horse} (${sources} verifierade källor).`;
    case "single":
      return `En källa lyfter fram ${horse}.`;
    case "split":
      return `Delade meningar – ${horse} lyfts fram av ${sources} källor medan andra rankar annorlunda.`;
    default:
      return "Inga verifierade experttips har hittats för den här avdelningen ännu.";
  }
}

export const NO_TIPS_TEXT =
  "Inga verifierade experttips har hittats för den här avdelningen ännu.";
export const AI_ONLY_TEXT = "AI egen bedömning – inga verifierade experttips tillgängliga";

/* -------------------------------------------------------------------------- */
/* Kvalitetskrav innan expertsammanställning                                  */
/* -------------------------------------------------------------------------- */

export type QualityGateInput = {
  racesVerified: number;
  entriesComplete: boolean;
  verifiedSources: number;
  unsourcedClaims: number;
  misclassifiedRecords: number;
  otherGameTypes: number;
};

export type QualityGate = { ok: boolean; blockers: string[]; message: string };

export const QUALITY_BLOCKED_TEXT =
  "Expertunderlaget är ännu inte tillräckligt kvalitetssäkrat. AI kan analysera tävlingsfakta, men expertkonsensus skapas inte ännu.";

export function expertQualityGate(input: QualityGateInput): QualityGate {
  const blockers: string[] = [];
  if (input.racesVerified < 8) blockers.push("Alla åtta avdelningar är inte verifierade ännu.");
  if (!input.entriesComplete) blockers.push("Startfältet är inte komplett.");
  if (input.verifiedSources < 1) blockers.push("Ingen verifierad expertkälla finns ännu.");
  if (input.unsourcedClaims > 0) blockers.push("Alla påståenden har ännu inte en källa.");
  if (input.misclassifiedRecords > 0) blockers.push("Felklassificerade poster måste granskas först.");
  if (input.otherGameTypes > 0) blockers.push("Material från andra spelformer ingår i underlaget.");
  return {
    ok: blockers.length === 0,
    blockers,
    message: blockers.length === 0 ? "Expertunderlaget är kvalitetssäkrat." : QUALITY_BLOCKED_TEXT,
  };
}

/* -------------------------------------------------------------------------- */
/* Körningens bokföring                                                       */
/* -------------------------------------------------------------------------- */

export type RunAccounting = {
  candidates: number;
  accepted: number;
  rejected: number;
  reclassified: number;
  duplicates: number;
  newTips: number;
  updatedTips: number;
  unchangedTips: number;
  missingTips: number;
  verifiedTotal: number;
};

export function emptyAccounting(): RunAccounting {
  return {
    candidates: 0,
    accepted: 0,
    rejected: 0,
    reclassified: 0,
    duplicates: 0,
    newTips: 0,
    updatedTips: 0,
    unchangedTips: 0,
    missingTips: 0,
    verifiedTotal: 0,
  };
}

/** Förklarar varför en körning kan ge färre tips än den förra. */
export function accountingSummary(a: RunAccounting): string {
  const removed = a.rejected + a.duplicates + a.reclassified;
  return (
    `${a.candidates} kandidater hittades. ${removed} underkändes, omklassificerades eller slogs ihop som dubbletter. ` +
    `${a.verifiedTotal} verifierade tips återstod (${a.newTips} nya, ${a.updatedTips} uppdaterade, ${a.unchangedTips} oförändrade).`
  );
}

/** Jämför två körningar och förklarar skillnaden i klartext. */
export function explainRunDifference(
  previous: { tips: number; at?: string | null },
  current: { tips: number; at?: string | null },
  accounting: RunAccounting,
): string {
  if (current.tips === previous.tips) {
    return `Lika många verifierade tips som föregående körning (${current.tips}).`;
  }
  if (current.tips < previous.tips) {
    return (
      `Antalet minskade från ${previous.tips} till ${current.tips}. ` + accountingSummary(accounting)
    );
  }
  return `Antalet ökade från ${previous.tips} till ${current.tips}. ` + accountingSummary(accounting);
}

/* -------------------------------------------------------------------------- */
/* Stabil tipsnyckel                                                          */
/* -------------------------------------------------------------------------- */

/** Nyckeln som gör att samma tips aldrig sparas två gånger. */
export function verifiedTipKey(input: {
  roundKey: string;
  sourceKey: string;
  url: string;
  leg: number;
  contentHash: string;
}): string {
  return [input.roundKey, input.sourceKey, input.url, `avd${input.leg}`, input.contentHash]
    .join("|")
    .toLowerCase();
}
