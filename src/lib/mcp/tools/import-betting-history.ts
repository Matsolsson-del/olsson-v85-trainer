import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "import_betting_history",
  title: "Importera historiska V85-spel",
  description:
    "Importerar en eller flera historiska V85-omgångar som avslutade historikposter med statusen 'Importerad historik'. Kör alltid mode='preview' först – då returneras förhandsgranskning och valideringsfel utan att något sparas. Importen är idempotent, skriver aldrig över befintliga poster utan overwrite_existing=true, importerar aldrig osäkra uppgifter som verifierade och påverkar aldrig gruppens ekonomi. Hämta formatet med get_history_import_format.",
  inputSchema: {
    history_json: z
      .string()
      .describe(
        "Hela historiken som en JSON-sträng enligt get_history_import_format: { mode, overwrite_existing, rounds: [...] }.",
      ),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ history_json }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const fail = (text: string) => ({
      content: [{ type: "text" as const, text }],
      isError: true as const,
    });

    let payload: unknown;
    try {
      payload = JSON.parse(history_json);
    } catch {
      return fail("history_json är inte giltig JSON. Hämta formatet med get_history_import_format.");
    }

    const supabase = supabaseForUser(ctx);
    const { data: members, error } = await supabase
      .from("group_members")
      .select("group_id")
      .order("created_at")
      .limit(1);
    if (error) return fail(error.message);
    const groupId = members?.[0]?.group_id as string | undefined;
    if (!groupId) {
      return fail("Hittade ingen grupp för din användare. Öppna Travhubben och välj person först.");
    }

    const { processHistoryImport } = await import("@/lib/history-import.server");
    const outcome = await processHistoryImport(supabase, groupId, ctx.getUserId() ?? null, payload);
    const text = JSON.stringify(outcome, null, 2);

    if (!outcome.ok) return { content: [{ type: "text" as const, text }], isError: true as const };
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: outcome,
    };
  },
});
