import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, CreditCard, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES, feeLinesFor, formatMoney, totalByCurrency, type FeeRule } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/pay")({
  head: () => ({
    meta: [
      { title: "Your Charges — Settle What's Due for the Celebration" },
      {
        name: "description",
        content:
          "See exactly what your family owes for each event, how to pay your hosts and everything you've already sent.",
      },
      { property: "og:title", content: "Your Charges — Settle What's Due for the Celebration" },
      {
        property: "og:description",
        content: "What your family owes per event, how to pay and what's already settled.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PayPage,
});

const METHODS = ["Bank transfer", "Cash", "UPI", "Card", "Other"] as const;

function PayPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("INR");
  const [method, setMethod] = useState<string>("Bank transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const me = useQuery({
    queryKey: ["pay-me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("household")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data?.household ?? null;
    },
  });

  const rules = useQuery({
    queryKey: ["pay-fees"],
    queryFn: async (): Promise<FeeRule[]> => {
      const { data, error } = await supabase
        .from("event_fees")
        .select(
          "id, invite_id, event_id, audience, label, currency, base_amount, per_guest_amount, note, active",
        )
        .eq("audience", "guest")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        base_amount: Number(r.base_amount ?? 0),
        per_guest_amount: Number(r.per_guest_amount ?? 0),
      })) as FeeRule[];
    },
  });

  const events = useQuery({
    queryKey: ["pay-events"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name");
      return data ?? [];
    },
  });

  const attendance = useQuery({
    queryKey: ["pay-attendance", me.data],
    enabled: !!me.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_attendance")
        .select("event_id, attending, guest_count")
        .eq("household", me.data as string);
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["pay-people"],
    queryFn: async () => {
      const { data } = await supabase.rpc("household_members");
      return data ?? [];
    },
  });

  const howToPay = useQuery({
    queryKey: ["pay-instructions"],
    queryFn: async () => {
      const { data } = await supabase.rpc("my_pay_instructions");
      return (data as string | null) ?? null;
    },
  });

  const outfitsCovered = useQuery({
    queryKey: ["pay-outfits-covered"],
    queryFn: async () => {
      const { data } = await supabase.rpc("my_outfits_paid_by_host");
      return (data as boolean | null) ?? true;
    },
  });

  const payments = useQuery({
    queryKey: ["pay-records", me.data],
    enabled: !!me.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("fee_payments")
        .select("id, currency, amount_paid, method, reference, note, paid_at, confirmed_at, created_at")
        .eq("payer_kind", "guest")
        .eq("household", me.data as string)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const feesOn = useQuery({
    queryKey: ["pay-fees-enabled"],
    queryFn: async () => {
      const { data } = await supabase.rpc("my_fees_enabled");
      return (data as boolean | null) ?? true;
    },
  });

  const lines = useMemo(() => {
    if (feesOn.data === false) return [];
    const heads = new Map<string, number>();
    for (const a of attendance.data ?? []) {
      if (!a.attending) continue;
      heads.set(a.event_id, Math.max(Number(a.guest_count ?? 1), 1));
    }
    return feeLinesFor({
      rules: rules.data ?? [],
      eventNames: new Map((events.data ?? []).map((e) => [e.id, e.name])),
      headsByEvent: heads,
      familyHeads: (people.data ?? []).length || 1,
    });
  }, [rules.data, events.data, attendance.data, people.data, feesOn.data]);

  const totals = totalByCurrency(lines);
  const settled = (payments.data ?? [])
    .filter((p) => p.confirmed_at)
    .reduce((s, p) => s + Number(p.amount_paid ?? 0), 0);
  const awaiting = (payments.data ?? [])
    .filter((p) => !p.confirmed_at)
    .reduce((s, p) => s + Number(p.amount_paid ?? 0), 0);
  const due = Math.max((totals[0]?.[1] ?? 0) - settled - awaiting, 0);

  const record = async () => {
    const value = Number(amount);
    if (!me.data || !Number.isFinite(value) || value <= 0) {
      toast.error("Put in the amount you've sent.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("fee_payments").insert({
      payer_kind: "guest",
      household: me.data,
      currency,
      amount_due: totals[0]?.[1] ?? value,
      amount_paid: value,
      method,
      reference: reference.trim() || null,
      paid_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAmount("");
    setReference("");
    await qc.invalidateQueries({ queryKey: ["pay-records"] });
    toast.success("Noted — your hosts will confirm it once it lands.");
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <p className="text-eyebrow">Your charges</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">What's payable</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        These are the charges for the events your family has said yes to.
      </p>

      <section className="panel mt-6 p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Wallet className="size-5 text-primary" /> Who owes what
        </h2>
        {lines.length > 0 ? (
          <p className="mt-2 text-2xl">
            {formatMoney(due, totals[0]?.[0] ?? "INR")}
            <span className="ml-2 text-sm text-muted-foreground">still to send</span>
          </p>
        ) : null}
        {outfitsCovered.data !== false ? (
          <p className="mt-3 rounded-md bg-secondary/60 p-3 text-sm">
            Your hosts are covering the outfits — there's nothing for you to pay towards what you
            wear.
          </p>
        ) : null}
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing to pay — your hosts haven't set any charges for you.
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-2 text-sm">
              {lines.map((l, idx) => (
                <li key={`${l.label}-${idx}`} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {l.label}
                    {l.detail ? (
                      <span className="ml-2 text-xs text-muted-foreground">{l.detail}</span>
                    ) : null}
                  </span>
                  <span>{formatMoney(l.amount, l.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {totals.map(([cur, total]) => (
                <Badge key={cur}>{formatMoney(total, cur)} in total</Badge>
              ))}
              {settled > 0 ? (
                <Badge variant="secondary">
                  {formatMoney(settled, totals[0]?.[0] ?? "INR")} confirmed
                </Badge>
              ) : null}
              {awaiting > 0 ? (
                <Badge variant="outline">
                  {formatMoney(awaiting, totals[0]?.[0] ?? "INR")} awaiting your hosts
                </Badge>
              ) : null}
              {due > 0 ? (
                <Badge variant="outline">
                  {formatMoney(due, totals[0]?.[0] ?? "INR")} still to send
                </Badge>
              ) : null}
            </div>
          </>
        )}
      </section>

      {lines.length > 0 ? (
        <>
          <section className="panel mt-8 p-4 sm:p-6">
            <h2 className="text-xl">How to pay</h2>
            {howToPay.data ? (
              <p className="mt-3 text-sm whitespace-pre-line">{howToPay.data}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Your hosts will be in touch with the payment details.
              </p>
            )}
            <div className="mt-4">
              <Button variant="outline" disabled>
                <CreditCard className="size-4" /> Pay by card
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Card payment is coming soon — for now pay your hosts directly and note it below.
              </p>
            </div>
          </section>

          <section className="panel mt-8 p-4 sm:p-6">
            <h2 className="text-xl">Tell us what you've sent</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pay-amount">Amount sent</Label>
                <Input
                  id="pay-amount"
                  inputMode="decimal"
                  placeholder="5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-currency">Currency</Label>
                <select
                  id="pay-currency"
                  className="field-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-method">How you paid</Label>
                <select
                  id="pay-method"
                  className="field-select"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-ref">Reference (optional)</Label>
                <Input
                  id="pay-ref"
                  maxLength={80}
                  placeholder="Transfer number or name on the payment"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>
            <Button className="mt-4" disabled={busy} onClick={record}>
              {busy ? "Saving…" : "I've sent this"}
            </Button>
          </section>
        </>
      ) : null}

      {(payments.data ?? []).length > 0 ? (
        <section className="panel mt-8 p-4 sm:p-6">
          <h2 className="text-xl">Your payments</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {(payments.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  {formatMoney(Number(p.amount_paid ?? 0), p.currency)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.method ?? ""}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                </span>
                {p.confirmed_at ? (
                  <Badge>
                    <BadgeCheck className="size-3" /> Confirmed
                  </Badge>
                ) : (
                  <Badge variant="secondary">With your hosts</Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
