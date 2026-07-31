import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { HistoryStats } from "@/lib/history-stats";

/**
 * Gemensam resultatmotor: samma siffror till Historik, Resultat och Lärande.
 * Del 1: samtliga registrerade spel (importerad historik).
 * Del 2: spel som faktiskt genomförts i Travhubben.
 */
export const getResultsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!member) throw new Error("Du är inte med i den här gruppen.");

    const [{ loadHistoryStats }, { getDashboardData }] = await Promise.all([
      import("@/lib/history-stats.server"),
      import("@/lib/dashboard.server"),
    ]);

    const [history, hub] = await Promise.all([
      loadHistoryStats(data.groupId) as Promise<HistoryStats>,
      getDashboardData(data.groupId),
    ]);

    const combined = {
      raceDays: history.counts.raceDaysInStats + hub.totals.rounds,
      cost: history.summary.totalCost + hub.totals.cost,
      payout: history.summary.totalPayout + hub.totals.winnings,
      net: history.summary.net + hub.totals.net,
      roundsWithPayout: history.summary.roundsWithPayout + hub.totals.roundsWithWin,
      avgCorrect: history.summary.avgCorrect,
      bestCorrect: history.summary.bestCorrect,
    };

    return { history, hub, combined };
  });
