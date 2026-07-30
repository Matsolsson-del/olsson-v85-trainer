/**
 * Manuell reservimport: tolkar inklistrad startlista och spelfördelning.
 * Samma utdataformat som en framtida källadapter ska leverera.
 */

export type ParsedEntry = {
  startNumber: number;
  horseName: string;
  driverName?: string;
  trainerName?: string;
  postPosition?: number;
  baseDistanceM?: number;
  scratched: boolean;
};

export type ParsedOdds = {
  startNumber: number;
  betSharePercent: number;
};

export type ParseResult<T> = {
  rows: T[];
  errors: string[];
};

const NUMBER = /^(\d{1,2})[.:)\s]+/;

function toNumber(raw: string): number | undefined {
  const n = Number(raw.replace(",", ".").replace("%", "").trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Rad-format (tolerant):
 *   1 Hästnamn (Kusk Kusksson) [Tränare] 2140
 *   2. Hästnamn - Kusk Kusksson
 * Prefixa raden med "STRUKEN" eller "S:" för struken häst.
 */
export function parseStartList(text: string): ParseResult<ParsedEntry> {
  const rows: ParsedEntry[] = [];
  const errors: string[] = [];
  const seen = new Set<number>();

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;

    let scratched = false;
    const scratchMatch = line.match(/^(struken|struket|s)\s*[:\-]\s*/i);
    if (scratchMatch) {
      scratched = true;
      line = line.slice(scratchMatch[0].length).trim();
    }

    const numMatch = line.match(NUMBER);
    if (!numMatch) {
      errors.push(`Kunde inte läsa startnummer: "${rawLine.trim()}"`);
      continue;
    }
    const startNumber = Number(numMatch[1]);
    line = line.slice(numMatch[0].length).trim();

    let driverName: string | undefined;
    const driverParen = line.match(/\(([^)]+)\)/);
    if (driverParen) {
      driverName = driverParen[1].trim();
      line = line.replace(driverParen[0], " ").trim();
    }

    let trainerName: string | undefined;
    const trainerBracket = line.match(/\[([^\]]+)\]/);
    if (trainerBracket) {
      trainerName = trainerBracket[1].trim();
      line = line.replace(trainerBracket[0], " ").trim();
    }

    let baseDistanceM: number | undefined;
    const distMatch = line.match(/\b(1[0-9]{3}|2[0-9]{3}|3[0-9]{3})\b\s*$/);
    if (distMatch) {
      baseDistanceM = Number(distMatch[1]);
      line = line.slice(0, distMatch.index).trim();
    }

    if (!driverName) {
      const dashSplit = line.split(/\s+[-–]\s+/);
      if (dashSplit.length > 1) {
        driverName = dashSplit.pop()!.trim();
        line = dashSplit.join(" - ").trim();
      }
    }

    const horseName = line.replace(/[\s,;]+$/, "").trim();
    if (!horseName) {
      errors.push(`Saknar hästnamn: "${rawLine.trim()}"`);
      continue;
    }
    if (seen.has(startNumber)) {
      errors.push(`Dubblett på startnummer ${startNumber}.`);
      continue;
    }
    seen.add(startNumber);

    rows.push({
      startNumber,
      horseName,
      driverName: driverName || undefined,
      trainerName: trainerName || undefined,
      postPosition: startNumber,
      baseDistanceM,
      scratched,
    });
  }

  return { rows, errors };
}

/**
 * Rad-format: "1 12,5" / "1: 12.5%" / "1 - 12,5 %"
 */
export function parseOdds(text: string): ParseResult<ParsedOdds> {
  const rows: ParsedOdds[] = [];
  const errors: string[] = [];
  const seen = new Set<number>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(\d{1,2})\s*[.:)\-–\s]\s*([\d.,]+)\s*%?$/);
    if (!match) {
      errors.push(`Kunde inte läsa raden: "${line}"`);
      continue;
    }
    const startNumber = Number(match[1]);
    const value = toNumber(match[2]);
    if (value === undefined || value < 0 || value > 100) {
      errors.push(`Ogiltig spelprocent på start ${startNumber}.`);
      continue;
    }
    if (seen.has(startNumber)) {
      errors.push(`Dubblett på startnummer ${startNumber}.`);
      continue;
    }
    seen.add(startNumber);
    rows.push({ startNumber, betSharePercent: value });
  }

  return { rows, errors };
}

export type LegQuality = {
  legNumber: number;
  raceId: string;
  entryCount: number;
  missing: string[];
  score: number;
};

export type QualityReport = {
  legs: LegQuality[];
  score: number;
  missingFields: string[];
  warnings: string[];
  sufficientForFinal: boolean;
};

/** Datakvalitet per avdelning – styr om AI-analys och slutligt system får göras. */
export function assessRoundQuality(races: any[]): QualityReport {
  const legs: LegQuality[] = [];
  const warnings: string[] = [];

  for (const race of [...races].sort((a, b) => a.leg_number - b.leg_number)) {
    const entries = (race.race_entries ?? []).filter((e: any) => !e.scratched);
    const missing: string[] = [];

    if (entries.length < 5) missing.push("startfält");
    if (!race.start_at) missing.push("starttid");
    if (!race.distance_m) missing.push("distans");
    if (entries.some((e: any) => !e.driver_id)) missing.push("kusk");
    const withOdds = entries.filter((e: any) => (e.market_snapshots ?? []).length > 0).length;
    if (entries.length > 0 && withOdds < entries.length) missing.push("spelfördelning");

    const score = Math.max(0, 100 - missing.length * 20);
    legs.push({
      legNumber: race.leg_number,
      raceId: race.id,
      entryCount: entries.length,
      missing,
      score,
    });
    if (missing.length > 0)
      warnings.push(`Avdelning ${race.leg_number}: saknar ${missing.join(", ")}.`);
  }

  const score = legs.length ? Math.round(legs.reduce((s, l) => s + l.score, 0) / legs.length) : 0;
  const missingFields = Array.from(new Set(legs.flatMap((l) => l.missing)));

  return {
    legs,
    score,
    missingFields,
    warnings,
    sufficientForFinal: legs.length > 0 && legs.every((l) => l.entryCount >= 5) && score >= 80,
  };
}
