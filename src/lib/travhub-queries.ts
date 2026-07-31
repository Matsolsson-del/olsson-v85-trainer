import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const ACTIVE_GROUP_KEY = "travhub.activeGroup";

export function useGroups() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useActiveGroupId() {
  const { data: groups, refetch: refetchGroups } = useGroups();
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    setStored(localStorage.getItem(ACTIVE_GROUP_KEY));
  }, []);

  const groupId = groups?.find((g) => g.id === stored)?.id ?? groups?.[0]?.id ?? null;

  const setActiveGroupId = (id: string) => {
    localStorage.setItem(ACTIVE_GROUP_KEY, id);
    setStored(id);
  };

  return { groupId, setActiveGroupId, groups: groups ?? [], refetchGroups };
}

export function useMembers(groupId: string | null) {
  return useQuery({
    queryKey: ["members", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const ids = (data ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((m) => ({ ...m, profiles: byId.get(m.user_id) ?? null }));
    },
  });
}

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsOwner(groupId: string | null) {
  return useOwnerStatus(groupId).isOwner;
}

/** Ägarstatus med tydliga tillstånd: laddar / fel / klart. */
export function useOwnerStatus(groupId: string | null) {
  const { user, loading: authLoading } = useAuth();
  const membersQuery = useMembers(groupId);
  const members = membersQuery.data;
  const isLoading = authLoading || !groupId || membersQuery.isLoading || !user;
  return {
    isLoading,
    isError: membersQuery.isError,
    isOwner: !!members?.some((m) => m.user_id === user?.id && m.role === "owner"),
  };
}

export function useRounds(groupId: string | null) {
  return useQuery({
    queryKey: ["rounds", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rounds")
        .select("*, tracks:track_id(name)")
        .eq("group_id", groupId!)
        .order("race_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export type RoundData = Awaited<ReturnType<typeof fetchRoundData>>;

export async function fetchRoundData(roundId: string) {
  const [{ data: round, error: roundError }, { data: races, error: racesError }] =
    await Promise.all([
      supabase.from("rounds").select("*, tracks:track_id(name)").eq("id", roundId).single(),
      supabase
        .from("races")
        .select(
          `*,
           race_entries(*, horses:horse_id(name), drivers:driver_id(name), trainers:trainer_id(name),
             market_snapshots(id, bet_share_percent, captured_at)),
           individual_race_assessments(*, individual_entry_assessments(*)),
           group_race_assessments(*, group_entry_assessments(*)),
           race_results(*, entry_results(*)),
           race_postmortems(*)`,
        )
        .eq("round_id", roundId)
        .order("leg_number", { ascending: true }),
    ]);
  if (roundError) throw roundError;
  if (racesError) throw racesError;

  const { data: systems, error: systemsError } = await supabase
    .from("systems")
    .select("*, system_versions(*, system_selections(*), spike_protocols(*))")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });
  if (systemsError) throw systemsError;

  const { data: activity } = await supabase
    .from("activity_log")
    .select("*")
    .eq("round_id", roundId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: roundResult } = await supabase
    .from("round_results")
    .select("*")
    .eq("round_id", roundId)
    .maybeSingle();

  const { data: postmortem } = await supabase
    .from("round_postmortems")
    .select("*")
    .eq("round_id", roundId)
    .maybeSingle();

  return {
    round: round!,
    races: races ?? [],
    systems: systems ?? [],
    activity: activity ?? [],
    roundResult,
    postmortem,
  };
}

export function useRoundData(roundId: string) {
  return useQuery({
    queryKey: ["round", roundId],
    queryFn: () => fetchRoundData(roundId),
  });
}

export function useInvalidateRound(roundId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["round", roundId] });
}

export function useLedger(groupId: string | null) {
  return useQuery({
    queryKey: ["ledger", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_transactions")
        .select("*")
        .eq("group_id", groupId!)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useLogActivity() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      roundId?: string | null;
      eventType: string;
      description?: string;
    }) => {
      const { error } = await supabase.from("activity_log").insert({
        group_id: input.groupId,
        round_id: input.roundId ?? null,
        user_id: user!.id,
        event_type: input.eventType,
        description: input.description ?? null,
      });
      if (error) throw error;
    },
  });
}
