/** Exempel på korrekt JSON för AI-importen. Klientsäker. */
import type { AiImportPayload } from "@/lib/ai-import-types";

export function exampleAiImportPayload(): AiImportPayload {
  return {
    idempotency_key: "v85-2026-08-08-solvalla-v1",
    round: {
      external_id: "atg-v85-2026-08-08-solvalla",
      track: "Solvalla",
      race_date: "2026-08-08",
      bet_stop_at: "2026-08-08T16:20:00+02:00",
    },
    analysis: {
      analyzed_at: "2026-08-07T20:00:00+02:00",
      analysis_version: "1.0",
      model_name: "gpt-5",
      sources: ["atg.se startlistor", "atg.se streckprocent", "travsport.se resultat"],
      data_quality: { score: 92, notes: "Alla startlistor kompletta.", missing: [] },
    },
    legs: [
      {
        leg_number: 1,
        analysis: "Öppet lopp där ledarhästen får rygg av 4.",
        horses: [
          {
            start_number: 1,
            name: "Global Exempel",
            driver: "Erik Adielsson",
            ai_win_probability: 34,
            market_percent: 28,
            value_assessment: "Underspelad utifrån formen.",
            driver_assessment: "Rutinerad kusk som kan hästen sedan tidigare.",
            risks: "Kan bli instängd i tredje spår.",
          },
        ],
        spike_suggestion: 1,
        longshots: [9],
        overbet_favourites: [5],
        uncertainties: "Osäkert underlag om skoning.",
      },
    ],
    systems: [
      {
        profile: "tryggt",
        rows: 288,
        cost: 288,
        risk_level: "Låg",
        rationale: "Två spikar med hög sannolikhet.",
        weakest_assumption: "Att spiken i avdelning 1 får rätt resa.",
        selections: [{ leg_number: 1, start_numbers: [1] }],
      },
      {
        profile: "balanserat",
        rows: 720,
        cost: 720,
        risk_level: "Medel",
        rationale: "En spik och breda garderingar i de öppna loppen.",
        weakest_assumption: "Att favoriten i avdelning 4 håller.",
        selections: [{ leg_number: 1, start_numbers: [1, 4] }],
      },
      {
        profile: "offensivt",
        rows: 1440,
        cost: 1440,
        risk_level: "Hög",
        rationale: "Bredare i loppen där marknaden verkar fel.",
        weakest_assumption: "Att skrällen i avdelning 6 verkligen kommer.",
        selections: [{ leg_number: 1, start_numbers: [1, 4, 9] }],
      },
    ],
    main_recommendation: "balanserat",
  };
}

