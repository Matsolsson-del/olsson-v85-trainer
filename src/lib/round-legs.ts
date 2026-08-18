/**
 * Ren logik för avdelningsvis redovisning av en spelad omgång.
 *
 * All data kommer från den låsta systemversionen och det officiella facit som
 * redan sparats i round_settlements. Inget gissas här.
 */

export type RoundLeg = {
  leg: number;
  /** Vinnarens startnummer och namn, t.ex. "2 Conrads Åke". Null om facit saknas. */
  winnerLabel: string | null;
  /** Gruppens gällande val efter strykningar, t.ex. ["2 Conrads Åke", "7 GooGoo Fairytale"]. */
  picks: string[];
  /** Startnummer för gruppens val. */
  pickNumbers: number[];
  hit: boolean | null;
  spike: boolean;
  decided: boolean;
};

type AnyRec = Record<string, any>;

const startNumber = (v: unknown): number | null => {
  const m = String(v ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

/** Vinnaretiketter per avdelning ur settlement.winners. */
function winnerLabelByLeg(winners: unknown): Map<number, string | null> {
  const map = new Map<number, string | null>();
  for (const w of (Array.isArray(winners) ? winners : []) as AnyRec[]) {
    if (w?.leg == null) continue;
    const list = Array.isArray(w.winners) ? w.winners : [];
    const label = list.length ? list.map((x: unknown) => String(x)).join(" / ") : null;
    map.set(Number(w.leg), label);
  }
  return map;
}

/** Bygger avdelning 1–8 ur en sparad avräkning. */
export function buildRoundLegs(calculation: unknown, winners: unknown): RoundLeg[] {
  const calc = (calculation ?? {}) as AnyRec;
  const labels = winnerLabelByLeg(winners);
  const legs = Array.isArray(calc['legs']) ? (calc['legs'] as AnyRec[]) : [];
  return legs
    .map((l): RoundLeg => {
      const active = Array.isArray(l['active']) ? (l['active'] as AnyRec[]) : [];
      const picks = active.map((a) => String(a['label'] ?? a['startNumber'] ?? "")).filter(Boolean);
      const pickNumbers = active
        .map((a) => startNumber(a['startNumber'] ?? a['label']))
        .filter((n): n is number => n != null);
      const legNumber = Number(l['leg']);
      return {
        leg: legNumber,
        winnerLabel: labels.get(legNumber) ?? null,
        picks,
        pickNumbers,
        hit: typeof l['hit'] === "boolean" ? (l['hit'] as boolean) : null,
        spike: picks.length === 1,
        decided: l['decided'] !== false,
      };
    })
    .sort((a, b) => a.leg - b.leg);
}

/** Högst tre deterministiska punkter om vad som avgjorde omgången. */
export function decisiveNotes(legs: RoundLeg[]): string[] {
  const decided = legs.filter((l) => l.decided && l.hit !== null);
  if (decided.length === 0) return [];

  const missed = decided.filter((l) => l.hit === false);
  const failedSpikes = missed.filter((l) => l.spike);
  const notes: string[] = [];

  if (failedSpikes.length > 0) {
    notes.push(
      `Spiken föll i ${failedSpikes.length === 1 ? "avdelning" : "avdelningarna"} ${failedSpikes
        .map((l) => l.leg)
        .join(", ")}.`,
    );
  }

  const otherMissed = missed.filter((l) => !l.spike);
  if (otherMissed.length > 0) {
    notes.push(
      `Vinnaren saknades i ${otherMissed.length === 1 ? "avdelning" : "avdelningarna"} ${otherMissed
        .map((l) => l.leg)
        .join(", ")}.`,
    );
  }

  const hits = decided.filter((l) => l.hit === true).length;
  notes.push(`Övriga ${hits} av ${decided.length} avdelningar satt.`);

  return notes.slice(0, 3);
}

/** Kronor: visar 0 kr när värdet är känt och noll, streck bara när data saknas. */
export function krOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "–";
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

/** Första tydliga lärdomen ur efterrapporten. */
export function firstLesson(text: unknown): string | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const first = raw
    .split(/\r?\n|(?<=\.)\s+(?=[A-ZÅÄÖ0-9])/)
    .map((s) => s.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .find((s) => s.length > 0);
  return first ?? null;
}
