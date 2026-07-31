import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const selectionSchema = z.union([z.number().int(), z.string().trim().min(1)]);

const legSchema = z.object({
  leg: z.number().int().min(1).max(8),
  selected: z.array(selectionSchema).min(1),
  spike: z.boolean().nullish(),
  winner: selectionSchema.nullish(),
  note: z.string().nullish(),
});

const systemVersionSchema = z.object({
  version: z.number().int().min(1),
  label: z.string().nullish(),
  reason: z.string().nullish(),
  legs: z
    .array(z.object({ leg: z.number().int().min(1).max(8), selected: z.array(selectionSchema) }))
    .default([]),
});

const roundSchema = z.object({
  idempotency_key: z.string().trim().min(1).nullish(),
  track_name: z.string().trim().nullish(),
  race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "race_date måste vara YYYY-MM-DD"),
  bet_stop_at: z.string().nullish(),
  budget: z.number().nullish(),
  row_price: z.number().positive().nullish(),
  stated_cost: z.number().nullish(),
  stated_rows: z.number().int().nullish(),
  legs: z.array(legSchema).min(1).max(8),
  winners_verified: z.boolean().default(false),
  correct_count: z.number().int().min(0).max(8).nullish(),
  spike_hits: z.number().int().min(0).max(8).nullish(),
  payout: z.number().nullish(),
  net_result: z.number().nullish(),
  analysis: z.string().nullish(),
  lessons: z.string().nullish(),
  data_quality: z.enum(["verified", "partially_verified", "incomplete"]),
  source: z.string().nullish(),
  uncertainty_note: z.string().nullish(),
  systems: z.array(systemVersionSchema).default([]),
});

export const historyImportSchemaZod = z.object({
  mode: z.enum(["preview", "import"]).default("preview"),
  overwrite_existing: z.boolean().default(false),
  rounds: z.array(roundSchema).min(1).max(50),
});

export type HistoryImportInput = z.infer<typeof historyImportSchemaZod>;
type HistoryRoundInput = z.infer<typeof roundSchema>;

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function computeRows(legs: HistoryRoundInput["legs"]) {
  return legs.reduce((acc, leg) => acc * leg.selected.length, 1);
}

function isSpikeLeg(leg: HistoryRoundInput["legs"][number]) {
  return leg.spike === true || leg.selected.length === 1;
}

function sameValue(a: unknown, b: unknown) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export type HistoryRoundPreview = {
  idempotency_key: string;
  track_name: string | null;
  race_date: string;
  legs_count: number;
  legs: unknown[];
  systems_count: number;
  winners: unknown[];
  source: string | null;
  uncertainty_note: string | null;
  missing_fields: string[];
  computed_rows: number;
  stated_rows: number | null;
  rows_mismatch: boolean;
  computed_cost: number | null;
  stated_cost: number | null;
  cost_mismatch: boolean;
  spikes: number[];
  correct_count: number | null;
  spike_hits: number | null;
  payout: number | null;
  net_result: number | null;
  data_quality: string;
  winners_verified: boolean;
  usable_for_learning: boolean;
  status: "new" | "duplicate_skipped" | "will_overwrite";
  existing_id: string | null;
  existing_snapshot: Record<string, unknown> | null;
  differences: { field: string; existing: unknown; incoming: unknown }[];
  warnings: string[];

};

