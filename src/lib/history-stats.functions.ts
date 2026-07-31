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
    const { data: rows, error } = await context.supabase
      .from("imported_history_rounds")
      .select(
        "id, race_date, track_name, correct_count, payout, net_result, computed_cost, stated_cost, computed_rows, stated_rows, winners_verified, usable_for_learning, legs",
      )
      .eq("group_id", data.groupId)
      .order("race_date", { ascending: true });
    if (error) throw error;
    return computeHistoryStats((rows ?? []) as unknown as HistoryRow[]);
  });
