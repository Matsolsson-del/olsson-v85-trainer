import { defineTool } from "@lovable.dev/mcp-js";
import {
  exampleHistoryImportPayload,
  historyImportRules,
  historyImportSchema,
} from "@/lib/history-import-format";

export default defineTool({
  name: "get_history_import_format",
  title: "Hämta format för historikimport",
  description:
    "Returnerar ett strikt JSON-schema plus ett komplett exempel för import av historiska V85-spel med import_betting_history. Innehåller bana, datum, budget, radpris, angivet och beräknat radantal/kostnad, valda hästar per avdelning, spikar, verifierade vinnare, antal rätt, utbetalning, nettoresultat, analys, lärdomar, datakvalitet, källa, osäkerhetsnotering samt ursprungligt och reviderade system. Anropa detta först.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: {},
  handler: () => {
    const payload = {
      schema: historyImportSchema(),
      rules: historyImportRules(),
      example: exampleHistoryImportPayload(),
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
