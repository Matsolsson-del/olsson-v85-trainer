import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertRoundMember(context: any, roundId: string) {
  const { data, error } = await context.supabase
    .from("rounds")
    .select("id, group_id")
    .eq("id", roundId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Omgången hittades inte.");
  return data.group_id as string;
}

/** Kör den automatiska slutkontrollen före spelstopp. Föreslår bara ändringar. */
export const runFinalCheckNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertRoundMember(context, data.roundId);
    const { runFinalCheck } = await import("@/lib/final-check.server");
    return runFinalCheck(data.roundId, context.userId);
  });

/** Markerar spelet som inlämnat hos ATG och sparar en oföränderlig kopia. */
export const markBetSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertRoundMember(context, data.roundId);

    const { data: responsibility } = await context.supabase
      .from("round_responsibility")
      .select("user_id")
      .eq("round_id", data.roundId)
      .maybeSingle();
    if (responsibility?.user_id && responsibility.user_id !== context.userId) {
      throw new Error("Bara veckans spelansvarige kan markera spelet som inlämnat.");
    }

    const { createBetSnapshot } = await import("@/lib/snapshot.server");
    return createBetSnapshot(data.roundId, context.userId);
  });
