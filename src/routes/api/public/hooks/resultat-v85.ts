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
          return Response.json({ success: true, results });
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
