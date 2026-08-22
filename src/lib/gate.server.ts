import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Familjens lösenord kontrolleras ENBART på servern. Tidigare låg "upplåst"
 * i en session-kaka, men i förhandsvisningen (iframe) och i webbläsare som
 * blockerar tredjepartskakor kom kakan aldrig tillbaka – då verkade
 * lösenordet aldrig fungera. Nu får klienten i stället en signerad biljett
 * som lagras lokalt och verifieras på servern vid varje anrop.
 */

const NINETY_DAYS_MS = 1000 * 60 * 60 * 24 * 90;

export const SLOT_EMAILS: Record<string, string> = {
  mats: "olsson-1@olssonstravhub.se",
  bosse: "olsson-2@olssonstravhub.se",
  olle: "olsson-3@olssonstravhub.se",
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET saknas eller är för kort på servern.");
  }
  return value;
}

export function passwordMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createTicket(): string {
  const payload = String(Date.now() + NINETY_DAYS_MS);
  return `${payload}.${sign(payload)}`;
}

export function ticketIsValid(ticket: unknown): boolean {
  if (typeof ticket !== "string" || !ticket.includes(".")) return false;
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
}
