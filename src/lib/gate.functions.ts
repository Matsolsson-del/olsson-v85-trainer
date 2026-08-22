import { createServerFn } from "@tanstack/react-start";

export type MemberSlot = { slug: string; label: string };

export const MEMBER_SLOTS: MemberSlot[] = [
  { slug: "mats", label: "Mats" },
  { slug: "bosse", label: "Bosse" },
  { slug: "olle", label: "Olle" },
];

export const getGateState = createServerFn({ method: "GET" })
  .inputValidator((data: { ticket?: string } | undefined) => ({
    ticket: typeof data?.ticket === "string" ? data.ticket : "",
  }))
  .handler(async ({ data }) => {
    const { ticketIsValid } = await import("@/lib/gate.server");
    let unlocked = false;
    try {
      unlocked = ticketIsValid(data.ticket);
    } catch (error) {
      console.error("[gate] getGateState failed", error);
    }
    return { unlocked, configured: Boolean(process.env.FAMILY_PASSWORD) };
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

    const { passwordMatches, createTicket } = await import("@/lib/gate.server");
    if (!data.password || !passwordMatches(data.password, expected)) {
      return { ok: false as const, reason: "wrong" as const };
    }

    return { ok: true as const, ticket: createTicket() };
  });

export const signInAsMember = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string; ticket?: string }) => ({
    slug: String(data?.slug ?? ""),
    ticket: typeof data?.ticket === "string" ? data.ticket : "",
  }))
  .handler(async ({ data }) => {
    const { ticketIsValid, SLOT_EMAILS } = await import("@/lib/gate.server");
    if (!ticketIsValid(data.ticket)) {
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

export const lockFamily = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true as const };
});
