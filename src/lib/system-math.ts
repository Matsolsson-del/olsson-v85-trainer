/**
 * Systemmatematik för V85.
 * rows = produkten av antalet valda hästar i varje avdelning
 * cost = rows * row_price
 */

export type LegSelection = { raceId: string; entryIds: string[] };

export function calculateRows(selections: LegSelection[], legCount = 8): number {
  if (selections.length === 0) return 0;
  const counts = selections.map((s) => s.entryIds.length);
  if (counts.some((c) => c === 0)) return 0;
  if (selections.length < legCount) return 0;
  return counts.reduce((a, b) => a * b, 1);
}

/** Decimalsäker kostnad: räknar i ören. */
export function calculateCost(rows: number, rowPrice: number): number {
  const priceInOre = Math.round(rowPrice * 100);
  return (rows * priceInOre) / 100;
}

export function spikeCount(selections: LegSelection[]): number {
  return selections.filter((s) => s.entryIds.length === 1).length;
}

/** Täckning per avdelning = summan av gruppens vinstchans för valda hästar (0–1). */
export function legCoverage(selectedProbabilities: number[]): number {
  return selectedProbabilities.reduce((a, b) => a + b, 0) / 100;
}

/** Ungefärlig total täckning = produkten av avdelningarnas täckning (modellindikator). */
export function approximateCoverage(legCoverages: number[]): number {
  if (legCoverages.length === 0) return 0;
  return legCoverages.reduce((a, b) => a * b, 1);
}

/** Kostnaden för att lägga till ytterligare en häst i en given avdelning. */
export function costOfAddingHorse(
  selections: LegSelection[],
  raceId: string,
  rowPrice: number,
): number {
  const current = calculateRows(selections, selections.length);
  const leg = selections.find((s) => s.raceId === raceId);
  if (!leg || leg.entryIds.length === 0 || current === 0) return 0;
  const next = (current / leg.entryIds.length) * (leg.entryIds.length + 1);
  return calculateCost(next - current, rowPrice);
}

export const CALIBRATION_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "0–10", min: 0, max: 10 },
  { label: "11–20", min: 10.0001, max: 20 },
  { label: "21–30", min: 20.0001, max: 30 },
  { label: "31–40", min: 30.0001, max: 40 },
  { label: "41–50", min: 40.0001, max: 50 },
  { label: "51–60", min: 50.0001, max: 60 },
  { label: "61–70", min: 60.0001, max: 70 },
  { label: "71–80", min: 70.0001, max: 80 },
  { label: "81–100", min: 80.0001, max: 100 },
];

export function sampleWarning(raceCount: number): string {
  if (raceCount < 30) return "Mycket litet underlag – dra inga slutsatser";
  if (raceCount < 100) return "Preliminära mönster";
  return "Tillräckligt för att formulera testbara hypoteser, inte bevisa lönsamhet";
}
