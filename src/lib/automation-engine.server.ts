/**
 * Automationsmotorn för torsdagsimporten.
 *
 * Samma motor används av det schemalagda jobbet och av Mats manuella knappar.
 * Motorn producerar bara underlag: den låser aldrig ett system, väljer aldrig
 * slutligt system och markerar aldrig spelet som inlämnat. Den skapar heller
 * aldrig ekonomiska transaktioner.
 * Endast serverkod.
 */
import {
  contentHash,
  factsStatus,
  summarizeSources,
  tipKey,
  type SourceState,
} from "./automation-core";
import {
  accountingSummary,
  emptyAccounting,
  type CandidateVerification,
  type ExpectedRound,
  type RunAccounting,
} from "./tip-validation";
import { matchSlot, nextRetryAt, nextRun, targetSaturday } from "./v85-schedule";
import { SOURCE_REGISTRY, fetchSources, type SourceDefinition } from "./expert-tips-sources.server";

const LOCK_STALE_MINUTES = 20;

export type RunMode = "full" | "followup" | "facts" | "tips";

export type AutomationOutcome = {
  groupId: string;
  runId: string | null;
  status: "success" | "partial" | "waiting" | "failed" | "skipped";
  message: string;
  roundId?: string | null;
  raceDate?: string | null;
  trackName?: string | null;
  races?: number;
  entries?: number;
  tips?: number;
  sources?: SourceState[];
  changes?: number;
};

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/* -------------------------------------------------------------------------- */
/* Lås                                                                        */
/* -------------------------------------------------------------------------- */

async function acquireLock(db: any, key: string): Promise<boolean> {
  const stale = new Date(Date.now() - LOCK_STALE_MINUTES * 60_000).toISOString();
  await db.from("automation_locks").delete().lt("acquired_at", stale);
  const { error } = await db.from("automation_locks").insert({ lock_key: key });
  return !error;
}

async function releaseLock(db: any, key: string) {
  await db.from("automation_locks").delete().eq("lock_key", key);
}

/* -------------------------------------------------------------------------- */
/* Källregister                                                               */
/* -------------------------------------------------------------------------- */

async function ensureSources(db: any, groupId: string) {
  for (const def of SOURCE_REGISTRY) {
    await db.from("expert_tip_sources").upsert(
      {
        group_id: groupId,
        source_key: def.key,
        name: def.name,
        domain: def.domain,
        kind: def.kind,
        enabled: def.enabled,
        access_note: def.accessNote,
      },
      { onConflict: "group_id,source_key", ignoreDuplicates: false },
    );
  }
  const { data } = await db
    .from("expert_tip_sources")
    .select("*")
    .eq("group_id", groupId);
  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Huvudkörning                                                               */
/* -------------------------------------------------------------------------- */

export async function runAutomationForGroup(params: {
  groupId: string;
  mode: RunMode;
  slotKey?: string | null;
  triggeredBy?: string | null;
  now?: Date;
}): Promise<AutomationOutcome> {
  const db = await getAdmin();
  const now = params.now ?? new Date();
  const saturday = targetSaturday(now);
  const lockKey = `automation:${params.groupId}:${saturday}`;

  if (!(await acquireLock(db, lockKey))) {
    return {
      groupId: params.groupId,
      runId: null,
      status: "skipped",
      message: "En körning pågår redan för samma tävlingsdag.",
    };
  }

  const { data: run } = await db
    .from("automation_runs")
    .insert({
      group_id: params.groupId,
      run_type: params.slotKey ? "scheduled" : "manual",
      slot_key: params.slotKey ?? null,
      mode: params.mode,
      status: "running",
      target_race_date: saturday,
      triggered_by: params.triggeredBy ?? null,
    })
    .select("id")
    .single();
  const runId: string = run.id;
  const log: any[] = [];

  try {
    const outcome = await execute(db, { ...params, now, saturday, runId, log });
    await db
      .from("automation_runs")
      .update({
        status: outcome.status,
        finished_at: new Date().toISOString(),
        round_id: outcome.roundId ?? null,
        game_id: outcome.gameId ?? null,
        track_name: outcome.trackName ?? null,
        races_imported: outcome.races ?? 0,
        entries_imported: outcome.entries ?? 0,
        sources_checked: outcome.summary?.checked ?? 0,
        sources_with_tips: outcome.summary?.withTips ?? 0,
        sources_waiting: outcome.summary?.waiting ?? 0,
        tips_imported: outcome.tips ?? 0,
        error_message: outcome.error ?? null,
        log: JSON.parse(JSON.stringify(log)),
      })
      .eq("id", runId);

    return {
      groupId: params.groupId,
      runId,
      status: outcome.status,
      message: outcome.message,
      roundId: outcome.roundId ?? null,
      raceDate: saturday,
      trackName: outcome.trackName ?? null,
      races: outcome.races ?? 0,
      entries: outcome.entries ?? 0,
      tips: outcome.tips ?? 0,
      sources: outcome.sources ?? [],
      changes: outcome.changes ?? 0,
    };
  } catch (error: any) {
    const message = error?.message ?? String(error);
    log.push({ step: "fel", message });
    await db
      .from("automation_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
        log: JSON.parse(JSON.stringify(log)),
      })
      .eq("id", runId);
    return {
      groupId: params.groupId,
      runId,
      status: "failed",
      message: "Tävlingsunderlaget kunde inte hämtas. Appen försöker igen automatiskt.",
    };
  } finally {
    await releaseLock(db, lockKey);
  }
}

