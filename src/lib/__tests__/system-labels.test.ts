import { describe, expect, it } from "vitest";
import { formatHedges, formatSpikes, hedgeHorseCount } from "@/lib/system-labels";

const FORBIDDEN = /undefined|null|NaN/;

describe("formatHedges", () => {
  it("räknar hästar från entry_ids när count saknas", () => {
    const text = formatHedges([
      { leg_number: 1, entry_ids: ["a", "b", "c"] },
      { leg_number: 2, count: 4, entry_ids: ["a", "b", "c", "d"] },
    ]);
    expect(text).toBe("avd 1: 3 hästar · avd 2: 4 hästar");
  });

  it("skriver 1 häst i singular", () => {
    expect(formatHedges([{ leg_number: 5, entry_ids: ["x"] }])).toBe("avd 5: 1 häst");
  });

  it("ger tom-text när inget finns", () => {
    expect(formatHedges([])).toBe("Inga garderingar");
    expect(formatHedges(undefined)).toBe("Inga garderingar");
    expect(formatHedges(null)).toBe("Inga garderingar");
  });

  const broken: unknown[] = [
    undefined,
    null,
    [],
    [{}],
    [{ leg_number: undefined, count: undefined }],
    [{ leg_number: null, count: null, entry_ids: null }],
    [{ leg_number: "x", count: "y", entry_ids: "z" }],
    [{ leg_number: NaN, count: NaN, entry_ids: [] }],
    [{ leg_number: 3 }],
    [null, undefined, { leg_number: 2, entry_ids: ["a"] }],
    "inte en lista",
    { leg_number: 1 },
  ];

  broken.forEach((value, i) => {
    it(`innehåller aldrig undefined/null/NaN (fall ${i})`, () => {
      expect(formatHedges(value)).not.toMatch(FORBIDDEN);
    });
  });
});

describe("hedgeHorseCount", () => {
  it("returnerar null när antalet inte går att räkna ut", () => {
    expect(hedgeHorseCount({})).toBeNull();
    expect(hedgeHorseCount(null)).toBeNull();
    expect(hedgeHorseCount({ count: "abc", entry_ids: [] })).toBeNull();
  });
});

describe("formatSpikes", () => {
  const label = (id: string) => (id === "ok" ? "5 Mellby Mammon" : (undefined as unknown as string));

  it("visar avdelning och häst", () => {
    expect(formatSpikes([{ leg_number: 3, entry_id: "ok" }], label)).toBe("avd 3: 5 Mellby Mammon");
  });

  const broken: unknown[] = [
    undefined,
    null,
    [],
    [{}],
    [{ leg_number: null, entry_id: null }],
    [{ leg_number: "a", entry_id: 7 }],
    [{ leg_number: 2, entry_id: "saknas" }],
    [{ leg_number: NaN, entry_id: undefined }],
  ];

  broken.forEach((value, i) => {
    it(`innehåller aldrig undefined/null/NaN (fall ${i})`, () => {
      expect(formatSpikes(value, label)).not.toMatch(FORBIDDEN);
    });
  });

  it("tål att etikettfunktionen kastar", () => {
    const text = formatSpikes([{ leg_number: 1, entry_id: "x" }], () => {
      throw new Error("trasig");
    });
    expect(text).not.toMatch(FORBIDDEN);
  });
});
