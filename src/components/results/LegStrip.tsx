import { useState } from "react";
import { Check, Star, X } from "lucide-react";
import type { RoundLeg } from "@/lib/round-legs";

/**
 * Avdelning 1–8 som en tydlig rad. Träff och miss visas både med färg,
 * ikon och text så att inget signaleras enbart med färg.
 */
export function LegStrip({ legs }: { legs: RoundLeg[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (legs.length === 0) return null;

  const active = legs.find((l) => l.leg === open) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {legs.map((l) => {
          const state = l.hit === null ? "unknown" : l.hit ? "hit" : "miss";
          const tone =
            state === "hit"
              ? "border-success/40 bg-success/10 text-success"
              : state === "miss"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-muted text-muted-foreground";
          return (
            <button
              key={l.leg}
              type="button"
              onClick={() => setOpen(open === l.leg ? null : l.leg)}
              aria-expanded={open === l.leg}
              aria-label={`Avdelning ${l.leg}: ${
                state === "hit" ? "träff" : state === "miss" ? "miss" : "ej avgjord"
              }${l.spike ? ", spik" : ""}`}
              className={
                "flex min-w-16 flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 text-sm font-semibold transition " +
                tone +
                (open === l.leg ? " ring-2 ring-ring" : "")
              }
            >
              <span className="flex items-center gap-1">
                Avd {l.leg}
                {l.spike && <Star aria-hidden className="size-3.5 fill-current" />}
              </span>
              <span className="flex items-center gap-1">
                {state === "hit" ? (
                  <Check aria-hidden className="size-4" />
                ) : state === "miss" ? (
                  <X aria-hidden className="size-4" />
                ) : null}
                <span>{state === "hit" ? "Rätt" : state === "miss" ? "Fel" : "–"}</span>
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-base">
          <p className="font-semibold">
            Avdelning {active.leg}
            {active.spike ? " · spik" : ""}
          </p>
          <p>Vann: {active.winnerLabel ?? "–"}</p>
          <p>Vi hade: {active.picks.length ? active.picks.join(", ") : "–"}</p>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Tryck på en avdelning för att se vinnaren och våra hästar. Stjärna betyder spik.
      </p>
    </div>
  );
}