function buildRow(input: HistoryRoundInput, groupId: string, userId: string | null) {
  const key =
    input.idempotency_key?.trim() ||
    `${slug(input.track_name ?? "okand-bana")}-${input.race_date}`;

  const computedRows = computeRows(input.legs);
  const computedCost = input.row_price != null ? Number((computedRows * input.row_price).toFixed(2)) : null;

  const spikes = input.legs.filter(isSpikeLeg).map((l) => l.leg);

  // Verifierade vinnare får bara sparas när det uttryckligen är verifierat.
  const winners = input.winners_verified
    ? input.legs
        .filter((l) => l.winner != null)
        .map((l) => ({ leg: l.leg, winner: l.winner as string | number }))
    : [];

  const warnings: string[] = [];
  if (!input.winners_verified && input.legs.some((l) => l.winner != null)) {
    warnings.push(
      "Vinnare angavs men winners_verified=false – vinnarna sparas som ej verifierade och används inte för lärande.",
    );
  }
  if (input.legs.length < 8) {
    warnings.push(`Endast ${input.legs.length} av 8 avdelningar angavs.`);
  }
  if (input.row_price == null) warnings.push("Radpris saknas – kostnad kan inte beräknas.");

  let correct = input.correct_count ?? null;
  let spikeHits = input.spike_hits ?? null;
  if (input.winners_verified) {
    const computedCorrect = input.legs.filter(
      (l) => l.winner != null && l.selected.some((s) => sameValue(s, l.winner)),
    ).length;
    const computedSpikeHits = input.legs.filter(
      (l) => isSpikeLeg(l) && l.winner != null && l.selected.some((s) => sameValue(s, l.winner)),
    ).length;
    if (correct != null && correct !== computedCorrect) {
      warnings.push(`Angivet antal rätt (${correct}) skiljer sig från beräknat (${computedCorrect}).`);
    }
    correct = correct ?? computedCorrect;
    spikeHits = spikeHits ?? computedSpikeHits;
  }

  const cost = input.stated_cost ?? computedCost;
  const net =
    input.net_result ?? (input.payout != null && cost != null ? Number((input.payout - cost).toFixed(2)) : null);

  const usableForLearning =
    input.data_quality === "verified" ||
    (input.data_quality === "partially_verified" && input.winners_verified);
  if (!usableForLearning) {
    warnings.push("Datakvaliteten räcker inte för lärande – posten sparas men används inte i statistik.");
  }

  const rowsMismatch = input.stated_rows != null && input.stated_rows !== computedRows;
  const costMismatch =
    input.stated_cost != null && computedCost != null && Math.abs(input.stated_cost - computedCost) > 0.5;
  if (rowsMismatch) {
    warnings.push(
      `Angivet radantal (${input.stated_rows}) skiljer sig från beräknat (${computedRows}). Båda sparas.`,
    );
  }
  if (costMismatch) {
    warnings.push(
      `Angiven kostnad (${input.stated_cost}) skiljer sig från beräknad (${computedCost}). Båda sparas.`,
    );
  }

  const row = {
    group_id: groupId,
    idempotency_key: key,
    status: "imported_history",
    track_name: input.track_name ?? null,
    race_date: input.race_date,
    bet_stop_at: input.bet_stop_at ?? null,
    budget: input.budget ?? null,
    row_price: input.row_price ?? null,
    stated_cost: input.stated_cost ?? null,
    computed_cost: computedCost,
    stated_rows: input.stated_rows ?? null,
    computed_rows: computedRows,
    legs: input.legs,
    spikes,
    winners,
    winners_verified: input.winners_verified,
    correct_count: correct,
    spike_hits: spikeHits,
    payout: input.payout ?? null,
    net_result: net,
    analysis: input.analysis ?? null,
    lessons: input.lessons ?? null,
    data_quality: input.data_quality,
    source: input.source ?? null,
    uncertainty_note: input.uncertainty_note ?? null,
    systems: input.systems,
    usable_for_learning: usableForLearning,
    imported_by: userId,
  };

  return { row, warnings, spikes, computedRows, computedCost, rowsMismatch, costMismatch, correct, spikeHits, net, usableForLearning };
}

export type HistoryImportOutcome = {
  ok: boolean;
  mode: "preview" | "import";
  message: string;
  errors: { round: number; path: string; message: string }[];
  preview: HistoryRoundPreview[];
  imported: number;
  skipped: number;
  overwritten: number;
  economy_note: string;
  import_batch_id?: string | null;
  imported_at?: string | null;
  results?: { idempotency_key: string; action: "created" | "overwritten" | "skipped" | "failed"; id: string | null; message?: string }[];
};

