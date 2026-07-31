import { describe, expect, it } from "vitest";
import {
  accountingSummary,
  consensusLevel,
  consensusText,
  dateVariants,
  emptyAccounting,
  expertQualityGate,
  explainRunDifference,
  isGenericPage,
  verifyCandidate,
  verifiedTipKey,
  type ExpectedRound,
} from "../tip-validation";

const EXPECTED: ExpectedRound = {
  gameType: "V85",
  raceDate: "2026-08-01",
  trackName: "Rättvik",
  gameId: "V85_2026-08-01_25_5",
};

function page(over: Partial<Parameters<typeof verifyCandidate>[0]> = {}) {
  return verifyCandidate(
    {
      sourceKey: "travronden",
      sourceName: "Travronden",
      url: "https://travronden.se/tips/v85-rattvik-1-augusti",
      title: "V85-tips Rättvik lördag 1 augusti",
      content:
        "V85 Rättvik lördag 1 augusti 2026. Avdelning 1: vi spikar Hankypanky Leonie. " +
        "Avd 2 gardering med tre hästar. Avd 3 skräll: Unforgettable A.Y. Rangordning för varje avdelning följer nedan. " +
        "Systemförslag på 864 rader. ".repeat(20),
      ...over,
    },
    EXPECTED,
  );
}

describe("datum och sidmönster", () => {
  it("känner igen svenska datumformat", () => {
    const v = dateVariants("2026-08-01");
    expect(v).toContain("1 augusti");
    expect(v).toContain("1/8");
  });

  it("underkänner startsidor, tagg- och söksidor", () => {
    expect(isGenericPage("https://travstugan.se/")).toBe(true);
    expect(isGenericPage("https://www.atg.se/v85")).toBe(true);
    expect(isGenericPage("https://aftonbladet.se/trav/tagg/v75-tips/")).toBe(true);
    expect(isGenericPage("https://travronden.se/sok?q=v85")).toBe(true);
    expect(isGenericPage("https://travronden.se/tips/v85-rattvik-1-augusti")).toBe(false);
  });
});

describe("godkända experttips", () => {
  it("godkänner en specifik V85-tipssida för rätt datum och bana", () => {
    const r = page();
    expect(r.classification).toBe("expert_tip");
    expect(r.accepted).toBe(true);
    expect(r.gameTypeVerified && r.dateVerified && r.trackVerified).toBe(true);
  });

  it("godkänner ranking för en aktuell avdelning", () => {
    const r = page({
      title: "Rangordning V85 avd 4",
      content:
        "V85 Rättvik 2026-08-01. Rangordning avd 4: 1) Lundåsens Teknik 2) Mellby Mammon. ".repeat(20),
    });
    expect(r.accepted).toBe(true);
  });

  it("godkänner ett systemförslag för rätt omgång", () => {
    const r = page({
      title: "Systemförslag V85 Rättvik",
      content:
        "V85 1 augusti Rättvik. Systemförslag: spik i avd 3, gardering i avd 6. ".repeat(20),
    });
    expect(r.accepted).toBe(true);
  });
});

