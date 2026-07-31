import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMember(context: any, groupId: string) {
  const { data, error } = await context.supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Du är inte med i den här gruppen.");
}

/** Alla insamlade experttipsrapporter för gruppen, senaste först. */
export const listExpertTips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertMember(context, data.groupId);
    const { data: rows, error } = await context.supabase
      .from("expert_tips_reports")
      .select("*")
      .eq("group_id", data.groupId)
      .order("race_date", { ascending: false })
      .limit(30);
    if (error) throw error;
    return rows ?? [];
  });

/** Hämtar och sammanfattar veckans experttips på nytt. */
export const refreshExpertTips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertMember(context, data.groupId);

    const today = new Date().toISOString().slice(0, 10);
    const { data: round } = await context.supabase
      .from("rounds")
      .select("id, race_date, tracks(name)")
      .eq("group_id", data.groupId)
      .eq("is_demo", false)
      .gte("race_date", today)
      .order("race_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    let raceDate = round?.race_date as string | undefined;
    if (!raceDate) {
      // Närmaste kommande lördag om ingen omgång är upplagd ännu.
      const now = new Date();
      const days = (6 - now.getUTCDay() + 7) % 7;
      now.setUTCDate(now.getUTCDate() + days);
      raceDate = now.toISOString().slice(0, 10);
    }

    const { collectExpertTips } = await import("@/lib/expert-tips.server");
    return collectExpertTips({
      groupId: data.groupId,
      roundId: round?.id ?? null,
      raceDate,
      trackName: (round as any)?.tracks?.name ?? null,
      userId: context.userId,
    });
  });

/** Aktuella experttips per avdelning för en omgång – används i AI-redovisningen. */
export const listRoundExpertTips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: round, error: roundError } = await context.supabase
      .from("rounds")
      .select("id, group_id, race_date")
      .eq("id", data.roundId)
      .maybeSingle();
    if (roundError) throw roundError;
    if (!round) return [];
    await assertMember(context, round.group_id);

    const { data: rows, error } = await context.supabase
      .from("expert_tips")
      .select(
        "id, leg_number, source_name, expert, top_pick, alternatives, longshot, warning, note, url, published_at",
      )
      .eq("group_id", round.group_id)
      .eq("race_date", round.race_date)
      .eq("is_current", true)
      .order("leg_number", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });
