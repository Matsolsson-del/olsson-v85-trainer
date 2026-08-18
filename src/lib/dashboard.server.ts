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

  const roundRows: RoundRow[] = (rounds ?? []).map((r: any) => {
    const winnings = num(r.round_results?.[0]?.group_winnings);

    const versions = (r.systems ?? []).flatMap((s: any) => s.system_versions ?? []);
    const locked = versions
      .filter((v: any) => v.locked_at)
      .sort((a: any, b: any) => String(b.locked_at).localeCompare(String(a.locked_at)))[0];
    const cost = locked ? num(locked.calculated_cost) : 0;

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

    return {
      roundId: r.id,
      date: r.race_date,
      track: r.tracks?.name ?? null,
      status: r.status,
      cost,
      winnings,
      net: winnings - cost,
      correctLegs,
      legs: (r.races ?? []).length,
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
