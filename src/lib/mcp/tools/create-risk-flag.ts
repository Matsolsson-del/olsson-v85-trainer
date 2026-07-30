import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_risk_flag",
  title: "Skapa riskflagga",
  description:
    "Lägg en riskflagga (varning eller observation) på en omgång, eventuellt kopplad till en avdelning.",
  inputSchema: {
    round_id: z.string().describe("Omgångens id."),
    body: z.string().trim().describe("Vad risken består i, kort och konkret."),
    race_id: z.string().describe("Avdelningens id om flaggan gäller en enskild avdelning.").optional(),
    flag_type: z.string().describe("Typ av flagga, t.ex. 'risk', 'data' eller 'info'.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ round_id, body, race_id, flag_type }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("risk_flags")
      .insert({
        round_id,
        race_id: race_id ?? null,
        body,
        flag_type: flag_type ?? "risk",
        created_by: ctx.getUserId()!,
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { flag: data },
    };
  },
});