type ExecuteResult = {
  status: "success" | "partial" | "waiting" | "failed";
  message: string;
  roundId?: string | null;
  gameId?: string | null;
  trackName?: string | null;
  races?: number;
  entries?: number;
  tips?: number;
  changes?: number;
  sources?: SourceState[];
  summary?: ReturnType<typeof summarizeSources>;
  accounting?: RunAccounting;
  error?: string | null;
};

async function execute(
  db: any,
  ctx: {
    groupId: string;
    mode: RunMode;
    saturday: string;
    runId: string;
    now: Date;
    log: any[];
  },
): Promise<ExecuteResult> {
  const { importOfficialFacts, resolveSaturdayRound } = await import("./atg-import.server");

  /* 1. Identifiera rätt lördagsomgång ------------------------------------ */
  let roundId: string | null = null;
  let trackName: string | null = null;
  let gameId: string | null = null;
  let races = 0;
  let entries = 0;
  let changes = 0;

  if (ctx.mode !== "tips") {
    const pick = await resolveSaturdayRound(ctx.saturday);
    for (const deviation of (pick as any).deviations ?? []) {
      ctx.log.push({ step: "avvikelse", message: deviation });
    }

    if (!pick.ok) {
      ctx.log.push({ step: "omgång", message: `Ingen verifierad V85 för ${ctx.saturday}.` });
      await logActivity(db, ctx.groupId, null, "automation_waiting", "Väntar på tävlingsunderlag");
      return {
        status: "waiting",
        message: "Väntar på tävlingsunderlag",
        summary: summarizeSources([]),
      };
    }

    const facts = await importOfficialFacts({
      groupId: ctx.groupId,
      pick,
      runId: ctx.runId,
    });
    roundId = facts.roundId;
    trackName = facts.trackName;
    gameId = facts.gameId;
    races = facts.races;
    entries = facts.entries;
    changes = facts.changes.length;

    ctx.log.push({
      step: "tävlingsunderlag",
      gameId: facts.gameId,
      created: facts.created,
      races: facts.races,
      entries: facts.entries,
      marketRows: facts.marketRows,
      changes: facts.changes,
      missingFields: facts.missingFields,
    });

    if (facts.races !== 8) {
      ctx.log.push({
        step: "avvikelse",
        message: `Omgången har ${facts.races} avdelningar i stället för åtta.`,
      });
    }

    await logActivity(
      db,
      ctx.groupId,
      roundId,
      facts.created ? "automation_round_created" : "automation_round_updated",
      facts.created
        ? `Veckans V85 hämtad automatiskt: ${facts.trackName} ${facts.raceDate}.`
        : `Tävlingsunderlaget uppdaterat: ${facts.changes.length} ändring(ar).`,
    );
  } else {
    const { data: round } = await db
      .from("rounds")
      .select("id, tracks(name)")
      .eq("group_id", ctx.groupId)
      .eq("race_date", ctx.saturday)
      .eq("is_demo", false)
      .maybeSingle();
    roundId = round?.id ?? null;
    trackName = round?.tracks?.name ?? null;
    const { count } = await db
      .from("races")
      .select("id", { count: "exact", head: true })
      .eq("round_id", roundId ?? "00000000-0000-0000-0000-000000000000");
    races = count ?? 0;
  }

  /* 2. Experttips per källa ---------------------------------------------- */
  const sourceRows = await ensureSources(db, ctx.groupId);
  const dateLabel = new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeZone: "Europe/Stockholm",
  }).format(new Date(`${ctx.saturday}T12:00:00Z`));

  const dueDefinitions: SourceDefinition[] = [];
  const states: SourceState[] = [];

  for (const def of SOURCE_REGISTRY) {
    const row = sourceRows.find((r: any) => r.source_key === def.key);
    const alreadyDone =
      ctx.mode === "followup" &&
      row?.last_status === "ok" &&
      row?.last_checked_at &&
      String(row.last_checked_at).slice(0, 10) >= ctx.saturday.slice(0, 10);
    const backoffActive =
      row?.next_attempt_at && new Date(row.next_attempt_at).getTime() > ctx.now.getTime();

    if (def.kind === "blocked" || !def.enabled) {
      states.push({
        key: def.key,
        name: def.name,
        status: "manual_only",
        tips: 0,
        attempts: 0,
        lastCheckedAt: row?.last_checked_at ?? null,
        message: def.accessNote,
      });
      continue;
    }
    if (alreadyDone || backoffActive) {
      states.push({
        key: def.key,
        name: def.name,
        status: (row?.last_status as any) ?? "pending",
        tips: 0,
        attempts: row?.failure_count ?? 0,
        lastCheckedAt: row?.last_checked_at ?? null,
        message: backoffActive ? "Väntar på nästa automatiska försök." : row?.last_message ?? null,
      });
      continue;
    }
    dueDefinitions.push(def);
  }

  const accounting = emptyAccounting();
  let importedTips = 0;

  if (dueDefinitions.length > 0 && trackName) {
    const expected: ExpectedRound = {
      gameType: "V85",
      raceDate: ctx.saturday,
      trackName,
      gameId,
    };

    const results = await fetchSources({
      sources: dueDefinitions,
      expected,
      dateLabel,
    });

    for (const result of results) {
      const row = sourceRows.find((r: any) => r.source_key === result.key);

      // Alla prövade sidor sparas för revision, även de som underkändes.
      for (const candidate of result.candidates) {
        accounting.candidates++;
        if (candidate.accepted) accounting.accepted++;
        else if (candidate.code === "reclassified_as_news") accounting.reclassified++;
        else accounting.rejected++;
      }
      if (result.candidates.length > 0) {
        await db.from("expert_tip_candidates").insert(
          result.candidates.map((c) => ({
            group_id: ctx.groupId,
            round_id: roundId,
            automation_run_id: ctx.runId,
            race_date: ctx.saturday,
            source_key: c.sourceKey,
            source_name: c.sourceName,
            url: c.url,
            title: c.title,
            classification: c.classification,
            code: c.code,
            accepted: c.accepted,
            game_type_verified: c.gameTypeVerified,
            date_verified: c.dateVerified,
            track_verified: c.trackVerified,
            tip_signals: c.tipSignals,
            reasons: c.reasons,
          })),
        );
      }

      let saved = 0;
      if (result.status === "ok") {
        const outcome = await saveTips(db, {
          groupId: ctx.groupId,
          roundId,
          raceDate: ctx.saturday,
          sourceId: row?.id ?? null,
          tips: result.tips,
          candidates: result.candidates,
        });
        saved = outcome.saved;
        accounting.newTips += outcome.created;
        accounting.updatedTips += outcome.updated;
        accounting.unchangedTips += outcome.unchanged;
        accounting.duplicates += outcome.unchanged;
        importedTips += saved;
      }

      const failed = result.status === "temporary_error";
      const attempts = failed ? (row?.failure_count ?? 0) + 1 : 0;
      await db
        .from("expert_tip_sources")
        .update({
          last_checked_at: ctx.now.toISOString(),
          last_status: result.status,
          last_message: result.message,
          failure_count: attempts,
          next_attempt_at: failed ? nextRetryAt(ctx.now, attempts - 1) : null,
          allowed_url_patterns:
            SOURCE_REGISTRY.find((d) => d.key === result.key)?.allowedUrlPatterns ?? [],
          reject_url_patterns:
            SOURCE_REGISTRY.find((d) => d.key === result.key)?.rejectUrlPatterns ?? [],
          supported_games: SOURCE_REGISTRY.find((d) => d.key === result.key)?.supportedGames ?? [],
          paywall: SOURCE_REGISTRY.find((d) => d.key === result.key)?.paywall ?? false,
          min_interval_minutes:
            SOURCE_REGISTRY.find((d) => d.key === result.key)?.minIntervalMinutes ?? 45,
          last_verified_tip_at:
            result.status === "ok" && saved > 0 ? ctx.now.toISOString() : row?.last_verified_tip_at ?? null,
          quality_status:
            result.status === "ok" && saved > 0
              ? "verified"
              : result.status === "checked_no_tips"
                ? "checked"
                : failed
                  ? "unstable"
                  : "unknown",
        })
        .eq("group_id", ctx.groupId)
        .eq("source_key", result.key);

      states.push({
        key: result.key,
        name: result.name,
        status: result.status,
        tips: saved,
        attempts,
        lastCheckedAt: ctx.now.toISOString(),
        message: result.message,
      });
      ctx.log.push({
        step: "källa",
        key: result.key,
        status: result.status,
        kandidater: result.candidates.length,
        godkända: result.candidates.filter((c) => c.accepted).length,
        underkända: result.candidates
          .filter((c) => !c.accepted)
          .map((c) => ({ url: c.url, orsak: c.code, klass: c.classification })),
        tips: saved,
      });
    }
  } else if (dueDefinitions.length > 0) {
    ctx.log.push({
      step: "källa",
      message: "Banan är inte bekräftad ännu – inga experttips hämtades.",
    });
  }

  /* 3. Verifierade tips totalt för dagen ---------------------------------- */
  const { count: verifiedTotal } = await db
    .from("expert_tips")
    .select("id", { count: "exact", head: true })
    .eq("group_id", ctx.groupId)
    .eq("race_date", ctx.saturday)
    .eq("is_current", true)
    .eq("classification", "expert_tip");
  accounting.verifiedTotal = verifiedTotal ?? 0;

  const summary = summarizeSources(states);
  const facts = factsStatus({ running: false, races, entries });
  const status: ExecuteResult["status"] =
    facts === "ready" && summary.withTips > 0 ? "success" : "partial";

  ctx.log.push({ step: "bokföring", ...accounting, text: accountingSummary(accounting) });

  return {
    status,
    message:
      facts === "ready"
        ? `Tävlingsunderlaget är klart. ${summary.withTips} av ${summary.configured} källor gav verifierade tips ` +
          `(${summary.checkedWithoutTips} kontrollerade utan tips, ${summary.manualOnly} läses bara manuellt).`
        : "Tävlingsunderlaget är delvis hämtat.",
    roundId,
    gameId,
    trackName,
    races,
    entries,
    tips: importedTips,
    changes,
    sources: states,
    summary,
    accounting,
  };
}


