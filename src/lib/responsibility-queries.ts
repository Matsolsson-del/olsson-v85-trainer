import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useRotation(groupId: string | null) {
  return useQuery({
    queryKey: ["rotation", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsibility_rotation")
        .select("*, profiles:user_id(id, display_name, email)")
        .eq("group_id", groupId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useRoundResponsibility(roundId: string | null) {
  return useQuery({
    queryKey: ["round-responsibility", roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("round_responsibility")
        .select("*, profiles:user_id(id, display_name, email)")
        .eq("round_id", roundId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsResponsible(roundId: string | null) {
  const { user } = useAuth();
  const { data } = useRoundResponsibility(roundId);
  return !!user && data?.user_id === user.id;
}

export function useResponsibilityActions(roundId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["round-responsibility", roundId] });

  const assign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("assign_round_responsibility", {
        _round_id: roundId,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("round_responsibility")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("round_id", roundId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const change = useMutation({
    mutationFn: async (vars: {
      userId: string;
      reason: string;
      mode: "continue" | "move_last";
    }) => {
      const { error } = await supabase.rpc("change_round_responsibility", {
        _round_id: roundId,
        _new_user_id: vars.userId,
        _reason: vars.reason,
        _rotation_mode: vars.mode,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { assign, confirm, change };
}

export function useJobRuns(groupId: string | null) {
  return useQuery({
    queryKey: ["job-runs", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_runs")
        .select("*")
        .eq("group_id", groupId!)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useJobs(groupId: string | null) {
  return useQuery({
    queryKey: ["jobs", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("group_id", groupId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
