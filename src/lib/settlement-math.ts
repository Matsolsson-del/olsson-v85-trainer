/**
 * Maskinell radberäkning för V85.
 *
 * All matematik här är ren och testbar. Ingen AI får räkna ut de här talen.
 * Hanterar strykningar (reserv går in i ordinarie plats), dött lopp (flera
 * vinnare i samma avdelning) och utdelning på flera rättnivåer.
 */

export type SettlementPick = {
  entryId: string;
  startNumber: number;
  label: string;
  /** null = ordinarie val, 1,2,3… = reservordning */
  reserveOrder: number | null;
};

export type SettlementLegInput = {
  leg: number;
  picks: SettlementPick[];
  /** Entry-id för vinnaren/vinnarna (flera vid dött lopp). */
  winnerEntryIds: string[];
  /** Entry-id för strukna hästar i avdelningen. */
  scratchedEntryIds: string[];
};

export type SettlementLegResult = {
  leg: number;
  /** Hästar som faktiskt gällde efter strykningar och reservinträde. */
  active: SettlementPick[];
  activeCount: number;
  /** Reserver som gick in i stället för struken ordinarie häst. */
  activatedReserves: SettlementPick[];
  /** Ordinarie val som ströks. */
  scratchedPicks: SettlementPick[];
  winners: string[];
  /** Antal spelade hästar som vann (>1 vid dött lopp där båda var spelade). */
  hitCount: number;
  hit: boolean | null;
  wasSpike: boolean;
  deadHeat: boolean;
  decided: boolean;
};

export type PayoutTable = {
  /** Utdelning i kronor per rad med 8, 7, 6 respektive 5 rätt. */
  8?: number | null;
  7?: number | null;
  6?: number | null;
  5?: number | null;
};

export type SettlementResult = {
  legs: SettlementLegResult[];
  decidedLegs: number;
  correctLegs: number;
  wrongLegs: number[];
  correctLegNumbers: number[];
  spikes: number;
  winningSpikes: number;
  failedSpikes: number[];
  totalRows: number;
  /** Antal systemrader per rättnivå (nyckel 8,7,6,5). */
  rowsByLevel: Record<number, number>;
  payoutByLevel: Record<number, number>;
  payoutTotal: number;
  systemCost: number;
  fee: number;
  totalCost: number;
  net: number;
  returnPercent: number;
  complete: boolean;
};

/** Räknar ut vilka hästar som faktiskt gällde efter strykningar. */
export function resolveLeg(input: SettlementLegInput): SettlementLegResult {
  const scratched = new Set(input.scratchedEntryIds);
  const ordinary = input.picks.filter((p) => p.reserveOrder === null);
  const reserves = input.picks
    .filter((p) => p.reserveOrder !== null)
    .sort((a, b) => (a.reserveOrder ?? 0) - (b.reserveOrder ?? 0));

  const keptOrdinary = ordinary.filter((p) => !scratched.has(p.entryId));
  const scratchedPicks = ordinary.filter((p) => scratched.has(p.entryId));

  const activatedReserves: SettlementPick[] = [];
  const availableReserves = reserves.filter((r) => !scratched.has(r.entryId));
  for (let i = 0; i < scratchedPicks.length && i < availableReserves.length; i++) {
    activatedReserves.push(availableReserves[i]!);
  }

  const active = [...keptOrdinary, ...activatedReserves].sort(
    (a, b) => a.startNumber - b.startNumber,
  );
  const winners = input.winnerEntryIds.filter(Boolean);
  const hitCount = active.filter((p) => winners.includes(p.entryId)).length;

  return {
    leg: input.leg,
    active,
    activeCount: active.length,
    activatedReserves,
    scratchedPicks,
    winners,
    hitCount,
    hit: winners.length === 0 ? null : hitCount > 0,
    wasSpike: keptOrdinary.length + activatedReserves.length === 1,
    deadHeat: winners.length > 1,
    decided: winners.length > 0,
  };
}

/**
 * Fördelning av systemets rader per antal rätt.
 * Returnerar en array där index = antal rätt.
 */
