import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TRANSACTION_LABELS, formatCurrency, formatDate } from "@/lib/labels";
import { useActiveGroupId, useLedger } from "@/lib/travhub-queries";

export const Route = createFileRoute("/_authenticated/ekonomi")({
  head: () => ({
    meta: [
      { title: "Ekonomi – Travhubben" },
      { name: "description", content: "Insatser, vinster, insättningar och gruppens saldo." },
      { property: "og:title", content: "Ekonomi – Travhubben" },
      { property: "og:description", content: "Full spårbarhet över gruppens spelekonomi." },
    ],
  }),
  component: EkonomiPage,
});

const TYPES = ["contribution", "stake", "winnings", "withdrawal", "correction"] as const;

function signedAmount(t: any) {
  const amount = Number(t.amount);
  if (t.transaction_type === "stake" || t.transaction_type === "withdrawal") return -amount;
  return amount;
}

function EkonomiPage() {
  const { user } = useAuth();
  const { groupId } = useActiveGroupId();
  const { data: ledger, refetch } = useLedger(groupId);
  const [type, setType] = useState<string>("contribution");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const balance = (ledger ?? []).reduce((s, t: any) => s + signedAmount(t), 0);

  async function add() {
    if (!groupId || !amount) return toast.error("Fyll i belopp.");
    setBusy(true);
    const { error } = await supabase.from("ledger_transactions").insert({
      group_id: groupId,
      transaction_type: type as any,
      amount: Number(amount),
      transaction_date: date,
      note: note || null,
      created_by: user!.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount("");
    setNote("");
    toast.success("Transaktionen är bokförd.");
    refetch();
  }

  return (
    <>
      <PageHeader
        title="Ekonomi"
        description="Alla insatser och vinster bokförs så att gruppens saldo alltid går att härleda."
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saldo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-serif text-3xl font-semibold">{formatCurrency(balance)}</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ny transaktion</CardTitle>
        </CardHeader>
        <CardContent className="grid items-end gap-3 md:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSACTION_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Belopp (kr)</Label>
            <Input
              type="number"
              step="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Datum</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notering</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button onClick={add} disabled={busy}>
            Bokför
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transaktioner</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Notering</TableHead>
                <TableHead className="text-right">Belopp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ledger ?? []).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDate(t.transaction_date)}</TableCell>
                  <TableCell>{TRANSACTION_LABELS[t.transaction_type] ?? t.transaction_type}</TableCell>
                  <TableCell className="text-muted-foreground">{t.note ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(signedAmount(t))}
                  </TableCell>
                </TableRow>
              ))}
              {(ledger ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Inga transaktioner ännu.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
