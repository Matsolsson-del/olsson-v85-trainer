import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/labels";
import { SYSTEM_LABELS } from "@/lib/ai-import-types";

/** Visar senaste importerade AI-analysen med möjlighet att öppna äldre versioner. */
export function AiImportCard({ roundId }: { roundId: string }) {
  const [showAll, setShowAll] = useState(false);
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  const versions = useQuery({
    queryKey: ["ai-import-versions", roundId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_import_versions")
        .select(
          "id, version, status, model_name, analysis_version, analyzed_at, created_at, sources, data_quality, systems, main_recommendation",
        )
        .eq("round_id", roundId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (versions.isLoading) return <Skeleton className="h-24 w-full" />;
  if (versions.isError)
    return <p className="text-destructive">Kunde inte hämta AI-importerna.</p>;

  const list: any[] = versions.data ?? [];
  if (list.length === 0) {
    return (
      <p className="text-muted-foreground">
        Ingen färdig analys har skickats in från AI:n ännu.
      </p>
    );
  }

  const shown = list.filter((v) => (showAll ? true : v.id === list[0].id));

  return (
    <div className="space-y-3">
      {shown.map((v) => {
        const expanded = openVersion === v.id || v.id === list[0].id;
        const quality = v.data_quality ?? {};
        return (
          <div key={v.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">AI-utkast</Badge>
              <span className="font-medium">Version {v.version}</span>
              {v.id === list[0].id && <Badge variant="outline">Senaste</Badge>}
              <span className="text-xs text-muted-foreground">
                {formatDateTime(v.analyzed_at ?? v.created_at)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {v.model_name} · analysversion {v.analysis_version} · datakvalitet{" "}
              {quality.score ?? "–"} av 100
            </p>
            {expanded && (
              <>
                {Array.isArray(v.sources) && v.sources.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Källor: {v.sources.join(", ")}
                  </p>
                )}
                <ul className="mt-2 space-y-1 text-sm">
                  {(v.systems ?? []).map((s: any) => (
                    <li key={s.profile}>
                      <span className="font-medium">
                        {SYSTEM_LABELS[s.profile] ?? s.profile}
                        {s.profile === v.main_recommendation ? " (AI:ns förslag)" : ""}:
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {s.rows} rader, {formatCurrency(Number(s.cost))}, risk {s.risk_level} –{" "}
                        {s.rationale}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!expanded && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 px-0"
                onClick={() => setOpenVersion(v.id)}
              >
                Visa innehållet
              </Button>
            )}
          </div>
        );
      })}
      {list.length > 1 && (
        <Button variant="outline" className="h-12" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Visa bara senaste" : `Visa äldre versioner (${list.length - 1})`}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        AI-importen är alltid ett utkast. Veckans ansvarige väljer och färdigställer systemet.
      </p>
    </div>
  );
}
