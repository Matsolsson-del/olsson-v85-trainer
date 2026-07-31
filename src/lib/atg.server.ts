/**
 * Läser ATG:s öppna racing-API för V85.
 * Endast serverkod – anropas aldrig från webbläsaren.
 */

const ATG_BASE = "https://www.atg.se/services/racinginfo/v1/api";

export type AtgUpcomingGame = {
  id: string;
  startTime: string;
  tracks: { id: number; name: string }[];
};

export type AtgShoeSide = { hasShoe?: boolean; changed?: boolean };

export type AtgStart = {
  id?: string;
  number: number;
  postPosition?: number;
  distance?: number;
  scratched?: boolean;
  horse: {
    id: number;
    name: string;
    age?: number;
    sex?: string;
    money?: number;
    record?: { code?: string; time?: { minutes?: number; seconds?: number; tenths?: number } };
    shoes?: { reported?: boolean; front?: AtgShoeSide; back?: AtgShoeSide };
    sulky?: {
      reported?: boolean;
      type?: { code?: string; text?: string; changed?: boolean };
      colour?: { text?: string };
    };
    statistics?: { life?: { starts?: number; earnings?: number; winPercentage?: number } };
    trainer?: { id: number; firstName?: string; lastName?: string };
  };
  driver?: { id: number; firstName?: string; lastName?: string };
  pools?: {
    V85?: { betDistribution?: number };
    vinnare?: { odds?: number };
  };
};

export type AtgRace = {
  id: string;
  number: number;
  name?: string;
  distance?: number;
  startMethod?: string;
  startTime?: string;
  scheduledStartTime?: string;
  status?: string;
  terms?: string[];
  track?: { id: number; name: string };
  starts: AtgStart[];
};


export type AtgGame = {
  id: string;
  status?: string;
  races: AtgRace[];
};

async function atgGet<T>(path: string): Promise<T> {
  const res = await fetch(`${ATG_BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`ATG svarade ${res.status} på ${path}`);
  }
  return (await res.json()) as T;
}

/** Nästa kommande V85-omgång (närmast i tiden). */
export async function fetchNextV85(): Promise<AtgUpcomingGame | null> {
  const data = await atgGet<{ upcoming?: AtgUpcomingGame[] }>("/products/V85");
  const upcoming = (data.upcoming ?? [])
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return upcoming[0] ?? null;
}

/** Fullständig startlista för en V85-omgång. */
export function fetchV85Game(gameId: string): Promise<AtgGame> {
  return atgGet<AtgGame>(`/games/${gameId}`);
}

export function fullName(p?: { firstName?: string; lastName?: string }): string | null {
  if (!p) return null;
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** ATG anger volt som "volte"; vår databas använder "volt". */
export function mapStartMethod(method?: string): "auto" | "volt" {
  return method === "volte" || method === "volt" ? "volt" : "auto";
}

/** ATG anger andelar i hundradels promille (5759 = 5,759 %). */
export function betDistributionToPercent(value?: number): number | null {
  if (typeof value !== "number") return null;
  return Math.round((value / 1000) * 100) / 100;
}

/** Hämtar en specifik V85-omgång utifrån ATG:s produktlista. */
export async function fetchV85Upcoming(): Promise<AtgUpcomingGame[]> {
  const data = await atgGet<{ upcoming?: AtgUpcomingGame[] }>("/products/V85");
  return (data.upcoming ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Balansuppgift i klartext, t.ex. "barfota fram". null när uppgiften saknas. */
export function shoeText(shoes?: AtgStart["horse"]["shoes"]): string | null {
  if (!shoes?.reported) return null;
  const front = shoes.front?.hasShoe;
  const back = shoes.back?.hasShoe;
  if (front === undefined && back === undefined) return null;
  if (front === false && back === false) return "barfota runt om";
  if (front === false) return "barfota fram";
  if (back === false) return "barfota bak";
  return "skor runt om";
}

/** Vagnuppgift i klartext. null när uppgiften saknas. */
export function sulkyText(sulky?: AtgStart["horse"]["sulky"]): string | null {
  if (!sulky?.reported) return null;
  const type = sulky.type?.text;
  return type ? type : null;
}

/** Rekordtid som text, t.ex. "1.13,5M". null när uppgiften saknas. */
export function recordText(record?: AtgStart["horse"]["record"]): string | null {
  const t = record?.time;
  if (!t || t.minutes === undefined || t.seconds === undefined) return null;
  const secs = String(t.seconds).padStart(2, "0");
  return `${t.minutes}.${secs},${t.tenths ?? 0}${record?.code ?? ""}`;
}

/** Vinnarodds i kronor (ATG anger hundradelar). null när odds saknas. */
export function winOdds(start: AtgStart): number | null {
  const odds = start.pools?.vinnare?.odds;
  return typeof odds === "number" ? Math.round(odds) / 10 : null;
}
