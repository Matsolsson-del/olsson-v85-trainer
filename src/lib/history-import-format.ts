/**
 * Klientsäkert format-exempel + schemabeskrivning för import av historiska V85-spel.
 * Används av MCP-verktyget get_history_import_format.
 */

export function historyImportSchema() {
  return {
    type: "object",
    required: ["rounds"],
    properties: {
      mode: {
        type: "string",
        enum: ["preview", "import"],
        default: "preview",
        description:
          "preview validerar och visar förhandsgranskning utan att spara. import sparar posterna.",
      },
      overwrite_existing: {
        type: "boolean",
        default: false,
        description:
          "Måste vara true för att skriva över en redan importerad historikpost med samma nyckel. Annars hoppas posten över.",
      },
      rounds: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["race_date", "legs", "data_quality"],
          properties: {
            idempotency_key: {
              type: ["string", "null"],
              description:
                "Unik nyckel per omgång. Utelämnas den skapas den av bana + datum, så samma omgång aldrig dubbleras.",
            },
            track_name: { type: ["string", "null"], description: "Bana, t.ex. Solvalla." },
            race_date: { type: "string", format: "date", description: "Tävlingsdatum, YYYY-MM-DD." },
            bet_stop_at: {
              type: ["string", "null"],
              format: "date-time",
              description: "Spelstopp om känt, annars null.",
            },
            budget: { type: ["number", "null"] },
            row_price: { type: ["number", "null"], description: "Radpris i kronor." },
            stated_cost: {
              type: ["number", "null"],
              description: "Kostnad så som den angavs/minns. Null om okänd.",
            },
            stated_rows: {
              type: ["integer", "null"],
              description: "Radantal så som det angavs. Null om okänt.",
            },
            legs: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              description: "En post per avdelning V85-1 till V85-8.",
              items: {
                type: "object",
                required: ["leg", "selected"],
                properties: {
                  leg: { type: "integer", minimum: 1, maximum: 8 },
                  selected: {
                    type: "array",
                    minItems: 1,
                    description: "Valda hästar. Startnummer som heltal eller namn som text.",
                    items: { type: ["integer", "string"] },
                  },
                  spike: {
                    type: ["boolean", "null"],
                    description: "true om avdelningen spikades.",
                  },
                  winner: {
                    type: ["integer", "string", "null"],
                    description: "Vinnande häst. Endast om den är verifierad, annars null.",
                  },
                  note: { type: ["string", "null"] },
                },
              },
            },
            winners_verified: {
              type: "boolean",
              default: false,
              description:
                "Sätt endast true om vinnarna är verifierade mot en källa. Osäkra vinnare importeras aldrig som verifierade.",
            },
            correct_count: { type: ["integer", "null"], description: "Antal rätt, 0-8." },
            spike_hits: { type: ["integer", "null"], description: "Antal vinnande spikar." },
            payout: { type: ["number", "null"], description: "Utbetalning/vinst i kronor." },
            net_result: {
              type: ["number", "null"],
              description: "Nettoresultat. Beräknas från utbetalning minus kostnad om det utelämnas.",
            },
            analysis: { type: ["string", "null"], description: "Analys av omgången." },
            lessons: { type: ["string", "null"], description: "Lärdomar." },
            data_quality: {
              type: "string",
              enum: ["verified", "partially_verified", "incomplete"],
              description:
                "verified = allt kontrollerat mot källa. partially_verified = delar kontrollerade. incomplete = ofullständigt.",
            },
            source: { type: ["string", "null"], description: "Informationskälla." },
            uncertainty_note: {
              type: ["string", "null"],
              description: "Vad som är osäkert i posten.",
            },
            systems: {
              type: "array",
              description:
                "Ursprungligt system och eventuella reviderade versioner, i ordning. Version 1 = ursprungligt.",
              items: {
                type: "object",
                required: ["version", "legs"],
                properties: {
                  version: { type: "integer", minimum: 1 },
                  label: { type: ["string", "null"], description: "T.ex. Ursprungligt, Revidering 1." },
                  reason: { type: ["string", "null"], description: "Varför systemet ändrades." },
                  legs: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["leg", "selected"],
                      properties: {
                        leg: { type: "integer", minimum: 1, maximum: 8 },
                        selected: { type: "array", items: { type: ["integer", "string"] } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as const;
}

export function historyImportRules() {
  return [
    "Osäkra uppgifter får aldrig importeras som verifierade – sätt winners_verified=false och data_quality till partially_verified eller incomplete.",
    "Okända resultat och belopp ska vara null, aldrig gissade nollor.",
    "Både angivet (stated_rows/stated_cost) och matematiskt beräknat radantal/kostnad sparas när de skiljer sig.",
    "Historikposter påverkar aldrig gruppens verkliga ekonomisaldo – ingen ekonomisk transaktion skapas.",
    "Spelinsats hålls åtskild från registrerad ekonomisk transaktion.",
    "Importen är idempotent: samma idempotency_key importeras aldrig två gånger.",
    "Kör alltid mode=preview först – då returneras förhandsgranskning och valideringsfel utan att något sparas.",
    "Befintliga poster skrivs bara över när overwrite_existing=true anges uttryckligen.",
    "Posten markeras som användbar för lärande endast när datakvaliteten är verified eller partially_verified med verifierade vinnare.",
    "Alla importerade poster får statusen 'Importerad historik' och blandas inte med riktiga omgångar.",
  ];
}

export function exampleHistoryImportPayload() {
  return {
    mode: "preview",
    overwrite_existing: false,
    rounds: [
      {
        idempotency_key: "solvalla-2025-11-15",
        track_name: "Solvalla",
        race_date: "2025-11-15",
        bet_stop_at: "2025-11-15T16:20:00+01:00",
        budget: 450,
        row_price: 0.5,
        stated_cost: 960,
        stated_rows: 1920,
        legs: [
          { leg: 1, selected: [3], spike: true, winner: 3, note: "Spik som höll." },
          { leg: 2, selected: [1, 5, 8], spike: false, winner: 5, note: null },
          { leg: 3, selected: [2, 4], spike: false, winner: 9, note: "Missad skräll." },
          { leg: 4, selected: [7], spike: true, winner: 7, note: null },
          { leg: 5, selected: [1, 2, 6, 11], spike: false, winner: 2, note: null },
          { leg: 6, selected: [4, 9], spike: false, winner: 4, note: null },
          { leg: 7, selected: [3, 5, 10], spike: false, winner: 10, note: null },
          { leg: 8, selected: [6, 8], spike: false, winner: 8, note: null },
        ],
        winners_verified: true,
        correct_count: 7,
        spike_hits: 2,
        payout: 412,
        net_result: null,
        analysis: "För smala garderingar i avdelning 3 där marknaden var splittrad.",
        lessons: "Bredda avdelningar där ingen häst är över 30 procent.",
        data_quality: "verified",
        source: "ATG spelhistorik + egen anteckningsbok",
        uncertainty_note: null,
        systems: [
          {
            version: 1,
            label: "Ursprungligt",
            reason: null,
            legs: [
              { leg: 3, selected: [2, 4] },
            ],
          },
          {
            version: 2,
            label: "Revidering 1",
            reason: "Bytte ut häst 4 efter strykning.",
            legs: [{ leg: 3, selected: [2, 6] }],
          },
        ],
      },
    ],
  };
}
