import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Hämtar resultatöversikt för gruppen och varje medlem. */
export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: membership, error } = await context.supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!membership) throw new Error("Du är inte med i den här gruppen.");

    const { getDashboardData } = await import("@/lib/dashboard.server");
    return getDashboardData(data.groupId);
  });
