import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/**
 * Ingen inloggningsspärr: hubben delas bara mellan familjens två spelare.
 * Man väljer bara vem man är, så att analyser, ansvar och ekonomi kan
 * kopplas till rätt person. Sessionen skapas i bakgrunden.
 */
const MEMBER_SLOTS = [
  { slug: "1", email: "olsson-1@olssonstravhub.se", label: "Mats" },
  { slug: "2", email: "olsson-2@olssonstravhub.se", label: "Bosse" },
  { slug: "3", email: "olsson-3@olssonstravhub.se", label: "Olle" },
] as const;

const SHARED_SECRET = "familjen-olsson-travhub-2026";

function safeNext(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: safeNext(s.next) ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Välj användare – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Välj vem du är för att fortsätta i familjens privata V85-hubb.",
      },
      { property: "og:title", content: "Välj användare – Familjen Olssons Travhub" },
      { property: "og:description", content: "Familjens privata V85-analyshubb." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [busy, setBusy] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  function goOn() {
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/oversikt", replace: true });
  }

  useEffect(() => {
    if (session) goOn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, navigate, next]);


  useEffect(() => {
    supabase
      .from("profiles")
      .select("email, display_name")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const p of data) if (p.email && p.display_name) map[p.email] = p.display_name;
        setNames(map);
      });
  }, []);

  async function enterAs(slot: (typeof MEMBER_SLOTS)[number]) {
    setBusy(slot.slug);
    try {
      let { error } = await supabase.auth.signInWithPassword({
        email: slot.email,
        password: SHARED_SECRET,
      });

      if (error) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: slot.email,
          password: SHARED_SECRET,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: slot.label },
          },
        });
        if (signUpError) throw signUpError;

        ({ error } = await supabase.auth.signInWithPassword({
          email: slot.email,
          password: SHARED_SECRET,
        }));
        if (error) throw error;
      }

      const { data: groupId } = await supabase.rpc("join_family_group");
      if (!groupId) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          await supabase.from("groups").insert({
            name: "Familjen Olsson",
            owner_id: auth.user.id,
          });
        }
      }
      goOn();


    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte fortsätta.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-semibold text-primary">
            Familjen Olssons Travhub
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Ingen inloggning – välj bara vem du är så vet hubben vems analys som är vems.
          </p>
        </div>

        <div className="space-y-3 rounded-lg bg-card p-6 text-card-foreground shadow-lg">
          <p className="text-sm font-medium">Vem är du?</p>
          {MEMBER_SLOTS.map((slot) => (
            <Button
              key={slot.slug}
              className="w-full justify-start"
              variant="secondary"
              size="lg"
              disabled={busy !== null}
              onClick={() => enterAs(slot)}
            >
              {busy === slot.slug ? "Öppnar …" : (names[slot.email] ?? slot.label)}
            </Button>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            Du kan byta ditt visningsnamn under Inställningar. Eftersom det inte finns någon
            spärr kommer alla med länken in – blindanalysen bygger på att ni håller er till
            era egna namn.
          </p>
        </div>
      </div>
    </div>
  );
}
