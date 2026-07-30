import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRoundsTool from "./tools/list-rounds";
import getRoundTool from "./tools/get-round";
import getMarketTool from "./tools/get-market";
import createRiskFlagTool from "./tools/create-risk-flag";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "familjen-olssons-travhub",
  title: "Familjen Olssons Travhub",
  version: "0.1.0",
  instructions:
    "Verktyg för Familjen Olssons Travhub (V85). Använd list_rounds för att hitta omgångar, get_round för startfält, get_market för ATG:s spelfördelning och create_risk_flag för att flagga risker. Verktygen producerar bara underlag – de låser inga system och lämnar inte in spel.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRoundsTool, getRoundTool, getMarketTool, createRiskFlagTool],
});
