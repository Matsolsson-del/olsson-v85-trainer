import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-api-key, idempotency-key",
  "access-control-allow-methods": "POST, OPTIONS",
};

/**
 * Tar emot en färdig V85-analys från en extern AI-klient.
 * Autentisering sker med en serverlagrad API-nyckel (huvudet x-api-key).
 * Importen sparas alltid som ett nytt, versionshanterat AI-utkast.
 */
export const Route = createFileRoute("/api/public/ai-import")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("x-api-key") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          null;
        const idempotencyKey = request.headers.get("idempotency-key");

        const { authenticateImport, processAiImport, logUnauthorized } = await import(
          "@/lib/ai-import.server"
        );

        const auth = await authenticateImport(apiKey);
        if (!auth.ok) {
          await logUnauthorized(auth.status, auth.message, idempotencyKey);
          return new Response(
            JSON.stringify({ error: "unauthorized", message: auth.message }),
            { status: auth.status, headers: CORS },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({
              error: "invalid_json",
              message: "Kroppen måste vara giltig JSON.",
            }),
            { status: 400, headers: CORS },
          );
        }

        try {
          const result = await processAiImport(auth.groupId, body, idempotencyKey);
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: CORS,
          });
        } catch (error: any) {
          console.error("AI-import misslyckades:", error);
          return new Response(
            JSON.stringify({
              error: "server_error",
              message: "Något gick fel i Travhubben. Försök igen.",
            }),
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
