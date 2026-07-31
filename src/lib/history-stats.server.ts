/**
 * Serverhjälp: hämtar historikstatistik med admin-klienten och gör en kort text till AI:n.
 */
import { computeHistoryStats, historyContextText, type HistoryRow } from "@/lib/history-stats";

export async function loadHistoryStats(groupId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("imported_history_rounds")
    .select(
      "id, race_date, track_name, correct_count, payout, net_result, computed_cost, stated_cost, computed_rows, stated_rows, winners_verified, usable_for_learning, review_status, legs",
    )
    .eq("group_id", groupId)
    .order("race_date", { ascending: true });
  if (error) throw error;
  return computeHistoryStats((data ?? []) as HistoryRow[]);
}

export async function historyContextForGroup(groupId: string): Promise<string> {
  try {
    const stats = await loadHistoryStats(groupId);
    return historyContextText(stats);
  } catch {
    return "";
  }
}
