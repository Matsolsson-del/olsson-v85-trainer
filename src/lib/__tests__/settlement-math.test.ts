import { describe, expect, it } from "vitest";
import {
  resolveLeg,
  rowDistribution,
  settleRound,
  validateSettlement,
  type SettlementLegInput,
} from "@/lib/settlement-math";

function pick(id: string, n: number, reserveOrder: number | null = null) {
  return { entryId: id, startNumber: n, label: `${n} Häst ${id}`, reserveOrder };
}

function leg(
  n: number,
  picks: ReturnType<typeof pick>[],
  winners: string[],
  scratched: string[] = [],
): SettlementLegInput {
  return { leg: n, picks, winnerEntryIds: winners, scratchedEntryIds: scratched };
}

describe("resolveLeg", () => {
  it("behåller ordinarie val när inget är struket", () => {
    const r = resolveLeg(leg(1, [pick("a", 1), pick("b", 2), pick("c", 5, 1)], ["a"]));
    expect(r.activeCount).toBe(2);
    expect(r.activatedReserves).toHaveLength(0);
    expect(r.hit).toBe(true);
  });

  it("aktiverar reserv när ordinarie häst stryks", () => {
    const r = resolveLeg(leg(1, [pick("a", 1), pick("b", 2), pick("c", 5, 1)], ["c"], ["a"]));
    expect(r.activeCount).toBe(2);
    expect(r.activatedReserves.map((p) => p.entryId)).toEqual(["c"]);
    expect(r.scratchedPicks.map((p) => p.entryId)).toEqual(["a"]);
    expect(r.hit).toBe(true);
  });

  it("hoppar över struken reserv", () => {
    const r = resolveLeg(
      leg(2, [pick("a", 1), pick("b", 3, 1), pick("c", 7, 2)], ["c"], ["a", "b"]),
    );
    expect(r.activatedReserves.map((p) => p.entryId)).toEqual(["c"]);
    expect(r.activeCount).toBe(1);
    expect(r.wasSpike).toBe(true);
    expect(r.hit).toBe(true);
  });

  it("räknar dött lopp som två träffar när båda är spelade", () => {
    const r = resolveLeg(leg(3, [pick("a", 1), pick("b", 2), pick("d", 4)], ["a", "b"]));
    expect(r.deadHeat).toBe(true);
    expect(r.hitCount).toBe(2);
    expect(r.hit).toBe(true);
  });

  it("markerar oavgjord avdelning när vinnare saknas", () => {
    const r = resolveLeg(leg(4, [pick("a", 1)], []));
    expect(r.decided).toBe(false);
    expect(r.hit).toBeNull();
  });
});

describe("rowDistribution", () => {
  it("ger rätt antal rader per rättnivå", () => {
    const legs = [
      resolveLeg(leg(1, [pick("a", 1), pick("b", 2)], ["a"])),
      resolveLeg(leg(2, [pick("c", 1), pick("d", 2)], ["z"])),
    ];
    const dist = rowDistribution(legs);
    // 2 x 2 = 4 rader: 0 rätt = 1, 1 rätt = 2, 2 rätt = 1? Nej: avd 2 har 0 träffar.
    expect(dist[1]).toBe(2);
    expect(dist[0]).toBe(2);
    expect(dist.reduce((a, b) => a + b, 0)).toBe(4);
  });
});

const payouts = { 8: 100000, 7: 500, 6: 40, 5: 8 };

function eightLegs(spec: Array<[number, string[], string[]]>) {
  return spec.map(([n, ids, winners]) =>
    leg(
      n,
      ids.map((id, i) => pick(id, i + 1)),
      winners,
    ),
  );
}

