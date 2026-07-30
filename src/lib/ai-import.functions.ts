import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(context: any, groupId: string) {
  const { data, error } = await context.supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Du är inte med i den här gruppen.");
  if (data.role !== "owner") throw new Error("Bara gruppens ägare kan sköta AI-importen.");
}

/** Hämtar inställningar och senaste importförsök. */
export const getAiImportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.groupId);
    const { getImportSettings, listImportAttempts } = await import("@/lib/ai-import.server");
    const [settings, attempts] = await Promise.all([
      getImportSettings(data.groupId),
      listImportAttempts(data.groupId),
    ]);
    return { settings, attempts };
  });

/** Skapar eller byter API-nyckel. Nyckeln visas bara en gång. */
export const rotateAiImportKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.groupId);
    const { rotateImportKey } = await import("@/lib/ai-import.server");
    return rotateImportKey(data.groupId);
  });

/** Slår på eller stänger av AI-importen. */
export const setAiImportEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; enabled: boolean }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    if (typeof data.enabled !== "boolean") throw new Error("enabled saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.groupId);
    const { setImportEnabled } = await import("@/lib/ai-import.server");
    return setImportEnabled(data.groupId, data.enabled);
  });
