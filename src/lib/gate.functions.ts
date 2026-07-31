import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Familjens gemensamma lösenord kontrolleras ENBART på servern.
 * Lösenordet finns aldrig i frontend-koden, i bundlen eller i databasen –
 * det läses från miljövariabeln FAMILY_PASSWORD inuti handlern.
 */

export type MemberSlot = { slug: string; label: string };

export const MEMBER_SLOTS: MemberSlot[] = [
  { slug: "mats", label: "Mats" },
  { slug: "bosse", label: "Bosse" },
  { slug: "olle", label: "Olle" },
];

const SLOT_EMAILS: Record<string, string> = {
  mats: "olsson-1@olssonstravhub.se",
  bosse: "olsson-2@olssonstravhub.se",
  olle: "olsson-3@olssonstravhub.se",
};

const NINETY_DAYS = 60 * 60 * 24 * 90;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

type GateSession = {
  unlocked?: boolean;
  failedAttempts?: number;
  lockedUntil?: number;
};

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET saknas eller är för kort på servern.");
  }
  return {
    password,
    name: "olsson-travhub-gate",
    maxAge: NINETY_DAYS,
    cookie: {
      httpOnly: true,
      secure: true,
      // Förhandsvisningen körs i en iframe – utan "none" skickas kakan aldrig
      // tillbaka och lösenordet verkar aldrig fungera.
      sameSite: "none" as const,
      path: "/",
    },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const getGateState = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await useSession<GateSession>(sessionConfig());
    const lockedUntil = session.data.lockedUntil ?? 0;
    return {
      unlocked: session.data.unlocked === true,
      lockedForSeconds: lockedUntil > Date.now() ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0,
      configured: Boolean(process.env.FAMILY_PASSWORD),
    };
  } catch (error) {
    console.error("[gate] getGateState failed", error);
    return { unlocked: false, lockedForSeconds: 0, configured: false };
  }
});

export const unlockFamily = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => ({
    password: typeof data?.password === "string" ? data.password.slice(0, 200) : "",
  }))
  .handler(async ({ data }) => {
    const expected = process.env.FAMILY_PASSWORD;
    if (!expected) {
      console.error("[gate] FAMILY_PASSWORD saknas i servermiljön");
      return { ok: false as const, reason: "config" as const };
    }

    const session = await useSession<GateSession>(sessionConfig());
    const lockedUntil = session.data.lockedUntil ?? 0;
    if (lockedUntil > Date.now()) {
      return {
        ok: false as const,
        reason: "locked" as const,
        lockedForSeconds: Math.ceil((lockedUntil - Date.now()) / 1000),
      };
    }

    if (!data.password || !matches(data.password, expected)) {
      const failed = (session.data.failedAttempts ?? 0) + 1;
      await session.update({
        unlocked: false,
        failedAttempts: failed,
        lockedUntil: failed >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
      });
      return {
        ok: false as const,
        reason: failed >= MAX_ATTEMPTS ? ("locked" as const) : ("wrong" as const),
        lockedForSeconds: failed >= MAX_ATTEMPTS ? LOCKOUT_MS / 1000 : 0,
      };
    }

    await session.update({ unlocked: true, failedAttempts: 0, lockedUntil: 0 });
    return { ok: true as const };
  });

export const lockFamily = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

/**
 * Personvalet sker också på servern: kontot som används för varje person
 * skyddas av MEMBER_LOGIN_PASSWORD, som aldrig lämnar servern. Klienten får
 * bara den färdiga sessionen.
 */
export const signInAsMember = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string }) => ({ slug: String(data?.slug ?? "") }))
  .handler(async ({ data }) => {
    const session = await useSession<GateSession>(sessionConfig());
    if (session.data.unlocked !== true) {
      return { ok: false as const, reason: "gate" as const };
    }

    const email = SLOT_EMAILS[data.slug];
    const label = MEMBER_SLOTS.find((s) => s.slug === data.slug)?.label;
    if (!email || !label) return { ok: false as const, reason: "unknown" as const };

    const password = process.env.MEMBER_LOGIN_PASSWORD;
    if (!password) {
      console.error("[gate] MEMBER_LOGIN_PASSWORD saknas i servermiljön");
      return { ok: false as const, reason: "config" as const };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    let result = await client.auth.signInWithPassword({ email, password });

    if (result.error) {
      // Personen finns inte ännu – skapa kontot en gång, redan bekräftat.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: label },
      });
      result = await client.auth.signInWithPassword({ email, password });
    }

    if (result.error || !result.data.session) {
      console.error("[gate] signInAsMember failed", result.error?.message);
      return { ok: false as const, reason: "signin" as const };
    }

    return {
      ok: true as const,
      label,
      session: {
        access_token: result.data.session.access_token,
        refresh_token: result.data.session.refresh_token,
      },
    };
  });
