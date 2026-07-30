import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_rounds",
  title: "Lista omgångar",
  description:
    "Lista V85-omgångar i familjens grupp med datum, bana, status, budget och radpris.",
  inputSchema: {
    limit: z.number().int().describe("Max antal omgångar att returnera (standard 10).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("rounds")
      .select(
        "id, race_date, product_type, status, budget, row_price, bet_stop_at, locked_at, submitted_manually_at, tracks(name)",
      )
      .order("race_date", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 10, 1), 50));

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { rounds: data ?? [] },
    };
  },
});
