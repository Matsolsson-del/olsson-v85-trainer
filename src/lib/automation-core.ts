/**
 * Ren logik för torsdagsautomationen: val av rätt lördagsomgång,
 * idempotensnycklar, versionshashar, faktaförändringar och statusräkning.
 * Inga anrop utåt – allt här går att testa.
 */

export type UpcomingGame = {
  id: string;
  startTime: string;
  tracks?: { id?: number; name?: string }[];
  races?: unknown[];
};

export type RoundPick =
  | { ok: true; gameId: string; raceDate: string; trackName: string; startTime: string }
  | { ok: false; reason: "no_saturday_game" | "no_track"; deviations: string[] };

/**
 * Väljer V85-omgången för den angivna lördagen.
 * Väljer aldrig nästa veckas omgång och hittar aldrig på en omgång.
 * V85 på annan veckodag rapporteras som avvikelse i stället för att blandas ihop.
 */
export function pickSaturdayGame(
  upcoming: UpcomingGame[],
  saturday: string,
): RoundPick {
  const deviations: string[] = [];
  const candidates: UpcomingGame[] = [];

  for (const game of upcoming ?? []) {
    const date = (game.startTime ?? "").slice(0, 10);
    if (!date) continue;
    if (date === saturday) {
      candidates.push(game);
    } else if (date < saturday) {
      deviations.push(
        `V85 är utlyst ${date}, alltså inte på lördagen ${saturday}. Den hämtas inte automatiskt.`,
      );
    }
  }

  if (candidates.length === 0) {
    return { ok: false, reason: "no_saturday_game", deviations };
  }
  if (candidates.length > 1) {
    deviations.push(
      `ATG listar ${candidates.length} V85-omgångar den ${saturday}. Den som startar först används.`,
    );
  }

  const game = candidates.sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  const trackName = game.tracks?.[0]?.name ?? "";
  if (!trackName) return { ok: false, reason: "no_track", deviations };

  return {
    ok: true,
    gameId: game.id,
    raceDate: saturday,
    trackName,
    startTime: game.startTime,
  };
}

/**
 * Idempotensnyckel för en omgång. Officiellt ATG-id används i första hand,
 * annars en stabil kombination av spelform, datum och bana.
 */
export function roundKey(input: {
  gameId?: string | null;
  product?: string;
  raceDate: string;
  trackName: string;
}): string {
  if (input.gameId) return `atg:${input.gameId}`;
  const track = input.trackName.trim().toLowerCase().replace(/\s+/g, "-");
  return `${(input.product ?? "V85").toLowerCase()}:${input.raceDate}:${track}`;
}

