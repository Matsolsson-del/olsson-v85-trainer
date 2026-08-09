import { createFileRoute } from "@tanstack/react-router";

/**
 * Schemalagd hämtning av V85-resultat från ATG (söndag kväll).
 */
export const Route = createFileRoute("/api/public/hooks/resultat-v85")({
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
          const { importResultsForRecentRounds } = await import("@/lib/atg-results.server");
          const results = await importResultsForRecentRounds();
          // Räkna maskinellt ut utfallet direkt efter hämtningen (utkast, inte godkänt).
          const { settleRecentRounds } = await import("@/lib/settlement.server");
          const settlements = await settleRecentRounds().catch((e: any) => ({
            error: e?.message ?? String(e),
          }));
          // Söndag morgon: skapa även AI-utkast till efteranalys av gårdagens spel.
          const { generatePostmortemsForRecentRounds } = await import(
            "@/lib/round-postmortem.server"
          );
          const postmortems = await generatePostmortemsForRecentRounds().catch((e: any) => ({
            error: e?.message ?? String(e),
          }));
          return Response.json({ success: true, results, settlements, postmortems });

        } catch (error: any) {
          console.error("Resultatimport från ATG misslyckades:", error);
          return new Response(
            JSON.stringify({ success: false, error: error?.message ?? String(error) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
