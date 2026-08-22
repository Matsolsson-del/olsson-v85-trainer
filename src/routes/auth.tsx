import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGateState, unlockFamily, signInAsMember } from "@/lib/gate.functions";
import {
  getRememberedPerson,
  rememberPerson,
  getGateTicket,
  saveGateTicket,
} from "@/lib/person-memory";

const SLOTS = [
  { slug: "mats", label: "Mats" },
  { slug: "bosse", label: "Bosse" },
  { slug: "olle", label: "Olle" },
] as const;

function safeNext(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string; byt?: boolean } => {
    const next = safeNext(s.next);
    return { ...(next ? { next } : {}), ...(s.byt ? { byt: true } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Välkommen – Familjen Olssons Travhub" },
      {
        name: "description",
        content: "Ange familjens lösenord och välj vem du är för att komma in i Travhubben.",
      },
      { property: "og:title", content: "Välkommen – Familjen Olssons Travhub" },
      { property: "og:description", content: "Familjens privata V85-hubb." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { next, byt } = Route.useSearch();

  const gateFn = useServerFn(getGateState);
  const unlockFn = useServerFn(unlockFamily);
  const signInFn = useServerFn(signInAsMember);

  const {
    data: gate,
    isLoading: gateLoading,
    refetch: refetchGate,
  } = useQuery({
    queryKey: ["gate"],
    queryFn: () => gateFn({ data: { ticket: getGateTicket() } }),
    retry: false,
  });

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const autoTried = useRef(false);

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
  }, [session]);

  // Kom ihåg personen i 90 dagar: öppna direkt utan att fråga igen.
  useEffect(() => {
    if (autoTried.current || byt || session || !gate?.unlocked) return;
    const slug = getRememberedPerson();
    if (!slug) return;
    autoTried.current = true;
    void enterAs(slug, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate?.unlocked, session, byt]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    setMessage(null);
    try {
      const res = await unlockFn({ data: { password } });
      if (res.ok && "ticket" in res) {
        saveGateTicket(res.ticket);
        setPassword("");
        await refetchGate();
        return;
      }
      if (res.reason === "config") {
        setMessage("Lösenordet är inte inställt på servern ännu.");
      } else {
        setMessage("Fel lösenord – försök igen.");
      }
    } catch {
      setMessage("Det gick inte just nu. Försök igen.");
    } finally {
      setBusy(null);
    }
  }

  async function enterAs(slug: string, silent = false) {
    setBusy(slug);
    if (!silent) setMessage(null);
    try {
      const res = await signInFn({ data: { slug, ticket: getGateTicket() } });
      if (!res.ok || !("session" in res)) {
        if (!silent) setMessage("Det gick inte att öppna just nu. Försök igen.");
        return;
      }
      const { error } = await supabase.auth.setSession(res.session);
      if (error) {
        if (!silent) setMessage("Det gick inte att öppna just nu. Försök igen.");
        return;
      }
      rememberPerson(slug);
      goOn();
    } catch {
      if (!silent) setMessage("Det gick inte att öppna just nu. Försök igen.");
    } finally {
      setBusy(null);
    }
  }

  const unlocked = gate?.unlocked === true;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-semibold text-primary">
            Välkommen till Familjen Olssons Travhub
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Två steg: skriv familjens lösenord och tryck sedan på ditt namn.
          </p>
        </div>

        <div className="space-y-4 rounded-lg bg-card p-6 text-card-foreground shadow-lg">
          {gateLoading ? (
            <p className="text-center text-base text-muted-foreground">Laddar …</p>
          ) : !unlocked ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <label htmlFor="familypw" className="block text-lg font-medium">
                Steg 1: Ange familjens lösenord
              </label>
              <div className="flex gap-2">
                <Input
                  id="familypw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-14 flex-1 text-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-14 px-4 text-base"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Dölj" : "Visa"}
                </Button>
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-14 w-full text-lg"
                disabled={busy !== null || password.trim() === ""}
              >
                {busy === "password" ? "Kontrollerar …" : "Fortsätt"}
              </Button>
            </form>
          ) : (
            <>
              <p className="text-lg font-medium">Steg 2: Vem är du?</p>
              {SLOTS.map((slot) => (
                <Button
                  key={slot.slug}
                  className="h-16 w-full justify-center text-xl"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => enterAs(slot.slug)}
                >
                  {busy === slot.slug ? "Öppnar …" : slot.label}
                </Button>
              ))}
            </>
          )}

          {message && (
            <p role="alert" className="text-center text-base font-medium text-destructive">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
