import { describe, expect, it } from "vitest";
import { pickCurrentRound } from "@/lib/current-round";

const now = new Date("2026-07-31T10:00:00Z");

describe("pickCurrentRound", () => {
  it("väljer den närmast kommande omgången med underlag", () => {
    const picked = pickCurrentRound(
      [
        { id: "demo", race_date: "2026-08-08", status: "draft", is_demo: true, race_count: 0 },
        {
          id: "rattvik",
          race_date: "2026-08-01",
          bet_stop_at: "2026-08-01T16:10:00Z",
          status: "draft",
          race_count: 8,
        },
      ],
      now,
    );
    expect(picked?.id).toBe("rattvik");
  });

  it("låter inte en tom framtida omgång ta över", () => {
    const picked = pickCurrentRound(
      [{ id: "tom", race_date: "2026-08-15", status: "draft", race_count: 0 }],
      now,
    );
    expect(picked).toBeNull();
  });

  it("faller tillbaka på senaste öppna omgången när spelstoppet passerat", () => {
    const picked = pickCurrentRound(
      [
        { id: "gammal", race_date: "2026-07-18", status: "system_locked", race_count: 8 },
        { id: "nyare", race_date: "2026-07-25", status: "system_locked", race_count: 8 },
      ],
      now,
    );
    expect(picked?.id).toBe("nyare");
  });
});
