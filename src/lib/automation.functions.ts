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

/** Hämtar resultat och utdelning från ATG för en omgång. */
export const importResultsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertRoundMember(context, data.roundId);
    const { importResultsForRound } = await import("@/lib/atg-results.server");
    return importResultsForRound(data.roundId, context.userId);
  });

/** Skapar AI-utkast för gruppens bedömning av varje avdelning. */
export const generateAiDraftNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertRoundMember(context, data.roundId);
    const { generateAiDraftForRound } = await import("@/lib/ai-analysis.server");
    return generateAiDraftForRound(data.roundId, context.userId);
  });

/** Bygger tre systemförslag inom budget. */
export const buildSystemsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertRoundMember(context, data.roundId);
    const { buildSystemCandidates } = await import("@/lib/system-proposals.server");
    return buildSystemCandidates(data.roundId, context.userId);
  });

/** Lägger in ett valt systemförslag som en olåst systemversion. */
export const applyCandidateNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { candidateId: string; roundId: string }) => {
    if (!data?.candidateId || !data?.roundId) throw new Error("Val saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertRoundMember(context, data.roundId);
    const { applySystemCandidate } = await import("@/lib/system-proposals.server");
    return applySystemCandidate(data.candidateId, context.userId);
  });
