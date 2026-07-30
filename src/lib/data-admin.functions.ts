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
  if (data.role !== "owner") throw new Error("Bara gruppens ägare kan göra det här.");
}

/** Exporterar gruppens historik som JSON och CSV-filer. */
export const exportGroupDataNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.groupId);
    const { exportGroupData, exportToCsvFiles } = await import("@/lib/data-admin.server");
    const json = await exportGroupData(data.groupId);
    return { json, csv: exportToCsvFiles(json) };
  });

/** Raderar historik. Kräver att ägaren skrivit bekräftelseordet. */
export const deleteHistoryNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; scope: "demo" | "all"; confirmation: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    if (data.scope !== "demo" && data.scope !== "all") throw new Error("Ogiltigt val");
    if (data.confirmation !== "RADERA") throw new Error("Skriv RADERA för att bekräfta.");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.groupId);
    const { deleteGroupHistory } = await import("@/lib/data-admin.server");
    return deleteGroupHistory(data.groupId, data.scope);
  });

/** Skapar en demoomgång med påhittade hästar. */
export const createDemoRoundNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.groupId);
    const { createDemoRound } = await import("@/lib/data-admin.server");
    return createDemoRound(data.groupId, context.userId);
  });