/** Stabil hash (FNV-1a, 32 bitar) av innehåll – används för tipsens versioner. */
export function contentHash(value: unknown): string {
  const text = typeof value === "string" ? value : stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Identitet för ett experttips: samma tips ska aldrig sparas två gånger. */
export function tipKey(input: {
  raceDate: string;
  sourceKey: string;
  expert?: string | null;
  url?: string | null;
  externalId?: string | null;
}): string {
  const ref = input.externalId ?? input.url ?? "";
  return [input.raceDate, input.sourceKey, (input.expert ?? "").trim().toLowerCase(), ref]
    .join("|")
    .toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Faktaförändringar                                                          */
/* -------------------------------------------------------------------------- */

export type FactSnapshot = {
  scratched?: boolean | null;
  driver?: string | null;
  postPosition?: number | null;
  shoes?: string | null;
  sulky?: string | null;
  betSharePercent?: number | null;
  startAt?: string | null;
};

export type FactChange = {
  field: keyof FactSnapshot;
  before: unknown;
  after: unknown;
  /** true när ändringen kan påverka analysen eller systemet. */
  important: boolean;
  text: string;
};

const FIELD_LABELS: Record<keyof FactSnapshot, string> = {
  scratched: "strykning",
  driver: "kuskbyte",
  postPosition: "spårändring",
  shoes: "balans",
  sulky: "vagn",
  betSharePercent: "streckprocent",
  startAt: "starttid",
};

/** Jämför tidigare och ny fakta för en startande häst. */
export function diffFacts(before: FactSnapshot, after: FactSnapshot): FactChange[] {
  const changes: FactChange[] = [];
  const fields = Object.keys(FIELD_LABELS) as (keyof FactSnapshot)[];

  for (const field of fields) {
    const prev = before[field] ?? null;
    const next = after[field] ?? null;
    if (prev === next) continue;
    if (next === null) continue; // saknad uppgift ersätter aldrig känd uppgift
    // Första gången en uppgift fylls i är det ny information, inte en ändring.
    if (prev === null && field !== "scratched") continue;


    if (field === "betSharePercent") {
      const delta = Math.abs(Number(next) - Number(prev ?? 0));
      if (delta < 3) continue; // små rörelser är brus
      changes.push({
        field,
        before: prev,
        after: next,
        important: delta >= 5,
        text: `Streckprocenten ändrades från ${prev ?? 0} till ${next}.`,
      });
      continue;
    }

    const important = field !== "sulky";
    changes.push({
      field,
      before: prev,
      after: next,
      important,
      text: changeText(field, prev, next),
    });
  }

  return changes;
}

function changeText(field: keyof FactSnapshot, before: unknown, after: unknown): string {
  switch (field) {
    case "scratched":
      return after ? "Hästen är struken." : "Strykningen är återtagen.";
    case "driver":
      return `Kuskbyte: ${before ?? "okänd"} byts mot ${after}.`;
    case "postPosition":
      return `Nytt startspår: ${before ?? "okänt"} blir ${after}.`;
    case "shoes":
      return `Ändrad balans: ${after}.`;
    case "sulky":
      return `Ändrad vagn: ${after}.`;
    case "startAt":
      return `Ny starttid: ${after}.`;
    default:
      return `${FIELD_LABELS[field]} ändrad.`;
  }
}

/** Kort text till familjen om vad som ändrats sedan förra analysen. */
export function changeSummary(changes: { leg: number; text: string; important: boolean }[]): string | null {
  const important = changes.filter((c) => c.important);
  if (important.length === 0) return null;
  const parts = important
    .slice(0, 4)
    .map((c) => `${c.text.replace(/\.$/, "")} i avdelning ${c.leg}`);
  const rest = important.length - parts.length;
  return `Ny information sedan senaste analysen: ${parts.join(", ")}${
    rest > 0 ? ` och ${rest} ändring${rest === 1 ? "" : "ar"} till` : ""
  }.`;
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export type SourceStatus =
  | "ok"
  | "checked_no_tips"
  | "no_tips"
  | "temporary_error"
  | "permanent_error"
  | "access_denied"
  | "manual_only"
  | "format_changed"
  | "invalid_content"
  | "pending";

export type SourceState = {
  key: string;
  name: string;
  status: SourceStatus;
  tips: number;
  attempts: number;
  lastCheckedAt?: string | null;
  message?: string | null;
};

export type FactsStatus = "waiting" | "fetching" | "partial" | "ready" | "needs_attention";

export function factsStatus(input: {
  running: boolean;
  races: number;
  entries: number;
  lastError?: string | null;
}): FactsStatus {
  if (input.running) return "fetching";
  if (input.lastError) return "needs_attention";
  if (input.races === 0) return "waiting";
  if (input.races < 8 || input.entries === 0) return "partial";
  return "ready";
}

export const FACTS_STATUS_LABEL: Record<FactsStatus, string> = {
  waiting: "Väntar",
  fetching: "Hämtar",
  partial: "Delvis klart",
  ready: "Klart",
  needs_attention: "Behöver åtgärdas",
};

/** Vardagliga förklaringar av varje källas status. */
export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = {
  ok: "Verifierade tips hämtade",
  checked_no_tips: "Kontrollerad – inget verifierat tips ännu",
  no_tips: "Inget publicerat ännu",
  temporary_error: "Svarade inte – nytt försök sker automatiskt",
  permanent_error: "Fungerar inte just nu",
  access_denied: "Får inte hämtas automatiskt",
  manual_only: "Endast manuell läsning",
  format_changed: "Sidan ser annorlunda ut",
  invalid_content: "Innehållet gick inte att tolka",
  pending: "Inte kontrollerad ännu",
};




export type TipsSummary = {
  /** Antal källor som finns i registret (konfigurerade). */
  configured: number;
  /** Antal källor som faktiskt kontrollerades den här körningen. */
  checked: number;
  /** Källor som gav minst ett verifierat tips. */
  withTips: number;
  /** Källor som kontrollerades men inte hade något verifierat tips. */
  checkedWithoutTips: number;
  /** Källor som bara får läsas manuellt (betalvägg, inloggning). */
  manualOnly: number;
  waiting: number;
  failed: number;
  tips: number;
  lastCheckedAt: string | null;
};

export function summarizeSources(sources: SourceState[]): TipsSummary {
  const configured = sources.length;
  const manualOnly = sources.filter((s) =>
    ["manual_only", "access_denied"].includes(s.status),
  ).length;
  const checked = sources.filter((s) =>
    ["ok", "checked_no_tips", "no_tips", "format_changed", "invalid_content"].includes(s.status),
  ).length;
  const withTips = sources.filter((s) => s.status === "ok" && s.tips > 0).length;
  const checkedWithoutTips = Math.max(0, checked - withTips);
  const failed = sources.filter((s) =>
    ["permanent_error", "format_changed", "invalid_content"].includes(s.status),
  ).length;
  const waiting = sources.filter((s) =>
    ["pending", "no_tips", "temporary_error", "checked_no_tips"].includes(s.status),
  ).length;
  const times = sources
    .map((s) => s.lastCheckedAt)
    .filter((t): t is string => Boolean(t))
    .sort();
  return {
    configured,
    checked,
    withTips,
    checkedWithoutTips,
    manualOnly,
    waiting,
    failed,
    tips: sources.reduce((sum, s) => sum + (s.tips || 0), 0),
    lastCheckedAt: times.length > 0 ? times[times.length - 1] : null,

  };
}

/* -------------------------------------------------------------------------- */
/* Sammanställning av experternas tips per avdelning                          */
/* -------------------------------------------------------------------------- */

export type TipRecord = {
  sourceKey: string;
  sourceName: string;
  expert?: string | null;
  url?: string | null;
  leg: number;
  /** Expertens förstahandsval i avdelningen. */
  topPick?: string | null;
  alternatives?: string[];
  longshot?: string | null;
  warning?: string | null;
  note?: string | null;
};

export type LegDigest = {
  leg: number;
  topHorse: string | null;
  topSupport: number;
  alternatives: { horse: string; support: number }[];
  longshots: { horse: string; support: number }[];
  warnings: string[];
  sources: { name: string; url: string | null; expert: string | null }[];
  expertCount: number;
  /** 0 = alla tycker lika, 1 = alla tycker olika. */
  disagreement: number;
};

export function digestLegs(tips: TipRecord[]): LegDigest[] {
  const byLeg = new Map<number, TipRecord[]>();
  for (const tip of tips) {
    if (!tip.leg || tip.leg < 1 || tip.leg > 8) continue;
    const list = byLeg.get(tip.leg) ?? [];
    list.push(tip);
    byLeg.set(tip.leg, list);
  }

  return [...byLeg.keys()]
    .sort((a, b) => a - b)
    .map((leg) => {
      const legTips = byLeg.get(leg)!;
      const tops = count(legTips.map((t) => t.topPick));
      const alts = count(legTips.flatMap((t) => t.alternatives ?? []));
      const longs = count(legTips.map((t) => t.longshot));
      const top = tops[0] ?? null;
      const expertCount = legTips.length;
      const disagreement =
        expertCount === 0 || !top ? 0 : Math.round((1 - top.support / expertCount) * 100) / 100;

      return {
        leg,
        topHorse: top?.horse ?? null,
        topSupport: top?.support ?? 0,
        alternatives: alts.filter((a) => a.horse !== top?.horse).slice(0, 4),
        longshots: longs.slice(0, 3),
        warnings: legTips.map((t) => t.warning).filter((w): w is string => Boolean(w)),
        sources: legTips.map((t) => ({
          name: t.sourceName,
          url: t.url ?? null,
          expert: t.expert ?? null,
        })),
        expertCount,
        disagreement,
      };
    });
}

function count(values: (string | null | undefined)[]): { horse: string; support: number }[] {
  const map = new Map<string, number>();
  for (const value of values) {
    const horse = (value ?? "").trim();
    if (!horse) continue;
    map.set(horse, (map.get(horse) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([horse, support]) => ({ horse, support }))
    .sort((a, b) => b.support - a.support || a.horse.localeCompare(b.horse));
}

export type TipsOverview = {
  mostRecommendedSpike: { leg: number; horse: string; support: number } | null;
  mostTalkedLongshot: { leg: number; horse: string; support: number } | null;
  mostOpenLeg: { leg: number; expertCount: number } | null;
  biggestDisagreement: { leg: number; disagreement: number } | null;
};

export function overviewFromDigest(digests: LegDigest[]): TipsOverview {
  const withTop = digests.filter((d) => d.topHorse);
  const spike = withTop
    .slice()
    .sort((a, b) => b.topSupport - a.topSupport || a.leg - b.leg)[0];
  const longshot = digests
    .flatMap((d) => d.longshots.map((l) => ({ leg: d.leg, ...l })))
    .sort((a, b) => b.support - a.support || a.leg - b.leg)[0];
  const open = digests
    .slice()
    .sort((a, b) => b.disagreement - a.disagreement || a.leg - b.leg)[0];

  return {
    mostRecommendedSpike: spike
      ? { leg: spike.leg, horse: spike.topHorse!, support: spike.topSupport }
      : null,
    mostTalkedLongshot: longshot ?? null,
    mostOpenLeg: open ? { leg: open.leg, expertCount: open.expertCount } : null,
    biggestDisagreement: open ? { leg: open.leg, disagreement: open.disagreement } : null,
  };
}

/** Hästar där experterna tydligt avviker från streckprocenten. */
export function marketMismatch(
  digests: LegDigest[],
  market: { leg: number; horse: string; percent: number }[],
): { leg: number; horse: string; percent: number; support: number; kind: "överstreckad" | "understreckad" }[] {
  const out: ReturnType<typeof marketMismatch> = [];
  for (const digest of digests) {
    if (digest.expertCount === 0) continue;
    for (const row of market.filter((m) => m.leg === digest.leg)) {
      const support =
        (digest.topHorse === row.horse ? digest.topSupport : 0) ||
        digest.alternatives.find((a) => a.horse === row.horse)?.support ||
        0;
      const share = support / digest.expertCount;
      if (row.percent >= 30 && share <= 0.2) {
        out.push({ ...row, support, kind: "överstreckad" });
      } else if (row.percent <= 12 && share >= 0.5) {
        out.push({ ...row, support, kind: "understreckad" });
      }
    }
  }
  return out.sort((a, b) => a.leg - b.leg);
}
