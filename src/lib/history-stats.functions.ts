import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeHistoryStats, type HistoryRow, type HistoryStats } from "@/lib/history-stats";

/** Statistik över gruppens importerade spelhistorik. */
export const getHistoryStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }): Promise<HistoryStats> => {
    const { data: member, error: memberError } = await context.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw new Error("Du är inte med i den här gruppen.");
    const { data: rows, error } = await context.supabase
      .from("imported_history_rounds")
      .select(
        "id, race_date, track_name, correct_count, payout, net_result, computed_cost, stated_cost, computed_rows, stated_rows, winners_verified, usable_for_learning, review_status, legs",
      )
      .eq("group_id", data.groupId)
      .order("race_date", { ascending: true });
    if (error) throw error;

    // Omgångar som spelats i Travhubben ska räknas med i samma statistik.
    const { data: settlements, error: settlementError } = await context.supabase
      .from("round_settlements")
      .select(
        "id, round_id, race_date, track_name, status, winners, system_cost, total_cost, payout_total, net, calculation, created_at",
      )
      .eq("group_id", data.groupId)
      .order("race_date", { ascending: true });
    if (settlementError) throw settlementError;

    const played = dedupeSettlements((settlements ?? []) as any[]).map(settlementToHistoryRow);
    const all = [...((rows ?? []) as unknown as HistoryRow[]), ...played].sort((a, b) =>
      String(a.race_date).localeCompare(String(b.race_date)),
    );
    return computeHistoryStats(all);
  });
