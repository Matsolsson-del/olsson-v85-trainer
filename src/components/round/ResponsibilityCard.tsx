import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/labels";
import { useMembers } from "@/lib/travhub-queries";
import {
  useIsResponsible,
  useResponsibilityActions,
  useRoundResponsibility,
} from "@/lib/responsibility-queries";

type Props = { roundId: string; groupId: string | null };

export function ResponsibilityCard({ roundId, groupId }: Props) {
  const { data: responsibility, isLoading } = useRoundResponsibility(roundId);
  const { data: members } = useMembers(groupId);
  const isResponsible = useIsResponsible(roundId);
  const { assign, confirm, change } = useResponsibilityActions(roundId);

  const [newUser, setNewUser] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"continue" | "move_last">("continue");
  const [showChange, setShowChange] = useState(false);

  const name =
    (responsibility as any)?.profiles?.display_name ??
    (responsibility as any)?.profiles?.email ??
    "Ej tilldelad";

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (e: any) {
      toast.error(e.message ?? "Något gick fel.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Veckans spelansvarig</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <p className="text-muted-foreground">Laddar…</p>
        ) : !responsibility ? (
          <>
            <p className="text-muted-foreground">
              Ingen spelansvarig är tilldelad för omgången ännu.
            </p>
            <Button
              size="sm"
              disabled={assign.isPending}
              onClick={() =>
                run(() => assign.mutateAsync(), "Spelansvarig tilldelad enligt turordningen.")
              }
            >
              Tilldela enligt turordning
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{name}</span>
              <Badge variant={responsibility.confirmed_at ? "secondary" : "outline"}>
                {responsibility.confirmed_at
                  ? `Bekräftad ${formatDateTime(responsibility.confirmed_at)}`
                  : "Ej bekräftad"}
              </Badge>
            </div>
            {responsibility.change_reason && (
              <p className="text-muted-foreground">
                Byte: {responsibility.change_reason}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Endast spelansvarig kan låsa system och markera spelet som inlämnat. Övrigas
              godkännande krävs inte.
            </p>

            <div className="flex flex-wrap gap-2">
              {isResponsible && !responsibility.confirmed_at && (
                <Button
                  size="sm"
                  disabled={confirm.isPending}
                  onClick={() => run(() => confirm.mutateAsync(), "Uppdraget är bekräftat.")}
                >
                  Bekräfta uppdraget
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setShowChange((v) => !v)}>
                Byt ansvarig
              </Button>
            </div>

            {showChange && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <Label>Ny ansvarig</Label>
                  <Select value={newUser} onValueChange={setNewUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj medlem" />
                    </SelectTrigger>
                    <SelectContent>
                      {(members ?? []).map((m: any) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profiles?.display_name ?? m.profiles?.email ?? "Medlem"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Orsak (obligatorisk)</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Turordning</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continue">Ordinarie rotation fortsätter</SelectItem>
                      <SelectItem value="move_last">Den frånvarande flyttas sist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={change.isPending || !newUser || !reason.trim()}
                  onClick={async () => {
                    await run(
                      () => change.mutateAsync({ userId: newUser, reason, mode }),
                      "Ansvaret är bytt och loggat.",
                    );
                    setShowChange(false);
                    setReason("");
                  }}
                >
                  Spara byte
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
