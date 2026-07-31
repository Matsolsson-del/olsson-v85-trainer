import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Alla dubbletter i historiken, sida vid sida. Endast gruppens ägare. */
export const listHistoryDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { assertGroupOwner, loadDuplicateGroups } = await import("@/lib/history-review.server");
    await assertGroupOwner(context, data.groupId);
    return loadDuplicateGroups(context, data.groupId);
  });

/** Antal ogranskade dubbletter – får läsas av alla medlemmar (visas som spärrtext). */
export const countHistoryDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => {
    if (!data?.groupId) throw new Error("groupId saknas");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { unresolvedDuplicateGroups } = await import("@/lib/history-review");
    const { data: rows, error } = await context.supabase
      .from("imported_history_rounds")
      .select("id, race_date, track_name, review_status")
      .eq("group_id", data.groupId);
    if (error) throw error;
    const groups = unresolvedDuplicateGroups((rows ?? []) as any[]);
    return {
      unresolved: groups.length,
      items: groups.map((g) => ({
        track: g.rows[0].track_name ?? "Okänd bana",
        date: String(g.rows[0].race_date),
        count: g.rows.length,
      })),
    };
  });

/** Mats beslut om en dubblett. Ingen post raderas – bara status ändras. */
export const resolveHistoryDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      groupId: string;
      keepId: string;
      otherId: string;
      action: "keep_both" | "mark_superseded" | "merge_metadata" | "archive";
      note?: string;
    }) => {
      if (!data?.groupId) throw new Error("groupId saknas");
      if (!data?.keepId || !data?.otherId) throw new Error("Två poster måste väljas.");
      if (data.keepId === data.otherId) throw new Error("Posterna måste vara olika.");
      const allowed = ["keep_both", "mark_superseded", "merge_metadata", "archive"];
      if (!allowed.includes(data.action)) throw new Error("Okänt val.");
      const note = (data.note ?? "").trim();
      if (note.length < 5) throw new Error("Skriv en kort motivering (minst 5 tecken).");
      return { ...data, note };
    },
  )
  .handler(async ({ data, context }) => {
    const { assertGroupOwner, applyDuplicateDecision } = await import("@/lib/history-review.server");
    await assertGroupOwner(context, data.groupId);
    return applyDuplicateDecision(context, {
      groupId: data.groupId,
      keepId: data.keepId,
      otherId: data.otherId,
      action: data.action,
      note: data.note!,
    });
  });
