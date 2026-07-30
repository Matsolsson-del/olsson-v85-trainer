import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Manuell körning av ATG-importen för den valda gruppen. */
export const importV85Now = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    // RLS-kontroll: bara medlemmar i gruppen ser den.
    const { data: member, error } = await context.supabase
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!member) throw new Error("Du är inte medlem i gruppen.");

    const { importNextV85Round } = await import("@/lib/atg-import.server");
    return importNextV85Round(data.groupId, context.userId);
  });
