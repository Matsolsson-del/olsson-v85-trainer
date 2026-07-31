/**
 * Tidsschema för Travhubbens automatiska körningar.
 *
 * All tidräkning sker i Europe/Stockholm. Databasens schemaläggare (pg_cron)
 * kan bara köra i UTC, och Sverige växlar mellan UTC+1 (vintertid) och UTC+2
 * (sommartid). Därför gör vi två saker:
 *
 *  1. pg_cron anropar endpointen på BÅDA de UTC-tider som kan motsvara den
 *     svenska klockslaget (t.ex. 05:00 och 06:00 UTC för 07:00 svensk tid).
 *  2. Servern kontrollerar den svenska lokala tiden och kör bara om den
 *     faktiskt ligger i rätt fönster. Den andra anropstiden avvisas med
 *     "utanför tidsfönstret" och gör ingenting.
 *
 * Resultatet blir korrekt 07:00 svensk tid året om, utan att någon behöver
 * ändra schemat vid sommartidsomställningen.
 */

export type StockholmParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = söndag, 4 = torsdag, 6 = lördag */
  weekday: number;
  /** ISO-datum (YYYY-MM-DD) i svensk lokal tid */
  date: string;
  /** UTC-offset i timmar, 1 vintertid och 2 sommartid */
  offsetHours: number;
};

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Stockholm",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Bryter ned ett ögonblick till svensk lokal tid. */
export function stockholmParts(instant: Date): StockholmParts {
  const parts = Object.fromEntries(
    FORMATTER.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  const minute = Number(parts.minute);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetHours = Math.round((asUtc - instant.getTime()) / 3_600_000);

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    offsetHours,
  };
}

export type ScheduleSlot = {
  /** Identitet i loggar och i automationsvyn. */
  key: string;
  label: string;
  /** 0 = söndag … 6 = lördag, i svensk lokal tid */
  weekday: number;
  hour: number;
  /** Torsdagens 07.00 skapar omgången; övriga kompletterar bara. */
  mode: "full" | "followup";
};

/**
 * Veckans körningsplan i svensk lokal tid.
 * Torsdag 07.00 skapar omgången. Övriga är kompletteringskörningar som bara
 * uppdaterar fakta och hämtar experttips som publicerats senare.
 */
export const SCHEDULE: ScheduleSlot[] = [
  { key: "thu-07", label: "Torsdag 07.00", weekday: 4, hour: 7, mode: "full" },
  { key: "thu-12", label: "Torsdag 12.00", weekday: 4, hour: 12, mode: "followup" },
  { key: "thu-18", label: "Torsdag 18.00", weekday: 4, hour: 18, mode: "followup" },
  { key: "fri-07", label: "Fredag 07.00", weekday: 5, hour: 7, mode: "followup" },
  { key: "fri-18", label: "Fredag 18.00", weekday: 5, hour: 18, mode: "followup" },
  { key: "sat-08", label: "Lördag 08.00", weekday: 6, hour: 8, mode: "followup" },
];

/** Hur många minuter efter hel timme en körning fortfarande accepteras. */
export const WINDOW_MINUTES = 55;

/**
 * Vilken planerad körning som ett anrop hör till, eller null om anropet kommer
 * utanför alla tidsfönster (t.ex. det andra UTC-anropet samma morgon).
 */
export function matchSlot(now: Date): ScheduleSlot | null {
  const p = stockholmParts(now);
  const slot = SCHEDULE.find((s) => s.weekday === p.weekday && s.hour === p.hour);
  if (!slot) return null;
  return p.minute <= WINDOW_MINUTES ? slot : null;
}

/** Nästa planerade körning efter ett givet ögonblick. */
export function nextRun(now: Date): { slot: ScheduleSlot; at: Date } {
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const probe = new Date(now.getTime() + dayOffset * 86_400_000);
    const p = stockholmParts(probe);
    const slots = SCHEDULE.filter((s) => s.weekday === p.weekday).sort(
      (a, b) => a.hour - b.hour,
    );
    for (const slot of slots) {
      const at = stockholmTimeToInstant(p.date, slot.hour);
      if (at.getTime() > now.getTime()) return { slot, at };
    }
  }
  // Ska aldrig inträffa: schemat innehåller alltid minst en dag i veckan.
  return { slot: SCHEDULE[0], at: new Date(now.getTime() + 604_800_000) };
}

/** Gör om "2026-08-01" + timme i svensk tid till ett exakt ögonblick (UTC). */
export function stockholmTimeToInstant(date: string, hour: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  // Prova båda offseterna och behåll den som faktiskt ger rätt lokal timme.
  for (const offset of [2, 1]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, hour - offset, 0, 0));
    const p = stockholmParts(candidate);
    if (p.date === date && p.hour === hour) return candidate;
  }
  return new Date(Date.UTC(y, m - 1, d, hour - 1, 0, 0));
}

/** Datumet (svensk tid) för den lördag omgången gäller, sett från "now". */
export function targetSaturday(now: Date): string {
  const p = stockholmParts(now);
  // Lördag före kl. 23 räknas fortfarande som dagens omgång.
  const daysAhead = (6 - p.weekday + 7) % 7;
  const [y, m, d] = p.date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + daysAhead));
  return target.toISOString().slice(0, 10);
}

/** Kontrollerad fördröjning mellan återförsök: 5, 20 och 60 minuter. */
export const RETRY_DELAYS_MINUTES = [5, 20, 60];

export function retryDelayMinutes(attempt: number): number | null {
  return RETRY_DELAYS_MINUTES[attempt] ?? null;
}

/** Tidpunkt för nästa återförsök, eller null när försöken är slut. */
export function nextRetryAt(now: Date, attempt: number): string | null {
  const delay = retryDelayMinutes(attempt);
  if (delay === null) return null;
  return new Date(now.getTime() + delay * 60_000).toISOString();
}
