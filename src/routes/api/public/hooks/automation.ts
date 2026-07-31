import { createFileRoute } from "@tanstack/react-router";

/**
 * Schemalagd ingång för den automatiska torsdagsimporten.
 *
 * Databasens schemaläggare anropar den här adressen varje halvtimme.
 * Motorn kontrollerar själv svensk lokal tid och gör ingenting utanför
 * de planerade tidsfönstren, så ett extra anrop kan aldrig skada något.
 */
export const Route = createFileRoute("/api/public/hooks/automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");

        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const body = await request.json().catch(() => ({}) as any);
          const engine = await import("@/lib/automation-engine.server");
          // force=true används bara vid felsökning och kringgår tidsfönstret.
          const result = body?.force
            ? await engine.runScheduledAutomation(new Date(), true)
            : await engine.runScheduledAutomation();
          return Response.json({ success: true, ...result });
        } catch (error: any) {
          console.error("Automatisk torsdagsimport misslyckades:", error);
          return new Response(
            JSON.stringify({ success: false, error: error?.message ?? String(error) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
