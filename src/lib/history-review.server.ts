/**
 * Serverlogik för granskning av dubbletter i importerad historik.
 * Inget raderas – posterna får bara en ny granskningsstatus.
 */
import { findDuplicateGroups } from "@/lib/history-review";

const COMPARE_FIELDS =
  "id, group_id, track_name, race_date, idempotency_key, source, created_at, legs, spikes, winners, winners_verified, stated_rows, computed_rows, stated_cost, computed_cost, correct_count, spike_hits, payout, net_result, data_quality, usable_for_learning, review_status, review_note, reviewed_at, reviewed_by, superseded_by, budget, row_price, analysis, lessons, uncertainty_note";

export type DuplicateAction = "keep_both" | "mark_superseded" | "merge_metadata" | "archive";

export async function assertGroupOwner(context: any, groupId: string) {
  const { data, error } = await context.supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Du är inte med i den här gruppen.");
  if (data.role !== "owner") throw new Error("Bara gruppens ägare kan granska historiken.");
}

export async function loadDuplicateGroups(context: any, groupId: string) {
  const { data, error } = await context.supabase
    .from("imported_history_rounds")
    .select(COMPARE_FIELDS)
    .eq("group_id", groupId)
    .order("race_date", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const groups = findDuplicateGroups(rows).map((g) => ({
    key: g.key,
    track: g.rows[0].track_name ?? "Okänd bana",
    date: String(g.rows[0].race_date),
    resolved: g.rows.every((r: any) => (r.review_status ?? "unreviewed") !== "unreviewed"),
    rows: [...g.rows].sort((a: any, b: any) =>
      String(a.created_at).localeCompare(String(b.created_at)),
    ),
  }));
  return {
    groups,
    unresolved: groups.filter((g) => !g.resolved).length,
    totalRows: rows.length,
    activeRows: rows.filter((r: any) => ["active", "separate"].includes(r.review_status ?? ""))
      .length,
  };
}

/** Slår ihop metadata: fyller tomma fält i behållaren från den andra posten. */
function mergedMetadata(keep: any, other: any) {
  const patch: Record<string, unknown> = {};
  const fields = [
    "analysis",
    "lessons",
    "source",
    "uncertainty_note",
    "payout",
    "net_result",
    "correct_count",
    "spike_hits",
    "stated_rows",
    "stated_cost",
    "budget",
    "row_price",
  ];
  for (const f of fields) {
    const cur = keep[f];
    const alt = other[f];
    if ((cur === null || cur === undefined || cur === "") && alt !== null && alt !== undefined && alt !== "") {
      patch[f] = alt;
    }
  }
  if (!keep.winners_verified && other.winners_verified) {
    patch.winners_verified = true;
    if (Array.isArray(other.winners) && other.winners.length) patch.winners = other.winners;
  }
  return patch;
}

export async function applyDuplicateDecision(
  context: any,
  input: { groupId: string; keepId: string; otherId: string; action: DuplicateAction; note: string },
) {
  const { data, error } = await context.supabase
    .from("imported_history_rounds")
    .select(COMPARE_FIELDS)
    .eq("group_id", input.groupId)
    .in("id", [input.keepId, input.otherId]);
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const keep = rows.find((r) => r.id === input.keepId);
  const other = rows.find((r) => r.id === input.otherId);
  if (!keep || !other) throw new Error("Posterna hittades inte i den här gruppen.");

  const now = new Date().toISOString();
  const stamp = { reviewed_at: now, reviewed_by: context.userId, review_note: input.note };
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

  if (input.action === "keep_both") {
    updates.push({ id: keep.id, patch: { ...stamp, review_status: "separate", superseded_by: null } });
    updates.push({ id: other.id, patch: { ...stamp, review_status: "separate", superseded_by: null } });
  } else if (input.action === "mark_superseded") {
    updates.push({ id: keep.id, patch: { ...stamp, review_status: "active", superseded_by: null } });
    updates.push({ id: other.id, patch: { ...stamp, review_status: "superseded", superseded_by: keep.id } });
  } else if (input.action === "merge_metadata") {
    updates.push({
      id: keep.id,
      patch: { ...stamp, review_status: "active", superseded_by: null, ...mergedMetadata(keep, other) },
    });
    updates.push({ id: other.id, patch: { ...stamp, review_status: "superseded", superseded_by: keep.id } });
  } else {
    updates.push({ id: keep.id, patch: { ...stamp, review_status: "active", superseded_by: null } });
    updates.push({ id: other.id, patch: { ...stamp, review_status: "archived", superseded_by: null } });
  }

  for (const u of updates) {
    const { error: upErr } = await context.supabase
      .from("imported_history_rounds")
      .update(u.patch)
      .eq("id", u.id)
      .eq("group_id", input.groupId);
    if (upErr) throw upErr;
  }

  await context.supabase.from("activity_log").insert({
    group_id: input.groupId,
    user_id: context.userId,
    event_type: "history_duplicate_reviewed",
    description: `Dubblett granskad (${input.action}): ${keep.track_name ?? "okänd bana"} ${keep.race_date}. ${input.note}`,
    before_value: { keep: keep.review_status, other: other.review_status },
    after_value: { keep_id: keep.id, other_id: other.id, action: input.action },
  });

  return { ok: true as const };
}
