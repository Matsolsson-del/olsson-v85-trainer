/**
 * Säker import av färdig AI-analys (V85) från en extern AI-klient.
 * Endast serverkod. Importen skapar alltid ett AI-utkast och rör aldrig
 * inlämning, ekonomi, resultat, historik eller veckans ansvarige.
 */
import { z } from "zod";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------------------------------- schema --------------------------------- */

const horseSchema = z.object({
  start_number: z.number().int().min(1).max(20),
  name: z.string().min(1).max(120),
  driver: z.string().max(120).nullish(),
  ai_win_probability: z.number().min(0).max(100).nullish(),
  market_percent: z.number().min(0).max(100).nullish(),
  value_assessment: z.string().max(1000).nullish(),
  driver_assessment: z.string().max(1000).nullish(),
  risks: z.string().max(1000).nullish(),
});

const legSchema = z.object({
  leg_number: z.number().int().min(1).max(8),
  analysis: z.string().max(4000).nullish(),
  horses: z.array(horseSchema).min(1).max(20),
  spike_suggestion: z.number().int().min(1).max(20).nullish(),
  longshots: z.array(z.number().int()).max(20).default([]),
  overbet_favourites: z.array(z.number().int()).max(20).default([]),
  uncertainties: z.string().max(2000).nullish(),
});

const systemSchema = z.object({
  profile: z.enum(["tryggt", "balanserat", "offensivt"]),
  rows: z.number().int().min(1).max(1000000),
  cost: z.number().min(0),
  risk_level: z.string().max(60),
  rationale: z.string().max(4000),
  weakest_assumption: z.string().max(2000).nullish(),
  selections: z
    .array(
      z.object({
        leg_number: z.number().int().min(1).max(8),
        start_numbers: z.array(z.number().int().min(1).max(20)).min(1),
      }),
    )
    .min(1)
    .max(8),
});

export const aiImportSchema = z.object({
  idempotency_key: z.string().min(8).max(200).optional(),
  round: z.object({
    external_id: z.string().min(1).max(120),
    track: z.string().min(1).max(120),
    race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "race_date måste vara ÅÅÅÅ-MM-DD"),
    bet_stop_at: z.string().datetime({ offset: true }).nullish(),
  }),
  analysis: z.object({
    analyzed_at: z.string().datetime({ offset: true }),
    analysis_version: z.string().min(1).max(60),
    model_name: z.string().min(1).max(120),
    sources: z.array(z.string().max(300)).min(1).max(50),
    data_quality: z.object({
      score: z.number().int().min(0).max(100),
      notes: z.string().max(2000).nullish(),
      missing: z.array(z.string().max(200)).max(50).default([]),
    }),
  }),
  legs: z.array(legSchema).min(1).max(8),
  systems: z.array(systemSchema).length(3),
  main_recommendation: z.enum(["tryggt", "balanserat", "offensivt"]),
});

export type AiImportPayload = z.infer<typeof aiImportSchema>;

/* ------------------------------- autentisering ------------------------------ */

export type AuthResult =
  | { ok: true; groupId: string }
  | { ok: false; status: number; message: string };

export async function authenticateImport(apiKey: string | null): Promise<AuthResult> {
  if (!apiKey) {
    return { ok: false, status: 401, message: "API-nyckel saknas i huvudet x-api-key." };
  }
  const db = await getAdmin();
  const hash = await sha256Hex(apiKey.trim());
  const { data, error } = await db
    .from("ai_import_settings")
    .select("group_id, enabled, key_hash")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error) return { ok: false, status: 500, message: "Kunde inte kontrollera nyckeln." };
  if (!data) return { ok: false, status: 401, message: "Ogiltig API-nyckel." };
  if (!data.enabled) {
    return { ok: false, status: 403, message: "AI-importen är avstängd i Travhubben." };
  }
  return { ok: true, groupId: data.group_id };
}

/* --------------------------------- import ---------------------------------- */

async function logAttempt(entry: {
  groupId: string | null;
  roundId?: string | null;
  ok: boolean;
  statusCode: number;
  message: string;
  validationErrors?: unknown[];
  idempotencyKey?: string | null;
  versionId?: string | null;
}) {
  try {
    const db = await getAdmin();
    await db.from("ai_import_attempts").insert({
      group_id: entry.groupId,
      round_id: entry.roundId ?? null,
      ok: entry.ok,
      status_code: entry.statusCode,
      message: entry.message,
      validation_errors: entry.validationErrors ?? [],
      idempotency_key: entry.idempotencyKey ?? null,
      version_id: entry.versionId ?? null,
    });
  } catch (e) {
    console.error("Kunde inte logga importförsök", e);
  }
}

/** Hittar exakt en omgång. Skapar aldrig en ny omgång. */
async function matchRound(groupId: string, round: AiImportPayload["round"]) {
  const db = await getAdmin();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    round.external_id,
  );
  if (isUuid) {
    const { data } = await db
      .from("rounds")
      .select("id, group_id, race_date, is_demo")
      .eq("id", round.external_id)
      .eq("group_id", groupId)
      .maybeSingle();
    return data ? [data] : [];
  }
  const { data } = await db
    .from("rounds")
    .select("id, group_id, race_date, is_demo, tracks:track_id(name)")
    .eq("group_id", groupId)
    .eq("race_date", round.race_date);
  const rows = (data ?? []) as any[];
  if (rows.length <= 1) return rows;
  const track = round.track.trim().toLowerCase();
  return rows.filter((r) => String(r.tracks?.name ?? "").trim().toLowerCase() === track);
}

export type ImportOutcome = {
  status: number;
  body: Record<string, unknown>;
};

