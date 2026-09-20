import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { feeLinesFor, formatMoney, totalByCurrency, type FeeRule } from "@/lib/fees";

/** Shows a guest what their family owes for the celebration, and what's been paid. */
export function GuestFees() {
  const me = useQuery({
    queryKey: ["my-household"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("household")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.household ?? null;
    },
  });

  const rules = useQuery({
    queryKey: ["my-fees"],
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
    queryKey: ["my-fee-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const attendance = useQuery({
    queryKey: ["my-fee-attendance"],
    enabled: !!me.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("event_id, attending, guest_count")
        .eq("household", me.data as string);
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["my-fee-people"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("household_members");
      if (error) throw error;
      return data ?? [];
    },
  });

  const paid = useQuery({
    queryKey: ["my-fee-payments"],
    enabled: !!me.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("currency, amount_paid")
        .eq("payer_kind", "guest")
        .eq("household", me.data as string);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lines = useMemo(() => {
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
  }, [rules.data, events.data, attendance.data, people.data]);

  const totals = totalByCurrency(lines);
  const received = (paid.data ?? []).reduce((s, p) => s + Number(p.amount_paid ?? 0), 0);

  if (lines.length === 0) return null;

  return (
    <section className="panel mt-8 p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <Wallet className="size-5 text-primary" /> What's payable
      </h2>
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
        {totals.map(([currency, amount]) => (
          <Badge key={currency}>{formatMoney(amount, currency)} in total</Badge>
        ))}
        {received > 0 ? <Badge variant="secondary">{formatMoney(received, totals[0]?.[0] ?? "INR")} received</Badge> : null}
      </div>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/pay">How to pay this</Link>
      </Button>
    </section>
  );
}
