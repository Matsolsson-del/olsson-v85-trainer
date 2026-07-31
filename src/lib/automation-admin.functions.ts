import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Kontrollerar att den inloggade personen tillhör gruppen. */
async function firstGroupId(context: any) {
  const { data, error } = await context.supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", context.userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Du tillhör ingen grupp ännu.");
  return data.group_id as string;
}

/**
 * Hämtar allt som behövs för att visa hur automatiken mår:
 * senaste körningarna, varje källas status och veckans ändringar.
 */
export const getAutomationOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const groupId = await firstGroupId(context);
    const { targetSaturday, nextRun, SCHEDULE } = await import("@/lib/v85-schedule");
    const { factsStatus, summarizeSources } = await import("@/lib/automation-core");

    const saturday = targetSaturday(new Date());

    const [runsRes, sourcesRes, roundRes, changesRes] = await Promise.all([
      context.supabase
        .from("automation_runs")
        .select("*")
        .eq("group_id", groupId)
        .order("started_at", { ascending: false })
        .limit(15),
      context.supabase.from("expert_tip_sources").select("*").eq("group_id", groupId).order("name"),
      context.supabase
        .from("rounds")
        .select("id, race_date, bet_stop_at, tracks(name), races(id, race_entries(id))")
        .eq("group_id", groupId)
        .eq("race_date", saturday)
        .eq("is_demo", false)
        .maybeSingle(),
      context.supabase
        .from("race_fact_changes")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const round: any = roundRes.data ?? null;
    const races = round?.races?.length ?? 0;
    const entries =
      round?.races?.reduce((sum: number, r: any) => sum + (r.race_entries?.length ?? 0), 0) ?? 0;

    const lastRun: any = runsRes.data?.[0] ?? null;
    const running = lastRun?.status === "running";

    const sources = (sourcesRes.data ?? []).map((s: any) => ({
      key: s.source_key,
      name: s.name,
      status: (s.last_status ?? "pending") as any,
      tips: 0,
      attempts: s.failure_count ?? 0,
      lastCheckedAt: s.last_checked_at,
      message: s.last_message ?? s.access_note,
    }));

    const { data: tipCounts } = await context.supabase
      .from("expert_tips")
      .select("source_key")
      .eq("group_id", groupId)
      .eq("race_date", saturday)
      .eq("is_current", true);
    for (const source of sources) {
      source.tips = (tipCounts ?? []).filter((t: any) => t.source_key === source.key).length;
    }

    return {
      groupId,
      saturday,
      round: round
        ? {
            id: round.id,
            trackName: round.tracks?.name ?? null,
            betStopAt: round.bet_stop_at,
            races,
            entries,
          }
        : null,
      factsStatus: factsStatus({ running, races, entries }),
      sourceSummary: summarizeSources(sources),
      sources,
      runs: runsRes.data ?? [],
      changes: changesRes.data ?? [],
      nextRun: nextRun(new Date()).at.toISOString(),
      plan: SCHEDULE,
    };
  });

/** Kör automatiken direkt. Används av Mats när han vill hämta om underlaget. */
export const runAutomationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { mode?: "full" | "facts" | "tips" }) => ({
    mode: data?.mode === "facts" || data?.mode === "tips" ? data.mode : ("full" as const),
  }))
  .handler(async ({ data, context }) => {
    const groupId = await firstGroupId(context);
    const { runAutomationForGroup } = await import("@/lib/automation-engine.server");
    return runAutomationForGroup({
      groupId,
      mode: data.mode,
      triggeredBy: context.userId,
    });
  });

/** Slår på eller stänger av en enskild expertkälla. */
export const setSourceEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sourceKey: string; enabled: boolean }) => {
    if (!data?.sourceKey) throw new Error("Källa saknas");
    return { sourceKey: data.sourceKey, enabled: Boolean(data.enabled) };
  })
  .handler(async ({ data, context }) => {
    const groupId = await firstGroupId(context);
    const { error } = await context.supabase
      .from("expert_tip_sources")
      .update({ enabled: data.enabled, next_attempt_at: null, failure_count: 0 })
      .eq("group_id", groupId)
      .eq("source_key", data.sourceKey);
    if (error) throw error;
    return { ok: true };
  });
