/**
 * Dubbletthantering för importerad spelhistorik.
 * Rena funktioner utan databas – används både på servern och i tester.
 *
 * Grundregel: ingen historikpost får raderas eller skrivas över automatiskt.
 * Statistik och lärande får bara använda poster som Mats har godkänt.
 */

export type ReviewStatus = "unreviewed" | "active" | "separate" | "superseded" | "archived";

/** Statusar vars poster får användas i statistik och lärande. */
export const STATS_STATUSES: ReviewStatus[] = ["active", "separate"];

export type ReviewableRow = {
  id: string;
  race_date: string;
  track_name?: string | null;
  review_status?: string | null;
};

export const duplicateKey = (r: ReviewableRow) =>
  `${(r.track_name ?? "").trim().toLowerCase()}|${String(r.race_date)}`;

/** Grupperar poster på bana + tävlingsdag och behåller bara grupper med fler än en post. */
export function findDuplicateGroups<T extends ReviewableRow>(rows: T[]): Array<{ key: string; rows: T[] }> {
  const map = new Map<string, T[]>();
  for (const r of rows ?? []) {
    const key = duplicateKey(r);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, rows: list }))
    .sort((a, b) => String(b.rows[0].race_date).localeCompare(String(a.rows[0].race_date)));
}

/** Dubbletter som ännu inte har fått ett beslut av gruppens ägare. */
export function unresolvedDuplicateGroups<T extends ReviewableRow>(rows: T[]) {
  return findDuplicateGroups(rows).filter((g) =>
    g.rows.some((r) => (r.review_status ?? "unreviewed") === "unreviewed"),
  );
}

/** Poster som statistiken får räkna på. */
export function statsRows<T extends ReviewableRow>(rows: T[]): T[] {
  return (rows ?? []).filter((r) =>
    STATS_STATUSES.includes(((r.review_status ?? "unreviewed") as ReviewStatus),),
  );
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  unreviewed: "Ogranskad",
  active: "Aktiv – används i statistiken",
  separate: "Eget system – räknas separat",
  superseded: "Ersatt av annan post",
  archived: "Arkiverad – används inte",
};
