import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_JSON_BYTES = 2_000_000; // 2 MB
const MAX_ROUNDS = 50;

async function assertOwner(context: any, groupId: string) {
  const { data, error } = await context.supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Du är inte med i den här gruppen.");
  if (data.role !== "owner") throw new Error("Bara gruppens ägare kan importera historik.");
}

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

function failure(mode: "preview" | "import", message: string) {
  return {
    ok: false as const,
    mode,
    message,
    errors: [],
    preview: [],
    imported: 0,
    skipped: 0,
    overwritten: 0,
    economy_note:
      "Historikposter är helt åtskilda från gruppens ekonomi – ingen insats eller transaktion har bokförts.",
  };
}

/** Returnerar { payload } eller { error } – kastar aldrig på användarfel. */
function parseJson(text: string): { payload?: any; error?: string } {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { error: "Ingen JSON angavs." };
  }
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) {
    return { error: "Filen är för stor. Max 2 MB per import." };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (e: any) {
    return { error: `JSON-syntaxfel: ${e?.message ?? "kunde inte tolkas"}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "JSON måste vara ett objekt med fältet rounds." };
  }
  if (Array.isArray(parsed.rounds) && parsed.rounds.length > MAX_ROUNDS) {
    return { error: `Max ${MAX_ROUNDS} omgångar per import.` };
  }
  return { payload: parsed };
}

/** Samma format som MCP-verktyget get_history_import_format. */
export const getHistoryImportFormat = createServerFn({ method: "GET" }).handler(async () => {
  const { historyImportSchema, historyImportRules, exampleHistoryImportPayload } = await import(
    "@/lib/history-import-format"
  );
  return {
    schema: historyImportSchema(),
    rules: historyImportRules(),
    example: exampleHistoryImportPayload(),
  };
});

/** Validerar och förhandsgranskar – skriver aldrig till databasen. */
export const previewHistoryImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; json: string; overwriteExisting?: boolean }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.groupId);
    const { payload, error: parseError } = parseJson(data.json);
    if (parseError) return failure("preview", parseError);
    const { processHistoryImport } = await import("@/lib/history-import.server");
    return processHistoryImport(context.supabase, data.groupId, context.userId, {
      ...payload,
      mode: "preview",
      overwrite_existing: data.overwriteExisting === true,
    });
  });

/** Sparar godkända poster. Samma logik som import_betting_history med mode="import". */
export const commitHistoryImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      groupId: string;
      json: string;
      overwriteExisting?: boolean;
      reason?: string | null;
      batchId?: string | null;
    }) => {
      if (!data?.groupId) throw new Error("groupId saknas");
      if (data.overwriteExisting === true && (data.reason ?? "").trim().length < 5) {
        throw new Error("En motivering krävs vid överskrivning.");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.groupId);
    const { payload, error: parseError } = parseJson(data.json);
    if (parseError) return failure("import", parseError);
    const { processHistoryImport } = await import("@/lib/history-import.server");
    return processHistoryImport(
      context.supabase,
      data.groupId,
      context.userId,
      { ...payload, mode: "import", overwrite_existing: data.overwriteExisting === true },
      { batchId: data.batchId ?? null, reason: data.reason ?? null },
    );
  });

/** Importerad historik för gruppen. */
export const listImportedHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertMember(context, data.groupId);
    const { data: rows, error } = await context.supabase
      .from("imported_history_rounds")
      .select("*")
      .eq("group_id", data.groupId)
      .order("race_date", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

/** Omgångar som spelats i hubben och som har ett registrerat resultat. */
export const listPlayedRounds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertMember(context, data.groupId);
    const { data: rows, error } = await context.supabase
      .from("round_settlements")
      .select(
        "id, round_id, race_date, track_name, status, winners, system_cost, total_cost, payout_total, net, calculation, created_at",
      )
      .eq("group_id", data.groupId)
      .order("race_date", { ascending: false });
    if (error) throw error;

    const { dedupeSettlements } = await import("@/lib/played-rounds");

    return dedupeSettlements((rows ?? []) as any[]).map((r: any) => {
      const calc = (r.calculation ?? {}) as any;
      const winnersByLeg = new Map<number, string>();
      for (const w of (r.winners ?? []) as any[]) {
        const first = Array.isArray(w?.winners) ? w.winners[0] : null;
        if (w?.leg != null && first) winnersByLeg.set(Number(w.leg), String(first));
      }
      const legs = ((calc.legs ?? []) as any[]).map((leg: any) => ({
        leg: leg.leg,
        selected: ((leg.active ?? []) as any[]).map((a: any) => a.label ?? String(a.startNumber)),
        spike: ((leg.active ?? []) as any[]).length === 1,
        winner: winnersByLeg.get(Number(leg.leg)) ?? null,
      }));
      return {
        id: r.id,
        round_id: r.round_id,
        source_kind: "hub" as const,
        race_date: r.race_date,
        track_name: r.track_name,
        status: r.status,
        correct_count: calc.correctLegs ?? null,
        spike_hits: calc.winningSpikes ?? null,
        computed_cost: r.total_cost ?? r.system_cost ?? null,
        stated_cost: null,
        computed_rows: calc.totalRows ?? null,
        stated_rows: null,
        payout: r.payout_total ?? null,
        net_result: r.net ?? null,
        spikes: legs.filter((l) => l.spike).map((l) => l.leg),
        legs,
        winners_verified: true,
        created_at: r.created_at,
      };
    });
  });

