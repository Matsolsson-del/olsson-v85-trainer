import { statsRows, unresolvedDuplicateGroups } from "@/lib/history-review";

/**
 * Räknar ut statistik från importerad spelhistorik.
 * Ren beräkning utan databas – används både på servern och i tester.
 */

export type HistoryLeg = {
  leg: number;
  selected?: number[] | null;
  winner?: number | null;
  spike?: boolean | null;
};

export type HistoryRow = {
  id: string;
  race_date: string;
  track_name?: string | null;
  correct_count?: number | null;
  payout?: number | string | null;
  net_result?: number | string | null;
  computed_cost?: number | string | null;
  stated_cost?: number | string | null;
  computed_rows?: number | null;
  stated_rows?: number | null;
  winners_verified?: boolean | null;
  usable_for_learning?: boolean | null;
  review_status?: string | null;
  legs?: HistoryLeg[] | null;
};

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export type HistoryStats = ReturnType<typeof computeHistoryStats>;

export function computeHistoryStats(rowsInput: HistoryRow[]) {
  const all = [...(rowsInput ?? [])];
  // Dubbletter stoppar inte längre statistiken. Så länge en tävlingsdag har två
  // ogranskade poster räknar vi preliminärt med en av dem (den mest kompletta)
  // och visar en tydlig notis om att Mats behöver granska dagarna.
  const unresolved = unresolvedDuplicateGroups(all);
  const preliminary = unresolved.length > 0;
  const score = (r: HistoryRow) =>
    (r.winners_verified ? 4 : 0) +
    (r.usable_for_learning !== false ? 2 : 0) +
    (r.correct_count != null ? 1 : 0);
  const pickedFromDuplicates = unresolved.map(
    (g) => [...g.rows].sort((a, b) => score(b) - score(a))[0] as HistoryRow,
  );
  const unresolvedIds = new Set(unresolved.flatMap((g) => g.rows.map((r) => r.id)));
  const rows = [...statsRows(all).filter((r) => !unresolvedIds.has(r.id)), ...pickedFromDuplicates]
    .filter((r) => r.usable_for_learning !== false)
    .sort((a, b) => String(a.race_date).localeCompare(String(b.race_date)));


  let totalCost = 0;
  let totalPayout = 0;
  let correctSum = 0;
  let correctRounds = 0;
  let bestCorrect = 0;
  let roundsWithPayout = 0;
  let rowsSum = 0;
  let rowsCount = 0;

  let spikeTotal = 0;
  let spikeHits = 0;
  let spikeMissRounds = 0;
  let spikeMissCost = 0;
  let allSpikesRightRounds = 0;
  let allSpikesRightCorrect = 0;
  let spikeMissCorrect = 0;

  const legMap = new Map<
    number,
    { leg: number; rounds: number; hits: number; horses: number; horsesOnMiss: number; misses: number }
  >();
  const bucketMap = new Map<number, { horses: number; legs: number; hits: number }>();

  const trend: {
    date: string;
    track: string;
    correct: number | null;
    cost: number;
    payout: number;
    net: number;
    cumulativeNet: number;
  }[] = [];

  let cumulative = 0;

  for (const r of rows) {
    const cost = num(r.computed_cost ?? r.stated_cost);
    const payout = num(r.payout);
    const net = r.net_result != null ? num(r.net_result) : payout - cost;
    cumulative += net;
    totalCost += cost;
    totalPayout += payout;
    if (payout > 0) roundsWithPayout += 1;
    if (r.correct_count != null) {
      correctSum += num(r.correct_count);
      correctRounds += 1;
      bestCorrect = Math.max(bestCorrect, num(r.correct_count));
    }
    const nRows = r.computed_rows ?? r.stated_rows;
    if (nRows != null) {
      rowsSum += num(nRows);
      rowsCount += 1;
    }

    trend.push({
      date: String(r.race_date),
      track: r.track_name ?? "Okänd bana",
      correct: r.correct_count ?? null,
      cost,
      payout,
      net,
      cumulativeNet: cumulative,
    });

    let roundSpikeMiss = false;
    for (const leg of r.legs ?? []) {
      const selected = (leg.selected ?? []).filter((n) => n != null);
      const winner = leg.winner;
      const hit = winner != null && selected.includes(Number(winner));
      const isSpike = leg.spike === true || selected.length === 1;

      if (winner != null) {
        const entry = legMap.get(leg.leg) ?? {
          leg: leg.leg,
          rounds: 0,
          hits: 0,
          horses: 0,
          horsesOnMiss: 0,
          misses: 0,
        };
        entry.rounds += 1;
        entry.horses += selected.length;
        if (hit) entry.hits += 1;
        else {
          entry.misses += 1;
          entry.horsesOnMiss += selected.length;
        }
        legMap.set(leg.leg, entry);

        const bucketKey = Math.min(selected.length, 5);
        const b = bucketMap.get(bucketKey) ?? { horses: bucketKey, legs: 0, hits: 0 };
        b.legs += 1;
        if (hit) b.hits += 1;
        bucketMap.set(bucketKey, b);

        if (isSpike) {
          spikeTotal += 1;
          if (hit) spikeHits += 1;
          else roundSpikeMiss = true;
        }
      }
    }

    if ((r.legs ?? []).length > 0 && r.correct_count != null) {
      if (roundSpikeMiss) {
        spikeMissRounds += 1;
        spikeMissCost += cost;
        spikeMissCorrect += num(r.correct_count);
      } else {
        allSpikesRightRounds += 1;
        allSpikesRightCorrect += num(r.correct_count);
      }
    }
  }

  const legs = [...legMap.values()]
    .sort((a, b) => a.leg - b.leg)
    .map((l) => ({
      leg: l.leg,
      rounds: l.rounds,
      hits: l.hits,
      hitRate: l.rounds ? round1((l.hits / l.rounds) * 100) : 0,
      avgHorses: l.rounds ? round1(l.horses / l.rounds) : 0,
      avgHorsesOnMiss: l.misses ? round1(l.horsesOnMiss / l.misses) : null,
    }));

  const buckets = [1, 2, 3, 4, 5]
    .map((k) => bucketMap.get(k))
    .filter(Boolean)
    .map((b) => ({
      horses: b!.horses,
      label: b!.horses === 5 ? "5 eller fler" : `${b!.horses} häst${b!.horses === 1 ? "" : "ar"}`,
      legs: b!.legs,
      hits: b!.hits,
      hitRate: b!.legs ? round1((b!.hits / b!.legs) * 100) : 0,
    }));

  const worstLegs = [...legs].sort((a, b) => a.hitRate - b.hitRate).slice(0, 3);
  const avgCorrect = correctRounds ? round1(correctSum / correctRounds) : null;
  const avgCorrectWhenSpikesRight = allSpikesRightRounds
    ? round1(allSpikesRightCorrect / allSpikesRightRounds)
    : null;
  const avgCorrectWhenSpikeMiss = spikeMissRounds ? round1(spikeMissCorrect / spikeMissRounds) : null;
  const avgHorsesPerLeg = legs.length
    ? round1(legs.reduce((a, l) => a + l.avgHorses, 0) / legs.length)
    : null;
  const avgRows = rowsCount ? Math.round(rowsSum / rowsCount) : null;
  const avgCost = rows.length ? Math.round(totalCost / rows.length) : null;

  // Enkla, konkreta råd i vardagsspråk – bara sådant siffrorna faktiskt stödjer.
  const advice: string[] = [];
  if (spikeTotal >= 10) {
    const rate = round1((spikeHits / spikeTotal) * 100);
    if (rate < 65) {
      advice.push(
        `Spikarna vinner bara i ${rate} % av fallen. Ta hellre två hästar i den avdelning där spiken känns minst säker.`,
      );
    } else {
      advice.push(`Spikarna håller bra (${rate} % vinner). Fortsätt spika, men bara en riktigt trygg häst.`);
    }
  }
  if (spikeMissRounds > 0) {
    advice.push(
      `${spikeMissRounds} av ${rows.length} omgångar sprack på en spik. Det motsvarar ${new Intl.NumberFormat("sv-SE").format(Math.round(spikeMissCost))} kr i insats.`,
    );
  }
  if (worstLegs.length) {
    advice.push(
      `Svagast träff: ${worstLegs
        .map((l) => `avdelning ${l.leg} (${l.hitRate} %)`)
        .join(", ")}. Lägg extra hästar där i stället för i avdelningar som redan sitter.`,
    );
  }
  const bucket2 = buckets.find((b) => b.horses === 2);
  const bucket3 = buckets.find((b) => b.horses === 3);
  if (bucket2 && bucket3 && bucket3.legs >= 20 && bucket2.legs >= 20) {
    const diff = round1(bucket3.hitRate - bucket2.hitRate);
    advice.push(
      diff >= 8
        ? `Tre hästar träffar ${diff} procentenheter oftare än två. Prioritera tre hästar i de osäkra avdelningarna.`
        : `Skillnaden mellan två och tre hästar är liten (${diff} procentenheter). Bredda bara där vi är verkligt osäkra.`,
    );
  }
  if (avgRows && avgCost) {
    advice.push(`Snittsystemet har varit ${avgRows} rader för ${avgCost} kr. Håll samma nivå tills träffbilden förbättras.`);
  }

  return {
    blocked,
    unresolvedDuplicates: unresolved.length,
    unresolvedDates: unresolved.map((g) => ({
      track: g.rows[0].track_name ?? "Okänd bana",
      date: String(g.rows[0].race_date),
      count: g.rows.length,
    })),
    hasData: !blocked && rows.length > 0,
    summary: {
      rounds: rows.length,
      totalCost: Math.round(totalCost),
      totalPayout: Math.round(totalPayout),
      net: Math.round(totalPayout - totalCost),
      avgCorrect,
      bestCorrect: correctRounds ? bestCorrect : null,
      roundsWithPayout,
      avgRows,
      avgCost,
      avgHorsesPerLeg,
      firstDate: rows[0]?.race_date ?? null,
      lastDate: rows[rows.length - 1]?.race_date ?? null,
    },
    trend,
    spikes: {
      total: spikeTotal,
      hits: spikeHits,
      hitRate: spikeTotal ? round1((spikeHits / spikeTotal) * 100) : null,
      missRounds: spikeMissRounds,
      missCost: Math.round(spikeMissCost),
      avgCorrectWhenSpikesRight,
      avgCorrectWhenSpikeMiss,
    },
    legs,
    buckets,
    worstLegs,
    advice,
  };
}

/** Kort textsammanfattning som kan skickas med till AI:n. */
export function historyContextText(stats: HistoryStats): string {
  if (!stats.hasData) return "";
  const s = stats.summary;
  return [
    `Historik från ${s.firstDate} till ${s.lastDate}: ${s.rounds} omgångar, snitt ${s.avgCorrect} rätt, netto ${s.net} kr.`,
    `Spikar: ${stats.spikes.hits} av ${stats.spikes.total} vann (${stats.spikes.hitRate} %). ${stats.spikes.missRounds} omgångar sprack på en spik.`,
    `Träff per avdelning: ${stats.legs.map((l) => `V85-${l.leg} ${l.hitRate} %`).join(", ")}.`,
    `Träff efter antal hästar: ${stats.buckets.map((b) => `${b.label} ${b.hitRate} %`).join(", ")}.`,
  ].join("\n");
}
