import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "propose_system",
  title: "Föreslå system (utkast)",
  description:
    "Skriv in ett systemförslag som utkast för en omgång: startnummer per avdelning. Skapar eller uppdaterar ett olåst utkast. Låser aldrig systemet och lämnar aldrig in spelet – det görs manuellt hos ATG.",
  inputSchema: {
    round_id: z.string().describe("Omgångens id (från list_rounds)."),
    legs: z
      .array(
        z.object({
          leg_number: z.number().int().describe("Avdelning 1-8."),
          start_numbers: z.array(z.number().int()).describe("Startnummer som ska spelas."),
        }),
      )
      .describe("Ett objekt per avdelning."),
    motivation: z.string().optional().describe("Kort motivering som sparas som anteckning."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ round_id, legs, motivation }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const fail = (text: string) => ({
      content: [{ type: "text" as const, text }],
      isError: true as const,
    });

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("id, budget, row_price")
      .eq("id", round_id)
      .maybeSingle();
    if (roundError) return fail(roundError.message);
    if (!round) return fail("Omgången hittades inte.");

    const { data: races, error: racesError } = await supabase
      .from("races")
      .select("id, leg_number, race_entries(id, start_number, scratched)")
      .eq("round_id", round_id)
      .order("leg_number");
    if (racesError) return fail(racesError.message);
    if (!races?.length) return fail("Omgången saknar avdelningar.");

    const { data: systems, error: sysError } = await supabase
      .from("systems")
      .select("id, name, system_versions(id, version_number, locked_at, budget, row_price)")
      .eq("round_id", round_id);
    if (sysError) return fail(sysError.message);

    let systemId = systems?.[0]?.id as string | undefined;
    if (!systemId) {
      const { data: created, error: createError } = await supabase
        .from("systems")
        .insert({ round_id, name: "Huvudsystem", created_by: ctx.getUserId() })
        .select("id")
        .single();
      if (createError) return fail(createError.message);
      systemId = created.id;
    }

    const existingVersions = [...((systems?.[0] as any)?.system_versions ?? [])].sort(
      (a: any, b: any) => b.version_number - a.version_number,
    );
    let version = existingVersions[0];
    if (version?.locked_at) {
      return fail(
        "Nuvarande systemversion är låst. Skapa en ny version i appen innan ett nytt förslag skrivs in.",
      );
    }
    if (!version) {
      const { data: createdVersion, error: versionError } = await supabase
        .from("system_versions")
        .insert({
          system_id: systemId,
          version_number: 1,
          budget: round.budget,
          row_price: round.row_price,
        })
        .select("id, budget, row_price")
        .single();
      if (versionError) return fail(versionError.message);
      version = createdVersion;
    }

    const selections: { system_version_id: string; race_id: string; race_entry_id: string }[] = [];
    const unmatched: string[] = [];
    for (const race of races as any[]) {
      const wanted = legs.find((l) => l.leg_number === race.leg_number);
      if (!wanted) continue;
      for (const startNumber of wanted.start_numbers) {
        const entry = (race.race_entries ?? []).find(
          (e: any) => e.start_number === startNumber && !e.scratched,
        );
        if (!entry) {
          unmatched.push(`Avd ${race.leg_number} nr ${startNumber}`);
          continue;
        }
        selections.push({
          system_version_id: version.id,
          race_id: race.id,
          race_entry_id: entry.id,
        });
      }
    }
    if (unmatched.length) {
      return fail(`Dessa startnummer finns inte eller är strukna: ${unmatched.join(", ")}.`);
    }

    const perLeg = (races as any[]).map(
      (race) => selections.filter((s) => s.race_id === race.id).length,
    );
    const rows = perLeg.every((n) => n > 0) ? perLeg.reduce((a, b) => a * b, 1) : 0;
    const cost = rows * Number(version.row_price ?? round.row_price ?? 0);

    const { error: deleteError } = await supabase
      .from("system_selections")
      .delete()
      .eq("system_version_id", version.id);
    if (deleteError) return fail(deleteError.message);

    if (selections.length) {
      const { error: insertError } = await supabase.from("system_selections").insert(selections);
      if (insertError) return fail(insertError.message);
    }

    const { error: updateError } = await supabase
      .from("system_versions")
      .update({
        calculated_rows: rows,
        calculated_cost: cost,
        ...(motivation ? { change_reason: motivation } : {}),
      })
      .eq("id", version.id);
    if (updateError) return fail(updateError.message);

    const payload = {
      saved: true,
      locked: false,
      rows,
      cost,
      budget: Number(version.budget ?? round.budget ?? 0),
      over_budget: cost > Number(version.budget ?? round.budget ?? 0),
      note: "Förslaget är sparat som utkast i appen. Spelansvarig granskar, låser och lämnar in hos ATG.",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
