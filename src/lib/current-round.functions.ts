import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pickCommentRound, pickCurrentRound, type RoundCandidate } from "@/lib/current-round";

export type CurrentRound = {
  id: string;
  race_date: string;
  bet_stop_at: string | null;
  status: string;
  track_name: string | null;
  race_count: number;
};

/**
 * Serverkontrollerad källa till "veckans spelbara omgång".
 * Används av Veckans spel, Kommentera och allt som hänger på veckans omgång.
 */
export const getCurrentRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; roundId?: string | null; mode?: "play" | "comment" }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }): Promise<CurrentRound | null> => {
    const { data: member, error: memberError } = await context.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw new Error("Du är inte med i den här gruppen.");

    const { data: rows, error } = await context.supabase
      .from("rounds")
      .select("id, race_date, bet_stop_at, status, is_demo, tracks:track_id(name), races(count)")
      .eq("group_id", data.groupId)
      .order("race_date", { ascending: false })
      .limit(60);
    if (error) throw error;

    const candidates: (RoundCandidate & CurrentRound)[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      race_date: r.race_date,
      bet_stop_at: r.bet_stop_at ?? null,
      status: r.status,
      is_demo: r.is_demo ?? false,
      track_name: r.tracks?.name ?? null,
      race_count: r.races?.[0]?.count ?? 0,
    }));

    // Direktlänk: en uttrycklig omgång i gruppen får öppnas som den är.
    if (data.roundId) {
      const explicit = candidates.find((c) => c.id === data.roundId);
      if (explicit) return explicit;
    }

    // Både Veckans spel och Kommentera hoppar vidare så snart omgången är avgjord.
    const picked = pickCommentRound(candidates);
    return picked ?? null;
  });
