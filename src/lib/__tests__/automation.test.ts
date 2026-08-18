import { describe, expect, it } from "vitest";
import {
  SCHEDULE,
  matchSlot,
  nextRun,
  stockholmTimeToInstant,
  targetSaturday,
} from "@/lib/v85-schedule";
import { diffFacts, pickSaturdayGame, roundKey } from "@/lib/automation-core";

describe("svensk tid", () => {
  it("torsdag 07:00 sommartid är 05:00 UTC", () => {
    expect(stockholmTimeToInstant("2026-07-30", 7).toISOString()).toBe("2026-07-30T05:00:00.000Z");
  });

  it("torsdag 07:00 vintertid är 06:00 UTC", () => {
    expect(stockholmTimeToInstant("2026-01-08", 7).toISOString()).toBe("2026-01-08T06:00:00.000Z");
  });

  it("kör bara i planerade tidsfönster", () => {
    expect(matchSlot(new Date("2026-07-30T05:05:00Z"))?.mode).toBe("full");
    // Torsdag 11:00 svensk tid ligger mellan två fönster.
    expect(matchSlot(new Date("2026-07-30T09:00:00Z"))).toBeNull();
  });

  it("nästa körning ligger alltid framåt i tiden", () => {
    const now = new Date("2026-07-30T09:00:00Z");
    expect(nextRun(now).at.getTime()).toBeGreaterThan(now.getTime());
  });

  it("siktar på kommande lördag, även på lördagen själv", () => {
    expect(targetSaturday(new Date("2026-07-30T05:00:00Z"))).toBe("2026-08-01");
    expect(targetSaturday(new Date("2026-08-01T05:00:00Z"))).toBe("2026-08-01");
  });
});

describe("tidig hämtning söndag–onsdag", () => {
  it("söndag 09:00 svensk sommartid är en discovery-körning", () => {
    const slot = matchSlot(new Date("2026-08-02T07:00:00Z"));
    expect(slot?.mode).toBe("facts");
    expect(slot?.key).toBe("sun-09");
  });

  it("måndag 06:00 svensk vintertid är en discovery-körning", () => {
    const slot = matchSlot(new Date("2026-01-05T05:00:00Z"));
    expect(slot?.mode).toBe("facts");
    expect(slot?.key).toBe("mon-06");
  });

  it("onsdag 21:00 är sista tidiga kontrollen", () => {
    expect(matchSlot(new Date("2026-08-05T19:00:00Z"))?.key).toBe("wed-21");
  });

  it("kör inte mitt i natten", () => {
    expect(matchSlot(new Date("2026-08-04T00:30:00Z"))).toBeNull();
  });

  it("söndag siktar redan på kommande lördag", () => {
    expect(targetSaturday(new Date("2026-08-02T07:00:00Z"))).toBe("2026-08-08");
  });

  it("nästa körning efter lördagens omgång är söndagens tidiga kontroll", () => {
    const next = nextRun(new Date("2026-08-01T18:00:00Z"));
    expect(next.slot.key).toBe("sun-06");
    expect(next.slot.mode).toBe("facts");
  });

  it("torsdag–lördag är kvar som kompletteringar", () => {
    const later = SCHEDULE.filter((s) => s.weekday >= 4);
    expect(later.map((s) => s.key)).toEqual([
      "thu-07",
      "thu-12",
      "thu-18",
      "fri-07",
      "fri-18",
      "sat-08",
    ]);
  });
});

describe("väntar utan fel när ATG inte publicerat", () => {
  it("saknad omgång ger inget resultat i stället för undantag", () => {
    const games = [{ id: "V85_2026-08-08_11_5", startTime: "2026-08-08T14:20:00Z", tracks: [] }];
    const pick = pickSaturdayGame(games as any, "2026-08-15");
    expect(pick.ok).toBe(false);
  });
});


describe("val av lördagens omgång", () => {
  const games = [
    { id: "V85_2026-08-01_24_5", startTime: "2026-08-01T14:20:00Z", tracks: [{ name: "Rättvik" }] },
    { id: "V85_2026-08-08_11_5", startTime: "2026-08-08T14:20:00Z", tracks: [{ name: "Solvalla" }] },
  ];

  it("väljer rätt datum", () => {
    const pick = pickSaturdayGame(games as any, "2026-08-01");
    expect(pick.ok && pick.trackName).toBe("Rättvik");
  });

  it("hittar aldrig på en omgång", () => {
    expect(pickSaturdayGame(games as any, "2026-08-15").ok).toBe(false);
  });

  it("ger samma nyckel varje gång", () => {
    const key = { gameId: "V85_2026-08-01_24_5", raceDate: "2026-08-01", trackName: "Rättvik" };
    expect(roundKey(key)).toBe(roundKey({ ...key }));
  });
});

describe("ändringar i underlaget", () => {
  it("upptäcker strykning som viktig", () => {
    const changes = diffFacts({ scratched: false }, { scratched: true });
    expect(changes[0].important).toBe(true);
  });

  it("räknar inte första ifyllda uppgiften som ändring", () => {
    expect(diffFacts({ shoes: null }, { shoes: "Barfota fram" })).toHaveLength(0);
  });

  it("ignorerar små rörelser i streckprocent", () => {
    expect(diffFacts({ betSharePercent: 20 }, { betSharePercent: 21 })).toHaveLength(0);
    expect(diffFacts({ betSharePercent: 20 }, { betSharePercent: 28 })[0].important).toBe(true);
  });
});
