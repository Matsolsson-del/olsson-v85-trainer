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

function parseJson(text: string) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Ingen JSON angavs.");
  }
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) {
    throw new Error("Filen är för stor. Max 2 MB per import.");
  }
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (e: any) {
    throw new Error(`JSON-syntaxfel: ${e?.message ?? "kunde inte tolkas"}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON måste vara ett objekt med fältet rounds.");
  }
  if (Array.isArray(parsed.rounds) && parsed.rounds.length > MAX_ROUNDS) {
    throw new Error(`Max ${MAX_ROUNDS} omgångar per import.`);
  }
  return parsed;
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
    const payload = parseJson(data.json);
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
    const payload = parseJson(data.json);
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
    const { data: rows, error } = await context.supabase
      .from("imported_history_rounds")
      .select("*")
      .eq("group_id", data.groupId)
      .order("race_date", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });
