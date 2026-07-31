/**
 * Gemensam regel för vilken omgång som är "veckans spel".
 * Ren funktion utan databas – används av servern och av testerna.
 *
 * Regel:
 *  1. Bara riktiga omgångar (inte demo) som inte är avslutade.
 *  2. Först den närmast kommande omgången vars spelstopp ännu inte passerat
 *     och som har underlag (startfält inläst).
 *  3. Annars den senast spelade omgången som fortfarande är öppen och har underlag.
 *  4. Annars ingen omgång alls – en tom, preliminär framtida omgång får aldrig ta över.
 */

export type RoundCandidate = {
  id: string;
  race_date: string;
  bet_stop_at?: string | null;
  status?: string | null;
  is_demo?: boolean | null;
  race_count?: number | null;
  track_name?: string | null;
};

export function roundDeadline(r: RoundCandidate): number {
  if (r.bet_stop_at) {
    const t = new Date(r.bet_stop_at).getTime();
    if (Number.isFinite(t)) return t;
  }
  const t = new Date(`${r.race_date}T23:59:59`).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function pickCurrentRound<T extends RoundCandidate>(
  rounds: T[],
  now: Date = new Date(),
): T | null {
  const ts = now.getTime();
  const open = (rounds ?? []).filter(
    (r) => !r.is_demo && (r.status ?? "") !== "completed" && (r.race_count ?? 0) > 0,
  );
  if (open.length === 0) return null;

  const upcoming = open
    .filter((r) => roundDeadline(r) >= ts)
    .sort((a, b) => roundDeadline(a) - roundDeadline(b));
  if (upcoming.length > 0) return upcoming[0];

  return [...open].sort((a, b) => roundDeadline(b) - roundDeadline(a))[0];
}
