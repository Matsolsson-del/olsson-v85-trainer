import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Coins,
  FileUp,
  History,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
  Workflow,
  ClipboardList,
  Newspaper,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { lockFamily } from "@/lib/gate.functions";
import { forgetPerson } from "@/lib/person-memory";
import { useActiveGroupId, useMyProfile, useOwnerStatus } from "@/lib/travhub-queries";

export const Route = createFileRoute("/_authenticated/mer")({
  head: () => ({
    meta: [
      { title: "Mer – Familjen Olssons Travhub" },
      {
        name: "description",
        content:
          "Ekonomi, personliga råd, inställningar och byte av person i Familjen Olssons Travhub.",
      },
      { property: "og:title", content: "Mer – Familjen Olssons Travhub" },
      {
        property: "og:description",
        content: "Samlingssida för ekonomi, råd och inställningar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MerPage,
});

function BigLink({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: typeof Coins;
}) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-border bg-card p-5 text-card-foreground transition-colors hover:border-primary hover:bg-surface"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-semibold">{title}</p>
          <p className="mt-1 text-base text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function MerPage() {
  const { data: profile } = useMyProfile();
  const { groupId } = useActiveGroupId();
  const { isOwner } = useOwnerStatus(groupId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lockFn = useServerFn(lockFamily);

  async function switchPerson() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { byt: true }, replace: true });
  }

  async function signOutCompletely() {
    await qc.cancelQueries();
    qc.clear();
    forgetPerson();
    await supabase.auth.signOut();
    try {
      await lockFn();
    } catch {
      /* sessionen rensas ändå på klienten */
    }
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <PageHeader
        title="Mer"
        description={`Inloggad som ${profile?.display_name ?? "okänd person"}.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <BigLink
          to="/ekonomi"
          icon={Coins}
          title="Ekonomi"
          description="Se insättningar, spelkostnader, vinster och gruppens saldo."
        />
        <BigLink
          to="/mina-rad"
          icon={Sparkles}
          title="Mina råd"
          description="Se personliga råd baserade på dina tidigare bedömningar."
        />
        <BigLink
          to="/installningar"
          icon={Settings}
          title="Inställningar"
          description="Hantera namn och grundinställningar."
        />
        <BigLink
          to="/historik"
          icon={History}
          title="Historik"
          description="Se tidigare V85-omgångar, importerade spel och detaljerade system."
        />
        <BigLink
          to="/experttips"
          icon={Newspaper}
          title="Experttips"
          description="Alla insamlade tips från travsajter och bloggar."
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-xl font-semibold">Byt person</p>
            <p className="text-base text-muted-foreground">
              Lämna över till Mats, Bosse eller Olle på samma enhet.
            </p>
            <Button size="lg" className="h-14 w-full text-lg" onClick={switchPerson}>
              <UserRound className="mr-2 h-5 w-5" aria-hidden />
              Byt person
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-xl font-semibold">Logga ut</p>
            <p className="text-base text-muted-foreground">
              Stänger hubben helt. Nästa gång behövs familjens lösenord igen.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="h-14 w-full text-lg"
              onClick={signOutCompletely}
            >
              <LogOut className="mr-2 h-5 w-5" aria-hidden />
              Logga ut från Travhubben
            </Button>
          </CardContent>
        </Card>
      </div>

      {isOwner && (
        <section className="mt-10">
          <h2 className="mb-1 font-serif text-2xl font-semibold">Avancerat</h2>
          <p className="mb-4 text-base text-foreground/80">
            Tekniska verktyg. Visas bara för dig som äger gruppen.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <BigLink
              to="/automation"
              icon={Workflow}
              title="Automation"
              description="Torsdagsjobb, körningar och teknisk importstatus."
            />
            <BigLink
              to="/ai-import"
              icon={Sparkles}
              title="AI-import"
              description="Nyckel och logg för AI-levererade underlag."
            />
            <BigLink
              to="/historikimport"
              icon={FileUp}
              title="Historikimport"
              description="Lägg in gamla V85-spel i efterhand."
            />
            <BigLink
              to="/historik-dubbletter"
              icon={ClipboardList}
              title="Granska dubbletter"
              description="Avgör om två poster är samma system."
            />
            <BigLink
              to="/omgangar"
              icon={History}
              title="Omgångar i hubben"
              description="Alla omgångar som skapats i Travhubben."
            />
            <BigLink
              to="/installningar"
              icon={Settings}
              title="Gruppadministration, export och radering"
              description="Medlemmar, export av data och arkivering längst ned på sidan."
            />
          </div>
        </section>
      )}
    </>
  );
}
