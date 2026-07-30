import { defineTool } from "@lovable.dev/mcp-js";
import { exampleAiImportPayload } from "@/lib/ai-import-example";

export default defineTool({
  name: "get_import_format",
  title: "Hämta importformat",
  description:
    "Returnerar ett komplett exempel på det JSON-format som import_ai_analysis förväntar sig (omgång, källor, datakvalitet, analys per avdelning, hästar, spikar, skrällar samt tre system: tryggt, balanserat och offensivt). Anropa detta först om du är osäker på formatet.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: {},
  handler: () => {
    const example = exampleAiImportPayload();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(example, null, 2) }],
      structuredContent: { example },
    };
  },
});
