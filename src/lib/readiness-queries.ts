import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoundData } from "@/lib/travhub-queries";

export type Readiness = {
  ready: boolean;
  missing: string[];
  latestMarketAt: string | null;
  legs: number;
  entries: number;
};

/** Kontrollerar att kritiska uppgifter finns innan omgången kan kallas analysklar. */
export function evaluateReadiness(data: RoundData | undefined): Readiness {
  if (!data) return { ready: false, missing: ["Underlaget är inte hämtat"], latestMarketAt: null, legs: 0, entries: 0 };

  const missing: string[] = [];
  const round: any = data.round;
  const races: any[] = data.races ?? [];

  if (!round.track_id) missing.push("Bana");
  if (!round.bet_stop_at) missing.push("Tid för spelstopp");
  if (races.length < 8) missing.push(`Alla åtta avdelningar (${races.length} finns)`);

  let entries = 0;
  let latestMarketAt: string | null = null;
  const legsWithoutEntries: number[] = [];
  const legsWithoutDrivers: number[] = [];
  const legsWithoutMarket: number[] = [];

  for (const race of races) {
    const list = (race.race_entries ?? []).filter((e: any) => !e.scratched);
    entries += list.length;
    if (list.length < 5) legsWithoutEntries.push(race.leg_number);
    if (list.some((e: any) => !e.drivers?.name)) legsWithoutDrivers.push(race.leg_number);

    let hasMarket = false;
    for (const e of list) {
      for (const s of e.market_snapshots ?? []) {
        hasMarket = true;
        if (!latestMarketAt || String(s.captured_at) > latestMarketAt) latestMarketAt = s.captured_at;
      }
    }
    if (!hasMarket) legsWithoutMarket.push(race.leg_number);
  }

  if (legsWithoutEntries.length)
    missing.push(`Startfält i avdelning ${legsWithoutEntries.join(", ")}`);
  if (legsWithoutDrivers.length)
    missing.push(`Kusk i avdelning ${legsWithoutDrivers.join(", ")}`);
  if (legsWithoutMarket.length)
    missing.push(`Streckprocent i avdelning ${legsWithoutMarket.join(", ")}`);

  return { ready: missing.length === 0, missing, latestMarketAt, legs: races.length, entries };
}

/** Var underlaget kommer ifrån och när det hämtades. */
export function useDataOrigin(roundId: string | null) {
  return useQuery({
    queryKey: ["data-origin", roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const [{ data: imports }, { data: quality }] = await Promise.all([
        supabase
          .from("data_imports")
          .select("id, import_type, created_at, result_summary, data_sources:source_id(name, kind)")
          .eq("round_id", roundId!)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("data_quality_reports")
          .select("*")
          .eq("round_id", roundId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { imports: imports ?? [], quality: quality ?? null };
    },
  });
}

export function useBetSnapshot(roundId: string | null) {
  return useQuery({
    queryKey: ["bet-snapshot", roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bet_snapshots")
        .select("*")
        .eq("round_id", roundId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useFinalCheck(roundId: string | null) {
  return useQuery({
    queryKey: ["final-check", roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("final_checks")
        .select("*")
        .eq("round_id", roundId!)
        .order("run_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSystemCandidates(roundId: string | null) {
  return useQuery({
    queryKey: ["system-candidates", roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_candidates")
        .select("*")
        .eq("round_id", roundId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Hur gammalt underlaget är, i vardagligt språk. */
export function freshnessLabel(iso: string | null | undefined): string {
  if (!iso) return "Ingen hämtning ännu";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Hämtat just nu";
  if (diffMin < 60) return `Hämtat för ${diffMin} minuter sedan`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `Hämtat för ${hours} timmar sedan`;
  const days = Math.round(hours / 24);
  return `Hämtat för ${days} ${days === 1 ? "dag" : "dagar"} sedan`;
}