describe("underkända kandidater", () => {
  const cases: [string, Parameters<typeof page>[0], string][] = [
    [
      "V75-sida",
      {
        url: "https://aftonbladet.se/trav/v75-tips-solvalla",
        title: "V75-tips Solvalla",
        content: "V75 tips Solvalla 1 augusti spik och skräll avd 1. ".repeat(20),
      },
      "rejected_wrong_game_type",
    ],
    [
      "V64-sida",
      {
        url: "https://vitippa.se/v64/tips",
        title: "V64-tipset från Vi Tippa",
        content: "V64 tips avd 1 spik skräll 1 augusti Rättvik. ".repeat(20),
      },
      "rejected_wrong_game_type",
    ],
    [
      "Top 7-sida",
      {
        url: "https://www.atg.se/spel/2026-08-01/top7/rattvik",
        title: "Top 7 Rättvik",
        content: "Top 7 Rättvik 1 augusti spik avd 1 rangordning. ".repeat(20),
      },
      "rejected_wrong_game_type",
    ],
    [
      "generell V85-sida",
      {
        url: "https://www.atg.se/v85",
        title: "V85 hos ATG",
        content: "V85 Rättvik 1 augusti spik avd 1. ".repeat(20),
      },
      "rejected_generic_page",
    ],
    [
      "startsida",
      {
        url: "https://travstugan.se/",
        title: "Travstugan",
        content: "V85 Rättvik 1 augusti spik avd 1. ".repeat(20),
      },
      "rejected_generic_page",
    ],
    [
      "taggsida",
      {
        url: "https://aftonbladet.se/trav/tagg/v85/",
        title: "V85-tips",
        content: "V85 Rättvik 1 augusti spik avd 1. ".repeat(20),
      },
      "rejected_generic_page",
    ],
    [
      "sökresultatsida",
      {
        url: "https://travronden.se/artiklar?q=v85+rattvik",
        title: "Sökresultat",
        content: "V85 Rättvik 1 augusti spik avd 1. ".repeat(20),
      },
      "rejected_generic_page",
    ],
    [
      "annan bana",
      {
        url: "https://travronden.se/tips/v85-aby",
        title: "V85-tips Åby",
        content: "V85 Åby 1 augusti spik avd 1 rangordning gardering. ".repeat(20),
      },
      "rejected_wrong_round",
    ],
    [
      "annat datum",
      {
        url: "https://travronden.se/tips/v85-rattvik-8-augusti",
        title: "V85-tips Rättvik 8 augusti",
        content: "V85 Rättvik 8 augusti spik avd 1 rangordning gardering. ".repeat(20),
      },
      "rejected_wrong_round",
    ],
    [
      "betalvägg",
      {
        url: "https://travronden.se/plus/v85-rattvik-1-augusti",
        title: "V85 Rättvik 1 augusti",
        content: "Endast för prenumeranter. V85 Rättvik 1 augusti spik avd 1. ".repeat(20),
      },
      "rejected_paywalled",
    ],
    [
      "tom sida",
      {
        url: "https://travronden.se/tips/v85-rattvik-1-augusti",
        title: "V85 Rättvik",
        content: "Kort text.",
      },
      "rejected_empty_page",
    ],
  ];

  for (const [name, over, code] of cases) {
    it(`underkänner ${name}`, () => {
      expect(page(over).code).toBe(code);
    });
  }

  it("omklassificerar en tränarnyhet som nyhet i stället för tips", () => {
    const r = page({
      url: "https://travronden.se/nyheter/lizmark-byter-tranare",
      title: "Lizmark byter tränare",
      content:
        "Lizmark byter tränare inför V85 på Rättvik 1 augusti. Hästen flyttar till ny tränare. ".repeat(
          20,
        ),
    });
    expect(r.code).toBe("reclassified_as_news");
    expect(r.accepted).toBe(false);
  });

  it("underkänner en gammal tipssida", () => {
    const r = page({
      url: "https://travronden.se/tips/v85-rattvik-25-juli",
      title: "V85-tips Rättvik 25 juli",
      content: "V85 Rättvik 25 juli spik avd 1 rangordning gardering. ".repeat(20),
    });
    expect(r.code).toBe("rejected_wrong_round");
  });
});

describe("konsensusnivåer", () => {
  it("en källa blir aldrig samsyn", () => {
    const level = consensusLevel({ supportingSources: 1, totalSources: 1 });
    expect(level).toBe("single");
    expect(consensusText(level, "Hankypanky Leonie", 1)).toContain("En källa lyfter fram");
  });

  it("två källor visas som flera källor", () => {
    expect(consensusLevel({ supportingSources: 2, totalSources: 2 })).toBe("multiple");
  });

  it("tre oberoende källor ger tydlig samsyn", () => {
    expect(consensusLevel({ supportingSources: 3, totalSources: 3 })).toBe("clear");
  });

  it("motstridiga rankningar blir delade meningar", () => {
    expect(consensusLevel({ supportingSources: 1, totalSources: 4 })).toBe("split");
  });

  it("utan källor finns ingen slutsats", () => {
    expect(consensusLevel({ supportingSources: 0, totalSources: 3 })).toBe("none");
  });
});

describe("kvalitetsgrind", () => {
  it("stoppar sammanställning utan verifierad källa", () => {
    const gate = expertQualityGate({
      racesVerified: 8,
      entriesComplete: true,
      verifiedSources: 0,
      unsourcedClaims: 0,
      misclassifiedRecords: 0,
      otherGameTypes: 0,
    });
    expect(gate.ok).toBe(false);
    expect(gate.message).toContain("inte tillräckligt kvalitetssäkrat");
  });

  it("släpper igenom komplett underlag", () => {
    expect(
      expertQualityGate({
        racesVerified: 8,
        entriesComplete: true,
        verifiedSources: 2,
        unsourcedClaims: 0,
        misclassifiedRecords: 0,
        otherGameTypes: 0,
      }).ok,
    ).toBe(true);
  });
});

describe("körningens bokföring", () => {
  it("förklarar varför 40 kandidater blev 24 tips", () => {
    const accounting = {
      ...emptyAccounting(),
      candidates: 40,
      accepted: 24,
      rejected: 10,
      duplicates: 6,
      newTips: 24,
      verifiedTotal: 24,
    };
    const text = accountingSummary(accounting);
    expect(text).toContain("40 kandidater");
    expect(text).toContain("24 verifierade tips");
    expect(explainRunDifference({ tips: 40 }, { tips: 24 }, accounting)).toContain("minskade");
  });

  it("ger samma nyckel för samma tips två gånger", () => {
    const a = verifiedTipKey({
      roundKey: "atg:1",
      sourceKey: "travronden",
      url: "https://x.se/a",
      leg: 3,
      contentHash: "abc",
    });
    const b = verifiedTipKey({
      roundKey: "atg:1",
      sourceKey: "travronden",
      url: "https://x.se/a",
      leg: 3,
      contentHash: "abc",
    });
    expect(a).toBe(b);
  });
});
