/**
 * Underlag till resultatöversikten: gruppens utfall och varje spelares träffbild.
 * Endast serverkod.
 */

import { collectPersonalData, type PersonalStats } from "@/lib/personal-review.server";
import { buildRoundLegs, type RoundLeg } from "@/lib/round-legs";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function maybeNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type RoundRow = {
  roundId: string;
  date: string;
  track: string | null;
  status: string;
  cost: number;
  winnings: number;
  net: number;
  correctLegs: number | null;
  legs: number;
  /** Avdelningsvis facit från den låsta systemversionen och officiellt resultat. */
  legDetails: RoundLeg[];
  /** Första tydliga lärdomen ur efterrapporten, om den finns. */
  lesson: string | null;
  settlementStatus: string | null;
};

export type MemberRow = {
  userId: string;
  name: string;
  stats: PersonalStats;
};


export async function getDashboardData(groupId: string) {
  const admin = await getAdmin();

  const { data: rounds, error } = await admin
    .from("rounds")
    .select(
      `id, race_date, status, budget,
       tracks(name),
       round_results(group_winnings, v85_payout),
       races(id, race_results(winner_entry_id)),
       systems(system_versions(calculated_cost, locked_at, system_selections(race_id, race_entry_id)))`,
    )
    .eq("group_id", groupId)
    .eq("is_demo", false)
    .order("race_date", { ascending: false })
    .limit(60);
  if (error) throw error;

  const roundIds = (rounds ?? []).map((r: any) => r.id);

  // Senaste avräkningen per omgång: en post per omgång, inga dubbletter.
  const settlementByRound = new Map<string, any>();
  const lessonByRound = new Map<string, string | null>();
  if (roundIds.length > 0) {
    const [{ data: settlements }, { data: postmortems }] = await Promise.all([
      admin
        .from("round_settlements")
        .select("round_id, status, system_cost, total_cost, payout_total, net, winners, calculation, created_at")
        .in("round_id", roundIds)
        .order("created_at", { ascending: true }),
      admin
        .from("round_postmortems")
        .select("round_id, max_three_changes_to_test, approved_text")
        .in("round_id", roundIds),
    ]);
    for (const s of settlements ?? []) settlementByRound.set(s.round_id, s);
    for (const p of postmortems ?? []) {
      lessonByRound.set(p.round_id, firstLesson(p.max_three_changes_to_test ?? p.approved_text));
    }
  }

  const roundRows: RoundRow[] = (rounds ?? []).map((r: any) => {
    const settlement = settlementByRound.get(r.id) ?? null;
    const versions = (r.systems ?? []).flatMap((s: any) => s.system_versions ?? []);
    const locked = versions
      .filter((v: any) => v.locked_at)
      .sort((a: any, b: any) => String(b.locked_at).localeCompare(String(a.locked_at)))[0];

    const cost =
      maybeNum(settlement?.total_cost) ??
      maybeNum(settlement?.system_cost) ??
      (locked ? num(locked.calculated_cost) : 0);
    const winnings =
      maybeNum(settlement?.payout_total) ?? num(r.round_results?.[0]?.group_winnings);

    const winners = new Map<string, string>();
    for (const race of r.races ?? []) {
      const w = race.race_results?.[0]?.winner_entry_id;
      if (w) winners.set(race.id, w);
    }
    let correctLegs: number | null = null;
    if (locked && winners.size > 0) {
      const selected = new Set(
        (locked.system_selections ?? []).map((s: any) => `${s.race_id}:${s.race_entry_id}`),
      );
      correctLegs = 0;
      for (const [raceId, entryId] of winners) {
        if (selected.has(`${raceId}:${entryId}`)) correctLegs++;
      }
    }
    const calcCorrect = maybeNum(settlement?.calculation?.correctLegs);
    if (calcCorrect !== null) correctLegs = calcCorrect;

    const legDetails = settlement
      ? buildRoundLegs(settlement.calculation, settlement.winners)
      : [];

    return {
      roundId: r.id,
      date: r.race_date,
      track: r.tracks?.name ?? null,
      status: r.status,
      cost,
      winnings,
      net: winnings - cost,
      correctLegs,
      legs: legDetails.length || (r.races ?? []).length,
      legDetails,
      lesson: lessonByRound.get(r.id) ?? null,
      settlementStatus: settlement?.status ?? null,
    };
  });


  const played = roundRows.filter((r) => r.cost > 0 || r.winnings > 0);
  const totals = {
    rounds: played.length,
    cost: Math.round(played.reduce((a, r) => a + r.cost, 0)),
    winnings: Math.round(played.reduce((a, r) => a + r.winnings, 0)),
    net: Math.round(played.reduce((a, r) => a + r.net, 0)),
    bestRound: played.reduce<RoundRow | null>((best, r) => (!best || r.net > best.net ? r : best), null),
    roundsWithWin: played.filter((r) => r.winnings > 0).length,
    avgCorrectLegs: (() => {
      const vals = played.map((r) => r.correctLegs).filter((v): v is number => v !== null);
      return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    })(),
    bestCorrectLegs: (() => {
      const vals = played.map((r) => r.correctLegs).filter((v): v is number => v !== null);
      return vals.length ? Math.max(...vals) : null;
    })(),
  };

  const { data: members } = await admin
    .from("group_members")
    .select("user_id, profiles(display_name)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  const memberRows: MemberRow[] = [];
  for (const m of members ?? []) {
    const { stats } = await collectPersonalData(groupId, m.user_id);
    memberRows.push({
      userId: m.user_id,
      name: m.profiles?.display_name ?? "Medlem",
      stats,
    });
  }

  return { rounds: roundRows.slice(0, 20), totals, members: memberRows };
}
