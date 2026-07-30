import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Familjen Olssons Travhub – privat V85-hubb" },
      {
        name: "description",
        content:
          "Logga in i Familjen Olssons Travhub för att analysera V85, bygga system, låsa beslut och följa upp gruppens lärande.",
      },
      { property: "og:title", content: "Familjen Olssons Travhub – privat V85-hubb" },
      {
        property: "og:description",
        content: "Blindanalys, gruppbedömning, systembyggare och efterrapporter för V85.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/oversikt" : "/auth", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="font-serif text-3xl font-semibold text-primary">Familjen Olssons Travhub</h1>
      <p className="text-sm text-white/70">Laddar din analyshubb …</p>
    </div>
  );
}