export type HistoryImportOptions = {
  /** Spårbarhet: samma id sparas i revisionsloggen för hela importen. */
  batchId?: string | null;
  /** Obligatorisk motivering vid överskrivning. */
  reason?: string | null;
};

export async function processHistoryImport(
  supabase: SupabaseClient,
  groupId: string,
  userId: string | null,
  raw: unknown,
  options: HistoryImportOptions = {},
): Promise<HistoryImportOutcome> {
  const parsed = historyImportSchemaZod.safeParse(raw);

  const economyNote =
    "Historikposter är helt åtskilda från gruppens ekonomi – ingen insats eller transaktion har bokförts.";

  if (!parsed.success) {
    return {
      ok: false,
      mode: "preview",
      message: "Valideringen misslyckades. Inget sparades.",
      errors: parsed.error.issues.map((i) => ({
        round: typeof i.path[1] === "number" ? i.path[1] + 1 : 0,
        path: i.path.join("."),
        message: i.message,
      })),
      preview: [],
      imported: 0,
      skipped: 0,
      overwritten: 0,
      economy_note: economyNote,
    };
  }

  const input = parsed.data;
  const built = input.rounds.map((r) => buildRow(r, groupId, userId));
  const keys = built.map((b) => b.row.idempotency_key);

  const duplicateKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (duplicateKeys.length > 0) {
    return {
      ok: false,
      mode: input.mode,
      message: `Samma omgång förekommer flera gånger i importen: ${[...new Set(duplicateKeys)].join(", ")}`,
      errors: [],
      preview: [],
      imported: 0,
      skipped: 0,
      overwritten: 0,
      economy_note: economyNote,
    };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("imported_history_rounds")
    .select("*")
    .eq("group_id", groupId)
    .in("idempotency_key", keys);
  if (existingError) {
    return {
      ok: false,
      mode: input.mode,
      message: existingError.message,
      errors: [],
      preview: [],
      imported: 0,
      skipped: 0,
      overwritten: 0,
      economy_note: economyNote,
    };
  }

  const existing = new Map(
    (existingRows ?? []).map((r: any) => [r.idempotency_key as string, r]),
  );

  const DIFF_FIELDS = [
    "track_name",
    "race_date",
    "row_price",
    "stated_rows",
    "computed_rows",
    "stated_cost",
    "computed_cost",
    "payout",
    "net_result",
    "correct_count",
    "spike_hits",
    "data_quality",
    "winners_verified",
    "source",
  ] as const;

  const preview: HistoryRoundPreview[] = built.map((b) => {
    const existingRow = existing.get(b.row.idempotency_key) ?? null;
    const status: HistoryRoundPreview["status"] = !existingRow
      ? "new"
      : input.overwrite_existing
        ? "will_overwrite"
        : "duplicate_skipped";
    const warnings = [...b.warnings];
    if (status === "duplicate_skipped") {
      warnings.push("Omgången finns redan importerad. Sätt overwrite_existing=true för att skriva över.");
    }

    const missing: string[] = [];
    if (b.row.track_name == null) missing.push("bana");
    if (b.row.row_price == null) missing.push("radpris");
    if (b.row.payout == null) missing.push("vinst");
    if (b.row.correct_count == null) missing.push("antal rätt");
    if (!b.row.winners_verified) missing.push("verifierade vinnare");
    if (b.row.source == null) missing.push("informationskälla");

    const differences = existingRow
      ? DIFF_FIELDS.map((f) => ({
          field: f,
          existing: (existingRow as any)[f] ?? null,
          incoming: (b.row as any)[f] ?? null,
        })).filter(
          (d) => JSON.stringify(d.existing ?? null) !== JSON.stringify(d.incoming ?? null),
        )
      : [];

    return {
      idempotency_key: b.row.idempotency_key,
      track_name: b.row.track_name,
      race_date: b.row.race_date,
      legs_count: b.row.legs.length,
      legs: b.row.legs,
      systems_count: b.row.systems.length,
      winners: b.row.winners,
      source: b.row.source,
      uncertainty_note: b.row.uncertainty_note,
      missing_fields: missing,
      computed_rows: b.computedRows,
      stated_rows: b.row.stated_rows,
      rows_mismatch: b.rowsMismatch,
      computed_cost: b.computedCost,
      stated_cost: b.row.stated_cost,
      cost_mismatch: b.costMismatch,
      spikes: b.spikes,
      correct_count: b.correct,
      spike_hits: b.spikeHits,
      payout: b.row.payout,
      net_result: b.net,
      data_quality: b.row.data_quality,
      winners_verified: b.row.winners_verified,
      usable_for_learning: b.usableForLearning,
      status,
      existing_id: existingRow ? (existingRow.id as string) : null,
      existing_snapshot: existingRow,
      differences,
      warnings,
    };
  });


  if (input.mode === "preview") {
    return {
      ok: true,
      mode: "preview",
      message:
        "Förhandsgranskning – inget har sparats. Skicka samma data med mode='import' för att spara.",
      errors: [],
      preview,
      imported: 0,
      skipped: 0,
      overwritten: 0,
      economy_note: economyNote,
    };
  }

  let imported = 0;
  let skipped = 0;
  let overwritten = 0;
  let failed = 0;
  const batchId = options.batchId ?? crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const results: NonNullable<HistoryImportOutcome["results"]> = [];

  for (const b of built) {
    const existingRow: any = existing.get(b.row.idempotency_key);
    const existingId: string | undefined = existingRow?.id;
    if (existingId && !input.overwrite_existing) {
      skipped += 1;
      results.push({ idempotency_key: b.row.idempotency_key, action: "skipped", id: existingId });
      continue;
    }
    if (existingId) {
      const { imported_by: _ignored, ...updateRow } = b.row;
      const { error } = await supabase
        .from("imported_history_rounds")
        .update(updateRow)
        .eq("id", existingId);
      if (error) {
        failed += 1;
        results.push({
          idempotency_key: b.row.idempotency_key,
          action: "failed",
          id: existingId,
          message: error.message,
        });
        continue;
      }
      overwritten += 1;
      results.push({ idempotency_key: b.row.idempotency_key, action: "overwritten", id: existingId });
      continue;
    }
    const { data: insertedRow, error } = await supabase
      .from("imported_history_rounds")
      .insert(b.row)
      .select("id")
      .maybeSingle();
    if (error) {
      failed += 1;
      results.push({
        idempotency_key: b.row.idempotency_key,
        action: "failed",
        id: null,
        message: error.message,
      });
      continue;
    }
    imported += 1;
    results.push({
      idempotency_key: b.row.idempotency_key,
      action: "created",
      id: (insertedRow?.id as string) ?? null,
    });
  }

  // Revisionslogg – spårbar via import_batch_id. Innehåller aldrig hemligheter.
  await supabase.from("activity_log").insert({
    group_id: groupId,
    user_id: userId,
    event_type: "history_import",
    description: `Historikimport: ${imported} nya, ${overwritten} överskrivna, ${skipped} överhoppade, ${failed} misslyckade.`,
    after_value: {
      import_batch_id: batchId,
      imported_at: importedAt,
      overwrite_existing: input.overwrite_existing,
      reason: options.reason ?? null,
      results,
    },
  });

  return {
    ok: failed === 0,
    mode: "import",
    message:
      failed === 0
        ? `Klart: ${imported} nya, ${overwritten} överskrivna, ${skipped} överhoppade (fanns redan). Status: Importerad historik.`
        : `Delvis lyckad import: ${imported} nya, ${overwritten} överskrivna, ${skipped} överhoppade, ${failed} misslyckade.`,
    errors: [],
    preview,
    imported,
    skipped,
    overwritten,
    economy_note: economyNote,
    import_batch_id: batchId,
    imported_at: importedAt,
    results,
  };
}

