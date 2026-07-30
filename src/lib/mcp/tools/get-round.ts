import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_round",
  title: "Hämta omgång med startfält",
  description:
    "Hämta en omgång med alla åtta avdelningar och komplett startfält (häst, kusk, tränare, spår, distans, struken).",
  inputSchema: {
    round_id: z.string().describe("Omgångens id (från list_rounds)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ round_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select(
        "id, race_date, product_type, status, budget, row_price, bet_stop_at, general_notes, tracks(name)",
      )
      .eq("id", round_id)
      .maybeSingle();
    if (roundError) return { content: [{ type: "text", text: roundError.message }], isError: true };
    if (!round) return { content: [{ type: "text", text: "Omgången hittades inte." }], isError: true };

    const { data: races, error: racesError } = await supabase
      .from("races")
      .select(
        "id, leg_number, name, distance_m, start_method, start_at, race_class, race_entries(start_number, post_position, scratched, base_distance_m, age, earnings, horses(name), drivers(name), trainers(name))",
      )
      .eq("round_id", round_id)
      .order("leg_number");
    if (racesError) return { content: [{ type: "text", text: racesError.message }], isError: true };

    const payload = { round, races: races ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
