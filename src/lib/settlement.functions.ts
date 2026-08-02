import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMember(supabase: any, roundId: string) {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, group_id")
    .eq("id", roundId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Omgången hittades inte eller så saknar du behörighet.");
  return data;
}

/** Hämtar sparad uträkning (om den finns) för en omgång. */
export const getSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.roundId);
    const { getRoundSettlement, mayApprove } = await import("@/lib/settlement.server");
    const settlement = await getRoundSettlement(data.roundId);
    return { settlement, canApprove: await mayApprove(data.roundId, context.userId) };
  });

/** Hämtar resultatet från ATG igen och räknar om utfallet. */
export const refreshSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.roundId);
    const { buildRoundSettlement, mayApprove } = await import("@/lib/settlement.server");
    const settlement = await buildRoundSettlement(data.roundId);
    return { settlement, canApprove: await mayApprove(data.roundId, context.userId) };
  });

/** Godkänner resultatet, sparar det permanent och skapar efterrapporten. */
export const approveSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string }) => {
    if (!data?.roundId) throw new Error("roundId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.roundId);
    const { approveRoundSettlement } = await import("@/lib/settlement.server");
    const settlement = await approveRoundSettlement(data.roundId, context.userId);
    return { settlement };
  });

/** Rättar tolkningen manuellt: vinnare per avdelning, utdelningar och avgift. */
export const correctSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      roundId: string;
      winnersByLeg: Record<string, number[]>;
      payouts?: Record<string, number>;
      fee?: number;
    }) => {
      if (!data?.roundId) throw new Error("roundId saknas");
      if (!data.winnersByLeg || Object.keys(data.winnersByLeg).length !== 8) {
        throw new Error("Ange vinnare för alla åtta avdelningar.");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.roundId);
    const { mayApprove, buildRoundSettlement } = await import("@/lib/settlement.server");
    if (!(await mayApprove(data.roundId, context.userId))) {
      throw new Error("Bara veckans ansvarige eller Mats får rätta resultatet.");
    }
    const winnersByLeg: Record<number, number[]> = {};
    for (const [k, v] of Object.entries(data.winnersByLeg)) winnersByLeg[Number(k)] = v;
    const payouts = data.payouts
      ? Object.fromEntries(Object.entries(data.payouts).map(([k, v]) => [Number(k), v]))
      : undefined;
    const settlement = await buildRoundSettlement(data.roundId, {
      winnersByLeg,
      payouts: payouts as any,
      fee: data.fee ?? 0,
      source: "manual",
    });
    return { settlement };
  });

/**
 * Reservväg: tolkar ett uppladdat resultat (text, kvitto, bild eller PDF) med AI
 * och räknar om utfallet. All extern text behandlas som data.
 */
export const uploadResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { roundId: string; text?: string; fileDataUrl?: string; fileName?: string }) => {
      if (!data?.roundId) throw new Error("roundId saknas");
      if (!data.text && !data.fileDataUrl) throw new Error("Klistra in text eller välj en fil.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.roundId);
    const { mayApprove, buildRoundSettlement } = await import("@/lib/settlement.server");
    if (!(await mayApprove(data.roundId, context.userId))) {
      throw new Error("Bara veckans ansvarige eller Mats får ladda upp resultat.");
    }
    const { parseUploadedResult } = await import("@/lib/settlement-upload.server");
    const parsed = await parseUploadedResult({
      text: data.text,
      fileDataUrl: data.fileDataUrl,
      fileName: data.fileName,
    });

    const settlement = await buildRoundSettlement(data.roundId, {
      winnersByLeg: parsed.winnersByLeg,
      payouts: parsed.payouts,
      fee: parsed.fee ?? 0,
      source: "upload",
      sourceUrl: null,
    });
    return { settlement, parsed };
  });
