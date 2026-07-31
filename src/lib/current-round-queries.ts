import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentRound, type CurrentRound } from "@/lib/current-round.functions";

/** Hämtar veckans spelbara omgång – samma svar överallt i appen. */
export function useCurrentRound(groupId: string | null, roundId?: string | null) {
  const run = useServerFn(getCurrentRound);
  return useQuery({
    queryKey: ["current-round", groupId, roundId ?? null],
    enabled: Boolean(groupId),
    queryFn: () =>
      run({ data: { groupId: groupId!, roundId: roundId ?? null } }) as Promise<CurrentRound | null>,
  });
}
