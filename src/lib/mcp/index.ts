import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRoundsTool from "./tools/list-rounds";
import getRoundTool from "./tools/get-round";
import getMarketTool from "./tools/get-market";
import createRiskFlagTool from "./tools/create-risk-flag";
import getSystemTool from "./tools/get-system";
import proposeSystemTool from "./tools/propose-system";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "familjen-olssons-travhub",
  title: "Familjen Olssons Travhub",
  version: "0.1.0",
  instructions:
    "Verktyg för Familjen Olssons Travhub (V85). Använd list_rounds för att hitta omgångar, get_round för startfält, get_market för ATG:s spelfördelning, get_system för nuvarande systemförslag, propose_system för att skriva in ett systemförslag som utkast och create_risk_flag för att flagga risker. Verktygen producerar bara underlag – de låser inga system och kan aldrig lämna in ett spel. Spelet lämnas alltid in manuellt hos ATG.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listRoundsTool,
    getRoundTool,
    getMarketTool,
    getSystemTool,
    proposeSystemTool,
    createRiskFlagTool,
  ],
});
