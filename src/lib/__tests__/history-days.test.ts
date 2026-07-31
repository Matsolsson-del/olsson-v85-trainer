import { describe, expect, it } from "vitest";
import { computeHistoryStats, type HistoryRow } from "@/lib/history-stats";

const row = (over: Partial<HistoryRow>): HistoryRow => ({
  id: Math.random().toString(36).slice(2),
  race_date: "2026-01-10",
  track_name: "Solvalla",
  review_status: "active",
  computed_cost: 450,
  payout: 0,
  correct_count: 6,
  legs: [],
  ...over,
});

describe("computeHistoryStats – tävlingsdagar och systemposter", () => {
  it("skiljer tävlingsdagar från importerade systemposter", () => {
    const stats = computeHistoryStats([
      row({ id: "a", race_date: "2026-01-10" }),
      row({ id: "b", race_date: "2026-01-17" }),
      row({ id: "c", race_date: "2026-01-24", review_status: "unreviewed" }),
      row({ id: "d", race_date: "2026-01-24", review_status: "unreviewed" }),
    ]);
    expect(stats.counts.importedRecords).toBe(4);
    expect(stats.counts.raceDays).toBe(3);
    expect(stats.counts.conflictDays).toBe(1);
    expect(stats.counts.reviewNeededDays).toBe(1);
    // Konfliktdagen räknas bara en gång i statistiken.
    expect(stats.counts.raceDaysInStats).toBe(3);
    expect(stats.summary.rounds).toBe(3);
  });
});
