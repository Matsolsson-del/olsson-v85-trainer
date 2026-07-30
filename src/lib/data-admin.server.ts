/**
 * Export av gruppens data, radering av historik och demoläge.
 * Endast serverkod (service role) – aldrig importerad i webbläsaren.
 */

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Bygger en CSV-sträng med semikolon som avgränsare (fungerar i svensk Excel). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [headers.join(";")];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(";"));
  return lines.join("\n");
}

export type GroupExport = {
  exportedAt: string;
  group: any;
  rounds: any[];
  ledger: any[];
  snapshots: any[];
  postmortems: any[];
  members: any[];
};

/** Hämtar hela gruppens historik som ett JSON-vänligt objekt. */
export async function exportGroupData(groupId: string): Promise<GroupExport> {
  const db = await getAdmin();

  const [group, rounds, ledger, snapshots, members] = await Promise.all([
    db.from("groups").select("*").eq("id", groupId).maybeSingle(),
    db
      .from("rounds")
      .select(
        `id, race_date, status, budget, row_price, is_demo, submitted_manually_at, created_at,
         tracks(name),
         round_results(group_winnings, v85_payout, registered_at),
         races(id, leg_number, name, race_results(winner_entry_id)),
         systems(name, system_versions(version_number, calculated_rows, calculated_cost, locked_at)),
         round_postmortems(approved_text, approved_at)`,
      )
      .eq("group_id", groupId)
      .order("race_date", { ascending: false }),
    db
      .from("ledger_transactions")
      .select("*")
      .eq("group_id", groupId)
      .order("transaction_date", { ascending: false }),
    db
      .from("bet_snapshots")
      .select("id, round_id, submitted_at, rows_count, cost, responsible_user_id")
      .eq("group_id", groupId)
      .order("submitted_at", { ascending: false }),
    db.from("group_members").select("user_id, role, share_percent, profiles(display_name)").eq("group_id", groupId),
  ]);

  const roundRows = rounds.data ?? [];

  return {
    exportedAt: new Date().toISOString(),
    group: group.data ?? null,
    rounds: roundRows,
    ledger: ledger.data ?? [],
    snapshots: snapshots.data ?? [],
    postmortems: roundRows.flatMap((r: any) =>
      (r.round_postmortems ?? []).map((p: any) => ({ round_id: r.id, race_date: r.race_date, ...p })),
    ),
    members: members.data ?? [],
  };
}

/** Plattar ut exporten till CSV-tabeller. */
export function exportToCsvFiles(data: GroupExport): { name: string; content: string }[] {
  const rounds = data.rounds.map((r: any) => {
    const versions = (r.systems ?? []).flatMap((s: any) => s.system_versions ?? []);
    const locked = versions
      .filter((v: any) => v.locked_at)
      .sort((a: any, b: any) => String(b.locked_at).localeCompare(String(a.locked_at)))[0];
    const winnings = Number(r.round_results?.[0]?.group_winnings ?? 0);
    const cost = Number(locked?.calculated_cost ?? 0);
    return {
      datum: r.race_date,
      bana: r.tracks?.name ?? "",
      status: r.status,
      demo: r.is_demo ? "ja" : "nej",
      avdelningar: (r.races ?? []).length,
      rader: locked?.calculated_rows ?? "",
      insats: cost,
      vinst: winnings,
      netto: winnings - cost,
      inlamnat: r.submitted_manually_at ?? "",
    };
  });

  const ledger = data.ledger.map((t: any) => ({
    datum: t.transaction_date,
    typ: t.transaction_type,
    belopp: t.amount,
    notering: t.note ?? "",
  }));

  return [
    { name: "omgangar.csv", content: toCsv(rounds) },
    { name: "ekonomi.csv", content: toCsv(ledger) },
  ];
}

