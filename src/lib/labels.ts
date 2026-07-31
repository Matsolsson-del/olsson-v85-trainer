export const ROUND_STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  individual_analysis: "Individuell analys",
  analyses_revealed: "Analyser öppnade",
  group_assessment: "Gruppbedömning",
  system_building: "Systembygge",
  system_locked: "System låst",
  results_registered: "Resultat registrerade",
  postmortem: "Efterrapport",
  completed: "Avslutad",
};

export const ERROR_CATEGORY_LABELS: Record<string, string> = {
  capacity_error: "Kapacitetsfel",
  form_error: "Formfel",
  position_or_pace_error: "Positions- eller tempofel",
  distance_or_start_method_error: "Distans- eller startsättsfel",
  driver_underestimated: "Kusk underskattad",
  driver_overestimated: "Kusk överskattad",
  driver_horse_combo_underestimated: "Kusk–häst-kombination underskattad",
  current_information_missed: "Missad aktuell information",
  system_construction_error: "Systemkonstruktionsfel",
  excessive_value_hunting: "Överdriven värdejakt",
  excessive_favorite_protection: "Överdrivet favoritskydd",
  unpredictable_event: "Oförutsägbar händelse",
};

export const DRIVER_EXECUTION_LABELS: Record<string, string> = {
  better: "Bättre än väntat",
  as_expected: "Som väntat",
  worse: "Sämre än väntat",
  not_assessed: "Ej bedömt",
};

export const TRANSACTION_LABELS: Record<string, string> = {
  contribution: "Insättning",
  stake: "Insats",
  winnings: "Vinst",
  withdrawal: "Uttag",
  correction: "Korrigering",
};

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "–";
  return `${formatNumber(value, decimals)} %`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  // Rena datum (YYYY-MM-DD) ska inte tidszonsjusteras.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeZone: "UTC" }).format(d);
  }
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeZone: "Europe/Stockholm",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  }).format(d);
}
