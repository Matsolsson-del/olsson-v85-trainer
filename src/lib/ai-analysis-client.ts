import { supabase } from "@/integrations/supabase/client";

type AiDraftResult = { races: number; failed?: number; failures?: string[] };

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 120_000;

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function waitForSavedDraft(roundId: string, startedAt: string): Promise<AiDraftResult> {
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("activity_log")
      .select("description")
      .eq("round_id", roundId)
      .eq("event_type", "ai_draft_generated")
      .gte("created_at", startedAt)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const count = Number(data.description?.match(/för (\d+) avdelning/)?.[1] ?? 8);
      return { races: count };
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error("Analysen tar ovanligt lång tid. Ladda om sidan för att se om den är klar.");
}

/**
 * Serverfunktionen kan hinna spara allt trots att webbläsaren aldrig får sitt slutsvar.
 * Därför följer vi även den sparade aktiviteten och släpper vänteläget när utkastet finns.
 */
export async function runAiDraftReliably(
  roundId: string,
  serverCall: () => Promise<AiDraftResult>,
): Promise<AiDraftResult> {
  const startedAt = new Date(Date.now() - 5_000).toISOString();
  const request = serverCall().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  const saved = waitForSavedDraft(roundId, startedAt).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  const first = await Promise.race([request, saved]);
  if (first.ok) return first.value;

  // Ett nätverksfel kan inträffa efter att servern redan har börjat arbeta.
  // Ge då den sparade analysen en chans att bekräfta att jobbet blev klart.
  const fallback = await saved;
  if (fallback.ok) return fallback.value;
  throw first.error instanceof Error ? first.error : new Error("AI-analysen kunde inte slutföras.");
}