/** Raderar historik. `scope` styr om allt eller bara demodata tas bort. */
export async function deleteGroupHistory(groupId: string, scope: "demo" | "all") {
  const db = await getAdmin();

  const query = db.from("rounds").select("id").eq("group_id", groupId);
  const { data: rounds, error } = scope === "demo" ? await query.eq("is_demo", true) : await query;
  if (error) throw error;
  const ids = (rounds ?? []).map((r: any) => r.id);

  if (ids.length > 0) {
    await db.from("rounds").delete().in("id", ids);
  }
  if (scope === "all") {
    await db.from("ledger_transactions").delete().eq("group_id", groupId);
  }

  return { deletedRounds: ids.length };
}

const DEMO_HORSES = [
  "Demo Diamant",
  "Övningens Stjärna",
  "Testa Lugnt",
  "Fiktiv Fart",
  "Provkörning",
  "Sagolik Sväng",
  "Blyg Broms",
  "Kaffe Kusken",
  "Snabba Stigen",
  "Lugna Loppet",
];
const DEMO_DRIVERS = ["Anna Övning", "Erik Exempel", "Karin Kopia", "Lars Låtsas", "Nina Nolla"];

async function ensureRow(db: any, table: string, name: string) {
  const { data } = await db.from(table).select("id").eq("name", name).maybeSingle();
  if (data?.id) return data.id as string;
  const { data: created, error } = await db.from(table).insert({ name }).select("id").single();
  if (error) throw error;
  return created.id as string;
}

/** Skapar en demoomgång med påhittade hästar. Påverkar aldrig riktig statistik. */
export async function createDemoRound(groupId: string, userId: string) {
  const db = await getAdmin();

  const trackId = await ensureRow(db, "tracks", "Demobanan");
  const horseIds: string[] = [];
  for (const name of DEMO_HORSES) horseIds.push(await ensureRow(db, "horses", name));
  const driverIds: string[] = [];
  for (const name of DEMO_DRIVERS) driverIds.push(await ensureRow(db, "drivers", name));

  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 3);
  const dateStr = raceDate.toISOString().slice(0, 10);

  const { data: round, error } = await db
    .from("rounds")
    .insert({
      group_id: groupId,
      product_type: "V85",
      track_id: trackId,
      race_date: dateStr,
      bet_stop_at: new Date(raceDate.getTime() + 16 * 3600 * 1000).toISOString(),
      row_price: 0.5,
      budget: 500,
      status: "individual_analysis",
      is_demo: true,
      general_notes: "Demoomgång med påhittade hästar. Räknas aldrig in i statistik eller ekonomi.",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  let entries = 0;
  for (let leg = 1; leg <= 8; leg++) {
    const { data: race, error: raceError } = await db
      .from("races")
      .insert({
        round_id: round.id,
        leg_number: leg,
        external_race_number: leg,
        name: `Demolopp ${leg}`,
        start_at: new Date(raceDate.getTime() + (16 + leg) * 3600 * 1000).toISOString(),
        distance_m: 2140,
        start_method: leg % 2 === 0 ? "auto" : "volt",
        status: "open",
      })
      .select("id")
      .single();
    if (raceError) throw raceError;

    const shares = [28, 20, 14, 11, 9, 7, 5, 3, 2, 1];
    const rows = horseIds.map((horseId, i) => ({
      race_id: race.id,
      horse_id: horseId,
      driver_id: driverIds[(leg + i) % driverIds.length],
      start_number: i + 1,
      post_position: i + 1,
      base_distance_m: 2140,
      age: 5 + (i % 4),
      sex: i % 2 === 0 ? "v" : "h",
      scratched: false,
    }));
    const { data: inserted, error: entryError } = await db
      .from("race_entries")
      .insert(rows)
      .select("id");
    if (entryError) throw entryError;
    entries += inserted.length;

    await db.from("market_snapshots").insert(
      inserted.map((e: any, i: number) => ({
        race_entry_id: e.id,
        bet_share_percent: shares[i] ?? 1,
        captured_at: new Date().toISOString(),
        created_by: userId,
      })),
    );
  }

  await db.from("activity_log").insert({
    group_id: groupId,
    round_id: round.id,
    user_id: userId,
    event_type: "demo_round_created",
    description: "Demoomgång skapad för övning",
  });

  return { roundId: round.id, races: 8, entries };
}
