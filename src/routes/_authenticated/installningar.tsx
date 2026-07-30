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

export const Route = createFileRoute("/_authenticated/installningar")({
  head: () => ({
    meta: [
      { title: "Inställningar – Travhubben" },
      { name: "description", content: "Grupp, medlemmar, inbjudningar och standardvärden." },
      { property: "og:title", content: "Inställningar – Travhubben" },
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
    </>
  );
}
