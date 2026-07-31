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
    return computeHistoryStats((rows ?? []) as unknown as HistoryRow[]);
  });