export async function processAiImport(
  groupId: string,
  rawBody: unknown,
  headerKey: string | null,
): Promise<ImportOutcome> {
  const parsed = aiImportSchema.safeParse(rawBody);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    await logAttempt({
      groupId,
      ok: false,
      statusCode: 422,
      message: "Underlaget följer inte schemat.",
      validationErrors: errors,
      idempotencyKey: headerKey,
    });
    return {
      status: 422,
      body: { error: "validation_failed", message: "Underlaget följer inte schemat.", errors },
    };
  }

  const payload = parsed.data;
  const db = await getAdmin();
  const idempotencyKey =
    headerKey?.trim() ||
    payload.idempotency_key ||
    (await sha256Hex(JSON.stringify(payload)));

  const { data: existing } = await db
    .from("ai_import_versions")
    .select("id, round_id, version")
    .eq("group_id", groupId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    await logAttempt({
      groupId,
      roundId: existing.round_id,
      ok: true,
      statusCode: 200,
      message: "Samma import skickades igen – ingen dubblett skapades.",
      idempotencyKey,
      versionId: existing.id,
    });
    return {
      status: 200,
      body: {
        duplicate: true,
        message: "Importen fanns redan. Ingen ny version skapades.",
        version: existing.version,
        version_id: existing.id,
        round_id: existing.round_id,
        status_label: "AI-utkast",
      },
    };
  }

  const matches = await matchRound(groupId, payload.round);
  if (matches.length !== 1) {
    const message =
      matches.length === 0
        ? "Ingen omgång matchar. Skapa omgången i Travhubben först – importen skapar aldrig nya omgångar."
        : "Flera omgångar matchar. Skicka omgångens id i round.external_id.";
    await logAttempt({
      groupId,
      ok: false,
      statusCode: 409,
      message,
      idempotencyKey,
    });
    return { status: 409, body: { error: "round_not_matched", message } };
  }
  const round = matches[0];

  const { data: last } = await db
    .from("ai_import_versions")
    .select("version")
    .eq("round_id", round.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (last?.version ?? 0) + 1;

  const { data: inserted, error } = await db
    .from("ai_import_versions")
    .insert({
      group_id: groupId,
      round_id: round.id,
      version,
      status: "ai_draft",
      idempotency_key: idempotencyKey,
      external_round_id: payload.round.external_id,
      track_name: payload.round.track,
      race_date: payload.round.race_date,
      bet_stop_at: payload.round.bet_stop_at ?? null,
      analyzed_at: payload.analysis.analyzed_at,
      analysis_version: payload.analysis.analysis_version,
      model_name: payload.analysis.model_name,
      sources: payload.analysis.sources,
      data_quality: payload.analysis.data_quality,
      legs: payload.legs,
      systems: payload.systems,
      main_recommendation: payload.main_recommendation,
      payload,
    })
    .select("id, version")
    .single();

  if (error) {
    await logAttempt({
      groupId,
      roundId: round.id,
      ok: false,
      statusCode: 500,
      message: error.message,
      idempotencyKey,
    });
    return { status: 500, body: { error: "save_failed", message: "Importen kunde inte sparas." } };
  }

  // Spårbarhet: AI-lagret sparas separat från fakta och gruppens beslut.
  try {
    await db.from("analysis_layers").insert({
      round_id: round.id,
      group_id: groupId,
      layer: "ai",
      source_label: `Extern AI-import v${version} (${payload.analysis.model_name})`,
      content: payload as any,
    });
  } catch (e) {
    console.error("Kunde inte spara analyslager", e);
  }

  await logAttempt({
    groupId,
    roundId: round.id,
    ok: true,
    statusCode: 201,
    message: `AI-utkast version ${version} sparat.`,
    idempotencyKey,
    versionId: inserted.id,
  });

  return {
    status: 201,
    body: {
      success: true,
      round_id: round.id,
      version,
      version_id: inserted.id,
      status_label: "AI-utkast",
      is_demo: Boolean((round as any).is_demo),
      message: `AI-utkast version ${version} sparat. Veckans ansvarige väljer och färdigställer systemet.`,
    },
  };
}

export async function logUnauthorized(status: number, message: string, key: string | null) {
  await logAttempt({ groupId: null, ok: false, statusCode: status, message, idempotencyKey: key });
}

/* ------------------------------ inställningar ------------------------------- */

export async function getImportSettings(groupId: string) {
  const db = await getAdmin();
  const { data } = await db
    .from("ai_import_settings")
    .select("group_id, enabled, key_prefix, key_created_at")
    .eq("group_id", groupId)
    .maybeSingle();
  return data ?? { group_id: groupId, enabled: true, key_prefix: null, key_created_at: null };
}

export async function rotateImportKey(groupId: string) {
  const db = await getAdmin();
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw =
    "thub_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const hash = await sha256Hex(raw);
  const { error } = await db.from("ai_import_settings").upsert(
    {
      group_id: groupId,
      enabled: true,
      key_hash: hash,
      key_prefix: raw.slice(0, 12),
      key_created_at: new Date().toISOString(),
    },
    { onConflict: "group_id" },
  );
  if (error) throw error;
  return { apiKey: raw, keyPrefix: raw.slice(0, 12) };
}

export async function setImportEnabled(groupId: string, enabled: boolean) {
  const db = await getAdmin();
  const { error } = await db
    .from("ai_import_settings")
    .upsert({ group_id: groupId, enabled }, { onConflict: "group_id" });
  if (error) throw error;
  return { enabled };
}

export async function listImportAttempts(groupId: string) {
  const db = await getAdmin();
  const { data } = await db
    .from("ai_import_attempts")
    .select("id, ok, status_code, message, validation_errors, idempotency_key, round_id, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}