export function rowDistribution(legs: SettlementLegResult[]): number[] {
  let dist = [1];
  for (const leg of legs) {
    const hits = Math.min(leg.hitCount, leg.activeCount);
    const misses = Math.max(leg.activeCount - hits, 0);
    const next = new Array(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      if (dist[k] === 0) continue;
      next[k] += dist[k]! * misses;
      next[k + 1] += dist[k]! * hits;
    }
    dist = next;
  }
  return dist;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Kör hela uträkningen för en omgång. */
export function settleRound(params: {
  legs: SettlementLegInput[];
  payouts: PayoutTable;
  rowPrice: number;
  fee?: number;
  /** Kostnad enligt kvitto, om den är känd. Annars räknas rader × radpris. */
  knownSystemCost?: number | null;
}): SettlementResult {
  const legs = params.legs.map(resolveLeg);
  const decidedLegs = legs.filter((l) => l.decided).length;
  const correct = legs.filter((l) => l.hit === true);
  const dist = rowDistribution(legs);
  const totalRows = legs.reduce((acc, l) => acc * Math.max(l.activeCount, 0), 1);

  const rowsByLevel: Record<number, number> = {};
  const payoutByLevel: Record<number, number> = {};
  let payoutTotal = 0;
  for (const level of [8, 7, 6, 5] as const) {
    const rows = dist[level] ?? 0;
    rowsByLevel[level] = rows;
    const per = params.payouts[level];
    const amount = rows > 0 && typeof per === "number" ? round2(rows * per) : 0;
    payoutByLevel[level] = amount;
    payoutTotal += amount;
  }
  payoutTotal = round2(payoutTotal);

  const systemCost =
    typeof params.knownSystemCost === "number"
      ? round2(params.knownSystemCost)
      : round2((totalRows * Math.round(params.rowPrice * 100)) / 100);
  const fee = round2(params.fee ?? 0);
  const totalCost = round2(systemCost + fee);
  const net = round2(payoutTotal - totalCost);

  return {
    legs,
    decidedLegs,
    correctLegs: correct.length,
    correctLegNumbers: correct.map((l) => l.leg),
    wrongLegs: legs.filter((l) => l.hit === false).map((l) => l.leg),
    spikes: legs.filter((l) => l.wasSpike).length,
    winningSpikes: legs.filter((l) => l.wasSpike && l.hit === true).length,
    failedSpikes: legs.filter((l) => l.wasSpike && l.hit === false).map((l) => l.leg),
    totalRows,
    rowsByLevel,
    payoutByLevel,
    payoutTotal,
    systemCost,
    fee,
    totalCost,
    net,
    returnPercent: totalCost > 0 ? round2((payoutTotal / totalCost) * 100) : 0,
    complete: decidedLegs === legs.length && legs.length === 8,
  };
}

/** Kontroller som måste gå igenom innan ett resultat får sparas permanent. */
export function validateSettlement(params: {
  legs: SettlementLegInput[];
  payouts: PayoutTable;
  result: SettlementResult;
  raceDate: string | null;
  trackName: string | null;
}): string[] {
  const issues: string[] = [];
  if (params.legs.length !== 8) issues.push("Omgången har inte åtta avdelningar.");
  const undecided = params.result.legs.filter((l) => !l.decided).map((l) => l.leg);
  if (undecided.length > 0) issues.push(`Vinnare saknas i avdelning ${undecided.join(", ")}.`);
  for (const leg of params.legs) {
    for (const w of leg.winnerEntryIds) {
      if (!w) issues.push(`Ogiltig vinnare i avdelning ${leg.leg}.`);
    }
  }
  if (!params.raceDate) issues.push("Tävlingsdatum saknas.");
  if (!params.trackName) issues.push("Bana saknas.");
  if (typeof params.payouts[8] !== "number") issues.push("Utdelningen för åtta rätt saknas.");
  if (params.result.legs.some((l) => l.activeCount === 0)) {
    issues.push("Någon avdelning saknar spelade hästar efter strykningar.");
  }
  return issues;
}

/** Verifieringsstatus i klartext. */
export const VERIFICATION_LABELS: Record<string, string> = {
  verified_official: "Verifierat mot officiell källa",
  parsed_upload: "Tolkat från uppladdning",
  partial: "Delvis verifierat",
  needs_review: "Behöver granskas",
  conflicting: "Motstridiga uppgifter",
};
