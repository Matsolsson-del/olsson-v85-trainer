import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_system",
  title: "Hämta gruppens system för en omgång",
  description:
    "Hämta nuvarande systemförslag för en omgång: valda startnummer per avdelning, antal rader, kostnad, budget och om versionen är låst.",
  inputSchema: {
    round_id: z.string().describe("Omgångens id (från list_rounds)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ round_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: races, error: racesError } = await supabase
      .from("races")
      .select("id, leg_number, race_entries(id, start_number, scratched, horses(name))")
      .eq("round_id", round_id)
      .order("leg_number");
    if (racesError) return { content: [{ type: "text", text: racesError.message }], isError: true };

    const { data: systems, error: sysError } = await supabase
      .from("systems")
      .select(
        "id, name, system_versions(id, version_number, locked_at, budget, row_price, calculated_rows, calculated_cost, system_selections(race_id, race_entry_id))",
      )
      .eq("round_id", round_id);
    if (sysError) return { content: [{ type: "text", text: sysError.message }], isError: true };

    const versions = (systems ?? []).flatMap((s: any) =>
      (s.system_versions ?? []).map((v: any) => ({ ...v, system_name: s.name })),
    );
    const current = versions.sort((a: any, b: any) => b.version_number - a.version_number)[0];

    const entryById = new Map<string, any>();
    for (const race of races ?? []) {
      for (const entry of (race as any).race_entries ?? []) entryById.set(entry.id, entry);
    }

    const legs = (races ?? []).map((race: any) => {
      const picked = (current?.system_selections ?? [])
        .filter((sel: any) => sel.race_id === race.id)
        .map((sel: any) => entryById.get(sel.race_entry_id))
        .filter(Boolean)
        .map((e: any) => ({ start_number: e.start_number, horse: e.horses?.name ?? null }))
        .sort((a: any, b: any) => a.start_number - b.start_number);
      return { leg_number: race.leg_number, picked };
    });

    const payload = {
      round_id,
      has_system: !!current,
      locked: !!current?.locked_at,
      version_number: current?.version_number ?? null,
      budget: current?.budget ?? null,
      row_price: current?.row_price ?? null,
      rows: current?.calculated_rows ?? null,
      cost: current?.calculated_cost ?? null,
      legs,
      note: "Spelet lämnas alltid in manuellt hos ATG. Inget verktyg kan låsa eller lämna in.",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