describe("settleRound", () => {
  it("räknar rader, spikar och utbetalning på flera nivåer", () => {
    const legs = eightLegs([
      [1, ["a1", "a2"], ["a1"]],
      [2, ["b1", "b2"], ["b1"]],
      [3, ["c1"], ["c1"]],
      [4, ["d1", "d2"], ["d9"]],
      [5, ["e1", "e2"], ["e1"]],
      [6, ["f1"], ["f1"]],
      [7, ["g1", "g2"], ["g1"]],
      [8, ["h1", "h2"], ["h1"]],
    ]);
    const r = settleRound({ legs, payouts, rowPrice: 0.5, fee: 0 });
    expect(r.totalRows).toBe(64);
    expect(r.correctLegs).toBe(7);
    expect(r.wrongLegs).toEqual([4]);
    expect(r.spikes).toBe(2);
    expect(r.winningSpikes).toBe(2);
    expect(r.rowsByLevel[8]).toBe(0);
    expect(r.rowsByLevel[7]).toBe(1);
    expect(r.rowsByLevel[6]).toBe(6);
    expect(r.payoutTotal).toBe(500 + 6 * 40);
    expect(r.systemCost).toBe(32);
    expect(r.net).toBe(740 - 32);
    expect(r.returnPercent).toBeGreaterThan(2000);
  });

  it("hanterar spik som faller", () => {
    const legs = eightLegs([
      [1, ["a1"], ["x"]],
      [2, ["b1"], ["b1"]],
      [3, ["c1"], ["c1"]],
      [4, ["d1"], ["d1"]],
      [5, ["e1"], ["e1"]],
      [6, ["f1"], ["f1"]],
      [7, ["g1"], ["g1"]],
      [8, ["h1"], ["h1"]],
    ]);
    const r = settleRound({ legs, payouts, rowPrice: 0.5 });
    expect(r.failedSpikes).toEqual([1]);
    expect(r.rowsByLevel[7]).toBe(1);
    expect(r.payoutTotal).toBe(500);
  });

  it("räknar Harry Boy-avgift och netto", () => {
    const legs = eightLegs([
      [1, ["a1"], ["a1"]],
      [2, ["b1"], ["b1"]],
      [3, ["c1"], ["c1"]],
      [4, ["d1"], ["d1"]],
      [5, ["e1"], ["e1"]],
      [6, ["f1"], ["f1"]],
      [7, ["g1"], ["g1"]],
      [8, ["h1"], ["h1"]],
    ]);
    const r = settleRound({ legs, payouts, rowPrice: 0.5, fee: 20, knownSystemCost: 450 });
    expect(r.rowsByLevel[8]).toBe(1);
    expect(r.totalCost).toBe(470);
    expect(r.net).toBe(100000 - 470);
  });

  it("ger noll utbetalning när utdelning saknas på en nivå", () => {
    const legs = eightLegs([
      [1, ["a1", "a2"], ["x"]],
      [2, ["b1"], ["b1"]],
      [3, ["c1"], ["c1"]],
      [4, ["d1"], ["d1"]],
      [5, ["e1"], ["e1"]],
      [6, ["f1"], ["f1"]],
      [7, ["g1"], ["g1"]],
      [8, ["h1"], ["h1"]],
    ]);
    const r = settleRound({ legs, payouts: { 8: 100000 }, rowPrice: 0.5 });
    expect(r.rowsByLevel[7]).toBe(2);
    expect(r.payoutTotal).toBe(0);
  });
});

describe("validateSettlement", () => {
  it("klagar när vinnare eller utdelning saknas", () => {
    const legs = eightLegs([
      [1, ["a1"], []],
      [2, ["b1"], ["b1"]],
      [3, ["c1"], ["c1"]],
      [4, ["d1"], ["d1"]],
      [5, ["e1"], ["e1"]],
      [6, ["f1"], ["f1"]],
      [7, ["g1"], ["g1"]],
      [8, ["h1"], ["h1"]],
    ]);
    const result = settleRound({ legs, payouts: {}, rowPrice: 0.5 });
    const issues = validateSettlement({
      legs,
      payouts: {},
      result,
      raceDate: "2026-08-01",
      trackName: "Rättvik",
    });
    expect(issues.some((i) => i.includes("Vinnare saknas"))).toBe(true);
    expect(issues.some((i) => i.includes("åtta rätt"))).toBe(true);
    expect(result.complete).toBe(false);
  });

  it("godkänner en komplett omgång", () => {
    const legs = eightLegs([
      [1, ["a1"], ["a1"]],
      [2, ["b1"], ["b1"]],
      [3, ["c1"], ["c1"]],
      [4, ["d1"], ["d1"]],
      [5, ["e1"], ["e1"]],
      [6, ["f1"], ["f1"]],
      [7, ["g1"], ["g1"]],
      [8, ["h1"], ["h1"]],
    ]);
    const result = settleRound({ legs, payouts, rowPrice: 0.5 });
    expect(
      validateSettlement({
        legs,
        payouts,
        result,
        raceDate: "2026-08-01",
        trackName: "Rättvik",
      }),
    ).toEqual([]);
    expect(result.complete).toBe(true);
  });
});
