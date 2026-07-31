import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { getAutomationOverview } from "@/lib/automation-admin.functions";

/**
 * Kort, lugn status till hela familjen: har veckans underlag och experttips
 * hämtats automatiskt? Inga tekniska ord, inga felkoder.
 */
export function AutomationStatusCard() {
  const load = useServerFn(getAutomationOverview);
  const { data } = useQuery({
    queryKey: ["automation-overview", "family"],
    queryFn: () => load({}),
    refetchInterval: 60_000,
  });

  if (!data) return null;

  const facts = data.factsStatus;
  const summary = data.sourceSummary;
  const important = (data.changes ?? []).filter((c: any) => c.important);

  const factsText =
    facts === "ready"
      ? `Tävlingsuppgifterna är hämtade${data.round?.trackName ? ` från ${data.round.trackName}` : ""}.`
      : facts === "fetching"
        ? "Tävlingsuppgifterna hämtas just nu."
        : facts === "waiting"
          ? "Väntar på tävlingsunderlag. Appen försöker igen automatiskt."
          : facts === "partial"
            ? "Delar av tävlingsuppgifterna är hämtade. Appen fyller på automatiskt."
            : "Tävlingsuppgifterna behöver kontrolleras.";

  const tipsText =
    summary.withTips > 0
      ? `${summary.withTips} av ${summary.checked} experttips är inlästa.`
      : "Inga experttips är publicerade ännu. Appen hämtar dem så fort de kommer.";

  return (
    <Card className="mb-5">
      <CardContent className="space-y-1 p-5 text-lg">
        <p className="font-medium">Automatisk hämtning</p>
        <p className="text-muted-foreground">{factsText}</p>
        <p className="text-muted-foreground">{tipsText}</p>
        {important.length > 0 ? (
          <p className="pt-1 font-medium">
            {important.length === 1
              ? "1 viktig ändring sedan förra hämtningen – läs igenom innan spelstopp."
              : `${important.length} viktiga ändringar sedan förra hämtningen – läs igenom innan spelstopp.`}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
