import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_market",
  title: "Hämta marknadsfördelning",
  description:
    "Hämta senaste marknadssnapshot (ATG:s spelfördelning i procent per startnummer) för en omgångs avdelningar.",
  inputSchema: {
    round_id: z.string().describe("Omgångens id (från list_rounds)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ round_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: races, error: racesError } = await supabase
      .from("races")
      .select("id, leg_number")
      .eq("round_id", round_id)
      .order("leg_number");
    if (racesError) return { content: [{ type: "text", text: racesError.message }], isError: true };

    const raceIds = (races ?? []).map((r) => r.id);
    if (raceIds.length === 0) {
      return { content: [{ type: "text", text: "Inga avdelningar hittades." }], isError: true };
    }

    const { data: snapshots, error } = await supabase
      .from("market_snapshots")
      .select("*")
      .in("race_id", raceIds)
      .order("captured_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const payload = { races: races ?? [], snapshots: snapshots ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
