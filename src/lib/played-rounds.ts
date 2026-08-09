import type { HistoryRow } from "@/lib/history-stats";

/**
 * Rena hjälpfunktioner för omgångar som spelats i Travhubben (round_settlements).
 * Används både i historiklistan och i statistiken så att bilden blir densamma.
 */

export type SettlementRow = {
  id: string;
  round_id: string;
  race_date: string;
  track_name?: string | null;
  status?: string | null;
  winners?: unknown;
  system_cost?: number | string | null;
  total_cost?: number | string | null;
  payout_total?: number | string | null;
  net?: number | string | null;
  calculation?: any;
  created_at?: string | null;
};

/** En avräkning per omgång – den senast skapade vinner. */
export function dedupeSettlements<T extends SettlementRow>(rows: T[]): T[] {
  const byRound = new Map<string, T>();
  for (const r of rows ?? []) {
    const key = r.round_id ?? r.id;
    const prev = byRound.get(key);
    if (!prev || String(r.created_at ?? "") > String(prev.created_at ?? "")) byRound.set(key, r);
  }
  return [...byRound.values()].sort((a, b) => String(b.race_date).localeCompare(String(a.race_date)));
}

const startNumber = (v: unknown): number | null => {
  const m = String(v ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

/** Vinnarens startnummer per avdelning. */
export function winnersByLeg(winners: unknown): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const w of (Array.isArray(winners) ? winners : []) as any[]) {
    const first = Array.isArray(w?.winners) ? w.winners[0] : null;
    if (w?.leg != null) map.set(Number(w.leg), startNumber(first));
  }
  return map;
}

/** Gör om en avräkning till samma form som importerad historik. */
export function settlementToHistoryRow(r: SettlementRow): HistoryRow {
  const calc = (r.calculation ?? {}) as any;
  const wl = winnersByLeg(r.winners);
  const legs = ((calc.legs ?? []) as any[]).map((leg: any) => {
    const selected = ((leg.active ?? []) as any[])
      .map((a: any) => startNumber(a?.startNumber ?? a?.label))
      .filter((n): n is number => n != null);
    return {
      leg: Number(leg.leg),
      selected,
      winner: wl.get(Number(leg.leg)) ?? null,
      spike: selected.length === 1,
    };
  });
  return {
    id: r.id,
    race_date: r.race_date,
    track_name: r.track_name ?? null,
    correct_count: calc.correctLegs ?? null,
    payout: r.payout_total ?? null,
    net_result: r.net ?? null,
    computed_cost: r.total_cost ?? r.system_cost ?? null,
    stated_cost: null,
    computed_rows: calc.totalRows ?? null,
    stated_rows: null,
    winners_verified: true,
    usable_for_learning: true,
    review_status: "active",
    legs,
  };
}
