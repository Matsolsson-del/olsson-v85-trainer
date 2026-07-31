/**
 * Textetiketter för systemförslag (spikar och garderingar).
 * Ren funktion utan beroenden så att den kan testas.
 *
 * Regel: texten får ALDRIG innehålla "undefined", "null" eller "NaN",
 * oavsett hur trasig indatan är. Äldre systemförslag saknar t.ex. fältet
 * `count` och har bara `entry_ids`.
 */

export type SpikeLike = {
  leg_number?: unknown;
  entry_id?: unknown;
};

export type HedgeLike = {
  leg_number?: unknown;
  count?: unknown;
  entry_ids?: unknown;
};

/** Läser avdelningsnumret, eller null om det saknas/är trasigt. */
export function legNumberOf(item: { leg_number?: unknown } | null | undefined): number | null {
  const n = Number((item as any)?.leg_number);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Antal hästar i en gardering: `count` om den finns, annars längden på entry_ids. */
export function hedgeHorseCount(hedge: HedgeLike | null | undefined): number | null {
  const raw = Number((hedge as any)?.count);
  if (Number.isFinite(raw) && raw > 0) return Math.trunc(raw);
  const ids = (hedge as any)?.entry_ids;
  if (Array.isArray(ids) && ids.length > 0) return ids.length;
  return null;
}

const legLabel = (leg: number | null) => (leg == null ? "avd ?" : `avd ${leg}`);

const horseWord = (n: number) => (n === 1 ? "1 häst" : `${n} hästar`);

/** "avd 1: 3 hästar · avd 2: 4 hästar" */
export function formatHedges(hedges: unknown): string {
  const list = Array.isArray(hedges) ? (hedges as HedgeLike[]) : [];
  const parts = list
    .filter((h) => h && typeof h === "object")
    .map((h) => {
      const count = hedgeHorseCount(h);
      return `${legLabel(legNumberOf(h))}: ${count == null ? "okänt antal hästar" : horseWord(count)}`;
    });
  return parts.length === 0 ? "Inga garderingar" : parts.join(" · ");
}

/** "avd 3: 5 Mellby Mammon · avd 6: 2 Ellen" */
export function formatSpikes(spikes: unknown, entryLabel: (id: string) => string): string {
  const list = Array.isArray(spikes) ? (spikes as SpikeLike[]) : [];
  const parts = list
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const id = typeof s.entry_id === "string" ? s.entry_id : "";
      let label = "";
      try {
        label = id ? String(entryLabel(id) ?? "") : "";
      } catch {
        label = "";
      }
      label = label.replace(/\b(undefined|null|NaN)\b/g, "").trim();
      return `${legLabel(legNumberOf(s))}: ${label || "häst"}`;
    });
  return parts.length === 0 ? "Inga spikar" : parts.join(" · ");
}