/* -------------------------------------------------------------------------- */
/* Tips med versionshistorik                                                  */
/* -------------------------------------------------------------------------- */

async function saveTips(
  db: any,
  params: {
    groupId: string;
    roundId: string | null;
    raceDate: string;
    sourceId: string | null;
    tips: import("./automation-core").TipRecord[];
    candidates: CandidateVerification[];
  },
): Promise<{ saved: number; created: number; updated: number; unchanged: number }> {
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const tip of params.tips) {
    // Varje sparat tips måste kunna spåras till en verifierad kandidatsida.
    const verification = params.candidates.find((c) => c.accepted && c.url === tip.url);
    if (!verification) continue;

    const key = tipKey({
      raceDate: params.raceDate,
      sourceKey: tip.sourceKey,
      expert: tip.expert,
      url: tip.url,
    });
    const hash = contentHash({
      leg: tip.leg,
      topPick: tip.topPick,
      alternatives: tip.alternatives,
      longshot: tip.longshot,
      warning: tip.warning,
      note: tip.note,
    });

    const { data: existing } = await db
      .from("expert_tips")
      .select("id, content_hash, version, is_current")
      .eq("tip_key", key)
      .eq("leg_number", tip.leg)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Exakt samma tips igen: hoppa över helt (idempotens).
    if (existing?.content_hash === hash) {
      unchanged++;
      continue;
    }

    if (existing) {
      // Tidigare version bevaras, men är inte längre den aktuella.
      await db.from("expert_tips").update({ is_current: false }).eq("tip_key", key).eq("leg_number", tip.leg);
    }

    const { error } = await db.from("expert_tips").insert({
      group_id: params.groupId,
      round_id: params.roundId,
      race_date: params.raceDate,
      source_id: params.sourceId,
      source_key: tip.sourceKey,
      source_name: tip.sourceName,
      tip_key: key,
      content_hash: hash,
      version: (existing?.version ?? 0) + 1,
      is_current: true,
      expert: tip.expert ?? null,
      url: tip.url ?? null,
      leg_number: tip.leg,
      top_pick: tip.topPick ?? null,
      alternatives: tip.alternatives ?? [],
      longshot: tip.longshot ?? null,
      warning: tip.warning ?? null,
      note: tip.note ?? null,
      classification: verification.classification,
      verification_code: verification.code,
      game_type_verified: verification.gameTypeVerified,
      date_verified: verification.dateVerified,
      track_verified: verification.trackVerified,
      verification_reasons: verification.reasons,
    });
    if (!error) {
      if (existing) updated++;
      else created++;
    }
  }
  return { saved: created + updated, created, updated, unchanged };
}


