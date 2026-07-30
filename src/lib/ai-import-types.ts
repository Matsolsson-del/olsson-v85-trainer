/** Klientsäkra typer för AI-importen. */

export type AiImportHorse = {
  start_number: number;
  name: string;
  driver?: string | null;
  ai_win_probability?: number | null;
  market_percent?: number | null;
  value_assessment?: string | null;
  driver_assessment?: string | null;
  risks?: string | null;
};

export type AiImportLeg = {
  leg_number: number;
  analysis?: string | null;
  horses: AiImportHorse[];
  spike_suggestion?: number | null;
  longshots: number[];
  overbet_favourites: number[];
  uncertainties?: string | null;
};

export type AiImportSystem = {
  profile: "tryggt" | "balanserat" | "offensivt";
  rows: number;
  cost: number;
  risk_level: string;
  rationale: string;
  weakest_assumption?: string | null;
  selections: { leg_number: number; start_numbers: number[] }[];
};

export type AiImportPayload = {
  idempotency_key?: string;
  round: {
    external_id: string;
    track: string;
    race_date: string;
    bet_stop_at?: string | null;
  };
  analysis: {
    analyzed_at: string;
    analysis_version: string;
    model_name: string;
    sources: string[];
    data_quality: { score: number; notes?: string | null; missing: string[] };
  };
  legs: AiImportLeg[];
  systems: AiImportSystem[];
  main_recommendation: "tryggt" | "balanserat" | "offensivt";
};

export const SYSTEM_LABELS: Record<string, string> = {
  tryggt: "Tryggt",
  balanserat: "Balanserat",
  offensivt: "Offensivt",
};
