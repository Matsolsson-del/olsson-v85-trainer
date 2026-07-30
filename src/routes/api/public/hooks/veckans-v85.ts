import { createFileRoute } from "@tanstack/react-router";

/**
 * Veckoschemalagd import av nästa V85-omgång från ATG.
 * Anropas av databasens schemaläggare varje torsdag.
 */
export const Route = createFileRoute("/api/public/hooks/veckans-v85")({
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
          const { importForAllGroups } = await import("@/lib/atg-import.server");
          const results = await importForAllGroups();
          return Response.json({ success: true, results });
        } catch (error: any) {
          console.error("Veckoimport från ATG misslyckades:", error);
          return new Response(
            JSON.stringify({ success: false, error: error?.message ?? String(error) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
