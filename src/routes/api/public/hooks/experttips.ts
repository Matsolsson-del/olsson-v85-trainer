import { createFileRoute } from "@tanstack/react-router";

/**
 * Veckoschemalagd insamling av experttips från travsajter och bloggar (torsdag).
 */
export const Route = createFileRoute("/api/public/hooks/experttips")({
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
          const { collectExpertTipsForAllGroups } = await import("@/lib/expert-tips.server");
          const results = await collectExpertTipsForAllGroups();
          return Response.json({ success: true, results });
        } catch (error: any) {
          console.error("Insamling av experttips misslyckades:", error);
          return new Response(
            JSON.stringify({ success: false, error: error?.message ?? String(error) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
