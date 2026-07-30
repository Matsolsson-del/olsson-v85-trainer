import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "import_ai_analysis",
  title: "Importera AI-analys (utkast)",
  description:
    "Skicka in en komplett V85-analys för en omgång som versionshanterat AI-utkast. Använd get_import_format för exakt JSON-format och list_rounds för att hitta omgångens id. Importen skapar aldrig en ny omgång, låser inget system, ändrar inga resultat och lämnar aldrig in spelet – veckans ansvarige väljer och färdigställer.",
  inputSchema: {
    analysis_json: z
      .string()
      .describe(
        "Hela analysen som en JSON-sträng enligt formatet från get_import_format (round, analysis, legs, systems, main_recommendation).",
      ),
    idempotency_key: z
      .string()
      .optional()
      .describe("Valfri unik nyckel så att samma import inte registreras dubbelt."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ analysis_json, idempotency_key }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const fail = (text: string) => ({
      content: [{ type: "text" as const, text }],
      isError: true as const,
    });

    let payload: unknown;
    try {
      payload = JSON.parse(analysis_json);
    } catch {
      return fail("analysis_json är inte giltig JSON. Hämta formatet med get_import_format.");
    }

    // Gruppen härleds från den inloggade medlemmens egna omgångar (RLS gäller).
    const supabase = supabaseForUser(ctx);
    const { data: rounds, error } = await supabase
      .from("rounds")
      .select("group_id")
      .order("race_date", { ascending: false })
      .limit(1);
    if (error) return fail(error.message);
    const groupId = rounds?.[0]?.group_id as string | undefined;
    if (!groupId) {
      return fail("Hittade ingen grupp för din användare. Öppna Travhubben och välj person först.");
    }

    const { processAiImport } = await import("@/lib/ai-import.server");
    const outcome = await processAiImport(groupId, payload, idempotency_key ?? null);
    const text = JSON.stringify(outcome.body);

    if (outcome.status >= 400) {
      return { content: [{ type: "text" as const, text }], isError: true as const };
    }
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: outcome.body,
    };
  },
});
