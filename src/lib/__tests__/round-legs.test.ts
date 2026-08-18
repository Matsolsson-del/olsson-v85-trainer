import { describe, expect, it } from "vitest";
import { buildRoundLegs, decisiveNotes, firstLesson, krOrDash } from "@/lib/round-legs";

const calculation = {
  legs: [
    {
      leg: 2,
      hit: false,
      decided: true,
      active: [{ label: "4 Bosse", startNumber: 4, entryId: "b" }],
    },
    {
      leg: 1,
      hit: true,
      decided: true,
      active: [
        { label: "2 Conrads Åke", startNumber: 2, entryId: "a" },
        { label: "7 GooGoo", startNumber: 7, entryId: "c" },
      ],
    },
    {
      leg: 3,
      hit: false,
      decided: true,
      active: [
        { label: "1 Ada", startNumber: 1, entryId: "d" },
        { label: "5 Ella", startNumber: 5, entryId: "e" },
      ],
    },
  ],
};

const winners = [
  { leg: 1, winners: ["2 Conrads Åke"] },
  { leg: 2, winners: ["9 Annan"] },
  { leg: 3, winners: ["8 Tredje"] },
];

describe("buildRoundLegs", () => {
  it("sorterar avdelningar och kopplar vinnare, val och spik", () => {
    const legs = buildRoundLegs(calculation, winners);
    expect(legs.map((l) => l.leg)).toEqual([1, 2, 3]);
    expect(legs[0]!.hit).toBe(true);
    expect(legs[0]!.spike).toBe(false);
    expect(legs[0]!.winnerLabel).toBe("2 Conrads Åke");
    expect(legs[0]!.pickNumbers).toEqual([2, 7]);
    expect(legs[1]!.spike).toBe(true);
    expect(legs[1]!.hit).toBe(false);
  });

  it("ger tom lista när avräkning saknas", () => {
    expect(buildRoundLegs(null, null)).toEqual([]);
    expect(buildRoundLegs({}, [])).toEqual([]);
  });

  it("saknad vinnare blir null i stället för gissning", () => {
    const legs = buildRoundLegs({ legs: [{ leg: 1, decided: false, active: [] }] }, []);
    expect(legs[0]!.winnerLabel).toBeNull();
    expect(legs[0]!.hit).toBeNull();
    expect(legs[0]!.decided).toBe(false);
  });
});

describe("decisiveNotes", () => {
  it("ger högst tre deterministiska punkter", () => {
    const notes = decisiveNotes(buildRoundLegs(calculation, winners));
    expect(notes.length).toBeLessThanOrEqual(3);
    expect(notes[0]).toContain("Spiken föll i avdelning 2");
    expect(notes[1]).toContain("Vinnaren saknades i avdelning 3");
    expect(notes[2]).toBe("Övriga 1 av 3 avdelningar satt.");
  });

  it("ger inget när facit saknas", () => {
    expect(decisiveNotes(buildRoundLegs({ legs: [{ leg: 1, decided: false, active: [] }] }, []))).toEqual([]);
  });
});

describe("krOrDash", () => {
  it("visar 0 kr när värdet är känt och noll", () => {
    expect(krOrDash(0)).toMatch(/0/);
    expect(krOrDash(0)).not.toBe("–");
  });

  it("visar streck bara när data saknas", () => {
    expect(krOrDash(null)).toBe("–");
    expect(krOrDash(undefined)).toBe("–");
  });

  it("avrundar kronor", () => {
    expect(krOrDash(148)).toMatch(/148/);
  });
});

describe("firstLesson", () => {
  it("plockar första punkten ur en lista", () => {
    expect(firstLesson("- Spela färre spikar\n- Höj budget")).toBe("Spela färre spikar");
  });
  it("returnerar null när text saknas", () => {
    expect(firstLesson("   ")).toBeNull();
    expect(firstLesson(null)).toBeNull();
  });
});
