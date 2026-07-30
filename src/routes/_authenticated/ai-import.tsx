import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/labels";
import { useActiveGroupId, useIsOwner } from "@/lib/travhub-queries";
import { exampleAiImportPayload } from "@/lib/ai-import-example";
import {
  getAiImportStatus,
  rotateAiImportKey,
  setAiImportEnabled,
} from "@/lib/ai-import.functions";

export const Route = createFileRoute("/_authenticated/ai-import")({
  head: () => ({
    meta: [
      { title: "AI-import – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Ta emot färdiga V85-analyser från en extern AI-klient med en säker nyckel och versionshantering.",
      },
      { property: "og:title", content: "AI-import – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Endpoint, API-nyckel, senaste importförsök och exempelfil för AI-importen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiImportPage,
});

function AiImportPage() {
  const { groupId } = useActiveGroupId();
  const isOwner = useIsOwner(groupId);
  const fetchStatus = useServerFn(getAiImportStatus);
  const rotate = useServerFn(rotateAiImportKey);
  const toggle = useServerFn(setAiImportEnabled);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/public/ai-import`);
  }, []);

  const status = useQuery({
    queryKey: ["ai-import-status", groupId],
    enabled: Boolean(groupId) && isOwner,
    queryFn: () => fetchStatus({ data: { groupId: groupId! } }) as Promise<any>,
  });

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopierad.`);
    } catch {
      toast.error("Kunde inte kopiera. Markera texten och kopiera manuellt.");
    }
  }

  function downloadExample() {
    const blob = new Blob([JSON.stringify(exampleAiImportPayload(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "travhubben-ai-import-exempel.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRotate() {
    if (!groupId) return;
    setBusy(true);
    try {
      const res: any = await rotate({ data: { groupId } });
      setNewKey(res.apiKey);
      toast.success("Ny nyckel skapad. Kopiera den nu – den visas bara en gång.");
      status.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte skapa nyckeln.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(enabled: boolean) {
    if (!groupId) return;
    try {
      await toggle({ data: { groupId, enabled } });
      toast.success(enabled ? "AI-importen är påslagen." : "AI-importen är avstängd.");
      status.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte ändra inställningen.");
    }
  }

  if (!isOwner) {
    return (
      <>
        <PageHeader title="AI-import" description="Endast Mats sköter AI-importen." />
        <Card>
          <CardContent className="p-6 text-base text-muted-foreground">
            Den här sidan sköts av gruppens ägare.
          </CardContent>
        </Card>
      </>
    );
  }

  const settings = status.data?.settings;
  const attempts: any[] = status.data?.attempts ?? [];

  return (
    <>
      <PageHeader
        title="AI-import"
        description="Låt din AI skicka in veckans färdiga V85-underlag automatiskt."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2 border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Rekommenderat: koppla ChatGPT direkt (ingen API-nyckel)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Lägg till Travhubben som kopplad app i ChatGPT. Du loggar in med ditt eget konto en
              gång och godkänner åtkomsten – ingen hemlig nyckel behöver klistras in någonstans.
            </p>
            <code className="block break-all rounded-md bg-muted p-3 text-xs">
              {mcpUrl || "…"}
            </code>
            <Button
              className="h-12"
              variant="secondary"
              disabled={!mcpUrl}
              onClick={() => copy(mcpUrl, "Anslutningsadressen")}
            >
              Kopiera anslutningsadress
            </Button>
            <p className="text-muted-foreground">
              Be sedan ChatGPT: “Hämta importformatet och skicka in veckans analys till
              Travhubben.” Analysen sparas alltid som AI-utkast – veckans ansvarige bestämmer.
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Adress att skicka till</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <code className="block break-all rounded-md bg-muted p-3 text-xs">
              {endpoint || "…"}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-12"
                variant="secondary"
                disabled={!endpoint}
                onClick={() => copy(endpoint, "Adressen")}
              >
                Kopiera adress
              </Button>
              <Button className="h-12" variant="outline" onClick={downloadExample}>
                Ladda ner exempel-JSON
              </Button>
            </div>
            <p className="text-muted-foreground">
              Skicka POST med huvudena <code>x-api-key</code> och <code>Idempotency-Key</code>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">API-nyckel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {status.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span>AI-importen är {settings?.enabled ? "påslagen" : "avstängd"}</span>
                  <Switch
                    checked={Boolean(settings?.enabled)}
                    onCheckedChange={handleToggle}
                    aria-label="Slå på eller stäng av AI-importen"
                  />
                </div>
                <p className="text-muted-foreground">
                  {settings?.key_prefix
                    ? `Nuvarande nyckel: ${settings.key_prefix}… (skapad ${formatDateTime(settings.key_created_at)})`
                    : "Ingen nyckel är skapad ännu."}
                </p>
                {newKey && (
                  <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
                    <p className="font-medium">Kopiera nyckeln nu – den visas bara en gång.</p>
                    <code className="block break-all text-xs">{newKey}</code>
                    <Button className="h-12" onClick={() => copy(newKey, "Nyckeln")}>
                      Kopiera nyckel
                    </Button>
                  </div>
                )}
                <Button className="h-12" disabled={busy} onClick={handleRotate}>
                  {busy
                    ? "Skapar …"
                    : settings?.key_prefix
                      ? "Byt API-nyckel"
                      : "Skapa API-nyckel"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Nyckeln sparas bara som en kryptografisk avtryck i backend och finns aldrig i
                  appens kod.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Senaste importförsök</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {status.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : status.isError ? (
              <p className="text-destructive">Kunde inte hämta importförsöken.</p>
            ) : attempts.length === 0 ? (
              <p className="text-muted-foreground">Inga försök har gjorts ännu.</p>
            ) : (
              attempts.map((a) => (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={a.ok ? "secondary" : "destructive"}>
                      {a.ok ? "Lyckades" : `Fel ${a.status_code}`}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)}
                    </span>
                  </div>
                  <p className="mt-1">{a.message}</p>
                  {Array.isArray(a.validation_errors) && a.validation_errors.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-destructive">
                      {a.validation_errors.slice(0, 8).map((e: any, i: number) => (
                        <li key={i}>
                          {e.path}: {e.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Så kopplar du in din AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Skapa en API-nyckel här ovan och kopiera den direkt.</li>
              <li>
                Klistra in nyckeln i AI-klientens inställningar för hemliga värden (till exempel
                "Authentication – API key" i en GPT-action). Skriv den aldrig i ett vanligt
                chattmeddelande och aldrig i appens kod.
              </li>
              <li>
                Låt klienten skicka <code>POST</code> till adressen ovan med huvudena{" "}
                <code>x-api-key: DIN_NYCKEL</code>, <code>content-type: application/json</code> och{" "}
                <code>Idempotency-Key</code> (till exempel <code>v85-ÅÅÅÅ-MM-DD-v1</code>).
              </li>
              <li>Använd exempel-JSON som mall. Alla fält i exemplet krävs.</li>
              <li>
                Omgången måste finnas i Travhubben först. Skicka omgångens id, eller bana och datum
                – importen skapar aldrig nya omgångar.
              </li>
              <li>
                Testa mot en demoomgång i Inställningar. Demoomgångar påverkar aldrig riktig
                statistik.
              </li>
            </ol>
            <p className="text-muted-foreground">
              Importen sparas alltid som <strong>AI-utkast</strong>. Den kan aldrig markera spelet
              som inlämnat, bokföra pengar, ändra resultat, radera något eller byta veckans
              ansvarige. Bara veckans ansvarige väljer och färdigställer systemet.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
