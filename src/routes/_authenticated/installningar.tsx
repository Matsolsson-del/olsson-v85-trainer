import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveGroupId, useIsOwner, useMembers } from "@/lib/travhub-queries";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  createDemoRoundNow,
  deleteHistoryNow,
  exportGroupDataNow,
} from "@/lib/data-admin.functions";

export const Route = createFileRoute("/_authenticated/installningar")({
  head: () => ({
    meta: [
      { title: "Inställningar – Familjen Olssons Travhub" },
      { name: "description", content: "Grupp, medlemmar, inbjudningar och standardvärden." },
      { property: "og:title", content: "Inställningar – Familjen Olssons Travhub" },
      { property: "og:description", content: "Administrera gruppen och dess spelregler." },
    ],
  }),
  component: InstallningarPage,
});

function InstallningarPage() {
  const { user } = useAuth();
  const { groupId, groups, refetchGroups } = useActiveGroupId();
  const { data: members, refetch: refetchMembers } = useMembers(groupId);
  const isOwner = useIsOwner(groupId);
  const [groupName, setGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function createGroup() {
    if (!groupName.trim()) return toast.error("Ange ett gruppnamn.");
    setBusy(true);
    const { error } = await supabase
      .from("groups")
      .insert({ name: groupName.trim(), owner_id: user!.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    setGroupName("");
    toast.success("Gruppen är skapad.");
    refetchGroups();
  }

  async function invite() {
    if (!groupId || !inviteEmail.trim()) return toast.error("Ange e-postadress.");
    setBusy(true);
    const { error } = await supabase.from("group_invitations").insert({
      group_id: groupId,
      email: inviteEmail.trim().toLowerCase(),
      invited_by: user!.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setInviteEmail("");
    toast.success("Inbjudan skapad. Medlemmen ansluts vid registrering.");
    refetchMembers();
  }

  return (
    <>
      <PageHeader title="Inställningar" description="Gruppen, medlemmarna och standardvärden." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Medlemmar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(members ?? []).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between gap-3">
                <span>{m.profiles?.display_name ?? m.profiles?.email ?? "Medlem"}</span>
                <Badge variant="secondary">{m.role === "owner" ? "Ägare" : "Medlem"}</Badge>
              </div>
            ))}
            {(members ?? []).length === 0 && (
              <p className="text-muted-foreground">Inga medlemmar ännu.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {groups.length === 0 ? "Skapa grupp" : "Bjud in medlem"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {groups.length === 0 ? (
              <>
                <div className="space-y-1.5">
                  <Label>Gruppnamn</Label>
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="t.ex. Familjen Olsson"
                  />
                </div>
                <Button onClick={createGroup} disabled={busy}>
                  Skapa grupp
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>E-post</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>
                <Button onClick={invite} disabled={busy || !isOwner}>
                  Skicka inbjudan
                </Button>
                {!isOwner && (
                  <p className="text-xs text-muted-foreground">
                    Endast gruppens ägare kan bjuda in nya medlemmar.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {isOwner && groupId && <OwnerTools groupId={groupId} />}
    </>
  );
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function OwnerTools({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const exportFn = useServerFn(exportGroupDataNow);
  const deleteFn = useServerFn(deleteHistoryNow);
  const demoFn = useServerFn(createDemoRoundNow);

  const [busy, setBusy] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [scope, setScope] = useState<"demo" | "all" | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Något gick fel. Försök igen.");
    } finally {
      setBusy(null);
    }
  }

  async function exportData(format: "json" | "csv") {
    await run(
      format,
      async () => {
        const res: any = await exportFn({ data: { groupId } });
        const stamp = new Date().toISOString().slice(0, 10);
        if (format === "json") {
          download(`travhubben-${stamp}.json`, JSON.stringify(res.json, null, 2), "application/json");
        } else {
          for (const file of res.csv as { name: string; content: string }[]) {
            download(`travhubben-${stamp}-${file.name}`, file.content || "", "text/csv;charset=utf-8");
          }
        }
      },
      format === "json" ? "JSON-filen är nedladdad." : "CSV-filerna är nedladdade.",
    );
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Exportera all data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Ladda ner gruppens omgångar, system, resultat och ekonomi. CSV öppnas i Excel, JSON är
            en fullständig säkerhetskopia.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="h-12 text-base"
              disabled={busy !== null}
              onClick={() => exportData("csv")}
            >
              {busy === "csv" ? "Hämtar…" : "Ladda ner CSV"}
            </Button>
            <Button
              variant="secondary"
              className="h-12 text-base"
              disabled={busy !== null}
              onClick={() => exportData("json")}
            >
              {busy === "json" ? "Hämtar…" : "Ladda ner JSON"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Demoläge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Skapa en övningsomgång med påhittade hästar. Demoomgångar märks med “Demo” och räknas
            aldrig in i resultat, ekonomi, kalibrering eller personliga råd.
          </p>
          <Button
            variant="secondary"
            className="h-12 text-base"
            disabled={busy !== null}
            onClick={() =>
              run("demo", () => demoFn({ data: { groupId } }), "Demoomgången är skapad.")
            }
          >
            {busy === "demo" ? "Skapar…" : "Skapa demoomgång"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40 md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-destructive">Radera historik</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Radering går inte att ångra. Ladda gärna ner en säkerhetskopia först. Skriv RADERA i
            rutan och välj vad som ska tas bort.
          </p>
          <div className="space-y-1.5 max-w-xs">
            <Label>Bekräftelse</Label>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
              placeholder="RADERA"
              className="h-12 text-base"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              className="h-12 text-base"
              disabled={busy !== null || confirmation !== "RADERA"}
              onClick={() => setScope("demo")}
            >
              Radera bara demodata
            </Button>
            <Button
              variant="destructive"
              className="h-12 text-base"
              disabled={busy !== null || confirmation !== "RADERA"}
              onClick={() => setScope("all")}
            >
              Radera all historik
            </Button>
          </div>
          {scope && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="font-semibold">
                {scope === "all"
                  ? "Vill du verkligen radera all historik och ekonomi?"
                  : "Vill du radera alla demoomgångar?"}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  variant="destructive"
                  className="h-12 text-base"
                  disabled={busy !== null}
                  onClick={async () => {
                    await run(
                      "delete",
                      () => deleteFn({ data: { groupId, scope, confirmation } }),
                      scope === "all" ? "Historiken är raderad." : "Demodata är raderad.",
                    );
                    setScope(null);
                    setConfirmation("");
                  }}
                >
                  {busy === "delete" ? "Raderar…" : "Ja, radera"}
                </Button>
                <Button variant="secondary" className="h-12 text-base" onClick={() => setScope(null)}>
                  Avbryt
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
