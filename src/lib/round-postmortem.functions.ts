import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Begär en efteranalys för en spelad omgång och sparar den på omgången. */
export const requestRoundPostmortem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: round, error } = await context.supabase
      .from("rounds")
      .select("id, group_id")
      .eq("id", data.roundId)
      .maybeSingle();
    if (error) throw error;
    if (!round) throw new Error("Omgången hittades inte eller så saknar du behörighet.");

    const { generateRoundPostmortem } = await import("@/lib/round-postmortem.server");
    try {
      const result = await generateRoundPostmortem(data.roundId);
      return { ok: true, outcome: result.outcome };
    } catch (e: any) {
      console.error("[efteranalys] misslyckades", e?.stack ?? e);
      throw new Error(e?.message ?? "Efteranalysen misslyckades.");
    }
  });
