import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Skapar personliga rekommendationer till den inloggade spelaren. */
export const generateMyReview = createServerFn({ method: "POST" })
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

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { generatePersonalReview } = await import("@/lib/personal-review.server");
    return generatePersonalReview(data.groupId, context.userId, profile?.display_name ?? "Spelaren");
  });