async function logActivity(
  db: any,
  groupId: string,
  roundId: string | null,
  eventType: string,
  description: string,
) {
  await db.from("activity_log").insert({
    group_id: groupId,
    round_id: roundId,
    event_type: eventType,
    description,
  });
}

/* -------------------------------------------------------------------------- */
/* Schemalagd ingång                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Anropas av databasens schemaläggare. Kontrollerar svensk lokal tid och gör
 * ingenting om anropet ligger utanför ett planerat tidsfönster.
 */
export async function runScheduledAutomation(now = new Date(), force = false) {
  const slot = matchSlot(now) ?? (force ? { key: "manuell", mode: "full" as const } : null);
  if (!slot) {
    return {
      ran: false,
      reason: "Utanför svenskt tidsfönster – ingen körning.",
      nextRun: nextRun(now).at.toISOString(),
      results: [],
    };
  }

  const db = await getAdmin();
  const { data: groups } = await db.from("groups").select("id");
  const results: AutomationOutcome[] = [];
  for (const group of groups ?? []) {
    results.push(
      await runAutomationForGroup({
        groupId: group.id,
        mode: slot.mode,
        slotKey: slot.key,
        now,
      }),
    );
  }
  return {
    ran: true,
    slot: slot.key,
    nextRun: nextRun(now).at.toISOString(),
    results,
  };
}
