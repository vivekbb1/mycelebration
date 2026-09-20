import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useInvites } from "@/components/host-invites";
import { useSelectedEvent } from "@/lib/selected-event";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import {
  CURRENCIES,
  feeLinesFor,
  formatMoney,
  totalByCurrency,
  type FeeRule,
} from "@/lib/fees";

type Draft = {
  invite_id: string;
  event_id: string;
  label: string;
  currency: string;
  base_amount: string;
  per_guest_amount: string;
  note: string;
};

const empty: Draft = {
  invite_id: "",
  event_id: "",
  label: "Celebration fee",
  currency: "INR",
  base_amount: "",
  per_guest_amount: "",
  note: "",
};

const num = (v: string) => (v.trim() ? Number(v) : 0);

export function useFeeRules(audience: "guest" | "host") {
  return useQuery({
    queryKey: ["event-fees", audience],
    queryFn: async (): Promise<FeeRule[]> => {
      const { data, error } = await supabase
        .from("event_fees")
        .select(
          "id, invite_id, event_id, audience, label, currency, base_amount, per_guest_amount, note, active",
        )
        .eq("audience", audience)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        base_amount: Number(r.base_amount ?? 0),
        per_guest_amount: Number(r.per_guest_amount ?? 0),
      })) as FeeRule[];
    },
  });
}

/**
 * Lets a host set what guests pay for their celebration — a flat amount, an amount
 * per head, per event or a mix — and keep track of who has paid.
 */
export function HostFees({ audience = "guest" }: { audience?: "guest" | "host" } = {}) {
  const qc = useQueryClient();
  const invites = useInvites();
  const { inviteId: selectedEvent } = useSelectedEvent();
  const rules = useFeeRules(audience);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);

  const feesOn = useQuery({
    queryKey: ["fees-enabled-host", selectedEvent],
    enabled: !!selectedEvent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("fees_enabled")
        .eq("id", selectedEvent as string)
        .maybeSingle();
      if (error) throw error;
      return data?.fees_enabled ?? true;
    },
  });

  const events = useQuery({
    queryKey: ["fee-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, invite_id, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const families = useQuery({
    queryKey: ["fee-families"],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("id, name, invite_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const members = useQuery({
    queryKey: ["fee-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, household, family_id, invite_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const attendance = useQuery({
    queryKey: ["fee-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("household, event_id, attending, guest_count");
      if (error) throw error;
      return data ?? [];
    },
  });

  const payments = useQuery({
    queryKey: ["fee-payments", audience],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_payments")
        .select(
          "id, invite_id, payer_kind, household, currency, amount_due, amount_paid, note, reference, method, paid_at, confirmed_at",
        )
        .eq("payer_kind", audience)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const eventNames = useMemo(
    () => new Map((events.data ?? []).map((e) => [e.id, e.name])),
    [events.data],
  );

  const owing = useMemo(() => {
    const list = families.data ?? [];
    return list
      .filter((family) => !selectedEvent || family.invite_id === selectedEvent)
      .map((family) => {
      const heads = new Map<string, number>();
      for (const a of attendance.data ?? []) {
        if (a.household !== family.name || !a.attending) continue;
        heads.set(a.event_id, Math.max(Number(a.guest_count ?? 1), 1));
      }
      const familyHeads = (members.data ?? []).filter((m) => m.family_id === family.id).length || 1;
      const forThisEvent = (rules.data ?? []).filter((r) => r.invite_id === family.invite_id);
      const lines = feeLinesFor({
        rules: forThisEvent,
        eventNames,
        headsByEvent: heads,
        familyHeads,
      });
      const paid = (payments.data ?? [])
        .filter((p) => p.household === family.name)
        .reduce((s, p) => s + Number(p.amount_paid ?? 0), 0);
      return { family, lines, totals: totalByCurrency(lines), paid };
    });
  }, [families.data, attendance.data, members.data, rules.data, payments.data, eventNames, selectedEvent]);

  const add = async () => {
    if (!draft.invite_id && selectedEvent) draft.invite_id = selectedEvent;
    if (!draft.invite_id) return void toast.error("Choose the celebration this fee belongs to.");
    if (num(draft.base_amount) <= 0 && num(draft.per_guest_amount) <= 0)
      return void toast.error("Set a flat amount, an amount per person, or both.");
    setBusy(true);
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("event_fees").insert({
      invite_id: draft.invite_id,
      event_id: draft.event_id || null,
      audience,
      label: draft.label.trim() || "Celebration fee",
      currency: draft.currency,
      base_amount: num(draft.base_amount),
      per_guest_amount: num(draft.per_guest_amount),
      note: draft.note.trim() || null,
      created_by: me.user?.id ?? null,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setDraft({ ...empty, invite_id: draft.invite_id, currency: draft.currency });
    toast.success("Fee saved.");
    await qc.invalidateQueries({ queryKey: ["event-fees", audience] });
  };

  const patch = async (id: string, values: { active?: boolean; base_amount?: number; per_guest_amount?: number }) => {
    const { error } = await supabase.from("event_fees").update(values).eq("id", id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["event-fees", audience] });
  };

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Remove “${label}”?`)) return;
    const { error } = await supabase.from("event_fees").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["event-fees", audience] });
  };

  const recordPayment = async (
    household: string,
    inviteId: string | null,
    currency: string,
    due: number,
    amount: string,
  ) => {
    const paid = Number(amount);
    if (!Number.isFinite(paid) || paid <= 0) return void toast.error("Enter the amount received.");
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("fee_payments").insert({
      invite_id: inviteId,
      payer_kind: audience,
      household,
      currency,
      amount_due: due,
      amount_paid: paid,
      paid_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      confirmed_by: me.user?.id ?? null,
      created_by: me.user?.id ?? null,
    });
    if (error) return void toast.error(error.message);
    toast.success(`${formatMoney(paid, currency)} noted for ${household}.`);
    await qc.invalidateQueries({ queryKey: ["fee-payments", audience] });
  };

  const confirmPayment = async (id: string) => {
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("fee_payments")
      .update({ confirmed_at: new Date().toISOString(), confirmed_by: me.user?.id ?? null })
      .eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("Marked as received.");
    await qc.invalidateQueries({ queryKey: ["fee-payments", audience] });
  };

  const reported = (payments.data ?? []).filter((p) => !p.confirmed_at);

  const activeInvite = draft.invite_id || selectedEvent;
  const eventsForInvite = (events.data ?? []).filter(
    (e) => !activeInvite || e.invite_id === activeInvite,
  );
  const ruleList = (rules.data ?? []).filter(
    (r) => !selectedEvent || r.invite_id === selectedEvent,
  );

  const collected = useMemo(
    () =>
      totalByCurrency(
        (payments.data ?? []).map((p) => ({
          label: "",
          detail: "",
          currency: p.currency,
          amount: Number(p.amount_paid ?? 0),
        })),
      ),
    [payments.data],
  );

  return (
    <div className="space-y-6">
      {audience === "guest" ? <PayInstructions inviteId={selectedEvent} /> : null}

      {audience === "guest" && feesOn.data === false ? null : (
      <>
      <div className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Wallet className="size-5 text-primary" />
          {audience === "guest" ? "What guests pay" : "What hosts pay you"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {audience === "guest"
            ? "Set a flat amount for the whole celebration, an amount per person, or a separate amount for a single event. Each family's total is worked out from the head counts they gave you."
            : "Set what a host owes you for running their celebration — a flat fee, an amount per guest, or both."}
        </p>
        {collected.length > 0 ? (
          <p className="mt-3 flex flex-wrap gap-2 text-sm">
            {collected.map(([currency, amount]) => (
              <Badge key={currency} variant="secondary">
                {formatMoney(amount, currency)} received
              </Badge>
            ))}
          </p>
        ) : null}
      </div>

      <CollapsiblePanel title="Add a fee" subtitle="One line per charge. Mix and match as you like.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fee-invite">Which celebration</Label>
            <select
              id="fee-invite"
              className="field-select w-full"
              value={draft.invite_id || selectedEvent}
              onChange={(e) => setDraft({ ...draft, invite_id: e.target.value, event_id: "" })}
            >
              <option value="">Choose the celebration…</option>
              {(invites.data ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fee-function">Which event</Label>
            <select
              id="fee-function"
              className="field-select w-full"
              value={draft.event_id}
              onChange={(e) => setDraft({ ...draft, event_id: e.target.value })}
            >
              <option value="">The whole celebration</option>
              {eventsForInvite.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fee-label">What to call it</Label>
            <Input
              id="fee-label"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="e.g. Dinner contribution"
            />
          </div>
          <div>
            <Label htmlFor="fee-currency">Currency</Label>
            <select
              id="fee-currency"
              className="field-select w-full"
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fee-flat">Flat amount</Label>
            <Input
              id="fee-flat"
              inputMode="decimal"
              value={draft.base_amount}
              onChange={(e) => setDraft({ ...draft, base_amount: e.target.value })}
              placeholder="e.g. 5000"
            />
          </div>
          <div>
            <Label htmlFor="fee-head">Amount per person</Label>
            <Input
              id="fee-head"
              inputMode="decimal"
              value={draft.per_guest_amount}
              onChange={(e) => setDraft({ ...draft, per_guest_amount: e.target.value })}
              placeholder="e.g. 1500"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="fee-note">Note for guests</Label>
            <Input
              id="fee-note"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="e.g. Covers the seated dinner and drinks"
            />
          </div>
        </div>
        <Button type="button" className="mt-4" disabled={busy} onClick={() => void add()}>
          <Plus className="mr-1 size-4" /> Save fee
        </Button>
      </CollapsiblePanel>

      <div className="panel p-4 sm:p-6">
        <h3 className="text-xl">Fees in place ({ruleList.length})</h3>
        <ul className="mt-4 divide-y divide-border">
          {ruleList.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-sm">{r.label}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {r.event_id ? (eventNames.get(r.event_id) ?? "One event") : "Whole celebration"}
                  </Badge>
                  {r.base_amount > 0 ? (
                    <span>{formatMoney(r.base_amount, r.currency)} flat</span>
                  ) : null}
                  {r.per_guest_amount > 0 ? (
                    <span>{formatMoney(r.per_guest_amount, r.currency)} per person</span>
                  ) : null}
                  {r.note ? <span>{r.note}</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={r.active}
                    onCheckedChange={(v) => void patch(r.id, { active: v })}
                    aria-label={`Show ${r.label} to guests`}
                  />
                  {r.active ? "Live" : "Off"}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${r.label}`}
                  onClick={() => void remove(r.id, r.label)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
          {ruleList.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">No fees yet — this celebration is free.</li>
          ) : null}
        </ul>
      </div>

      {audience === "guest" ? (
        <div className="panel p-4 sm:p-6">
          <h3 className="text-xl">Who owes what</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Worked out from the head counts each family gave. Note down what you've received.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {owing.map(({ family, lines, totals, paid }) => {
              const currency = totals[0]?.[0] ?? "INR";
              const due = totals.reduce((s, [, amount]) => s + amount, 0);
              const left = due - paid;
              return (
                <li key={family.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm">{family.name}</p>
                      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {lines.map((l, idx) => (
                          <li key={`${l.label}-${idx}`}>
                            {l.label} — {formatMoney(l.amount, l.currency)}
                            {l.detail ? ` (${l.detail})` : ""}
                          </li>
                        ))}
                        {lines.length === 0 ? <li>Nothing to pay.</li> : null}
                      </ul>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={left > 0 ? "outline" : "secondary"}>
                        {left > 0
                          ? `${formatMoney(left, currency)} to come`
                          : due > 0
                            ? "Settled"
                            : "No fee"}
                      </Badge>
                      {due > 0 ? (
                        <Input
                          aria-label={`Amount received from ${family.name}`}
                          inputMode="decimal"
                          placeholder="Amount received"
                          className="w-full sm:w-36"
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            const el = e.currentTarget;
                            void recordPayment(
                              family.name,
                              family.invite_id,
                              currency,
                              due,
                              el.value,
                            ).then(() => {
                              el.value = "";
                            });
                          }}
                          onBlur={(e) => {
                            const el = e.currentTarget;
                            if (!el.value.trim()) return;
                            void recordPayment(
                              family.name,
                              family.invite_id,
                              currency,
                              due,
                              el.value,
                            ).then(() => {
                              el.value = "";
                            });
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
            {owing.length === 0 ? (
              <li className="py-4 text-sm text-muted-foreground">No families yet.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {audience === "guest" ? (
        <>
          <div className="panel p-4 sm:p-6">
            <h3 className="text-xl">Payments guests have told you about</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Guests note down what they've sent on their own charges page. Mark it received once it
              lands with you.
            </p>
            <ul className="mt-4 divide-y divide-border text-sm">
              {reported.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span>
                    {p.household ?? "A family"} — {formatMoney(Number(p.amount_paid ?? 0), p.currency)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.method ?? ""}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => void confirmPayment(p.id)}>
                    Mark received
                  </Button>
                </li>
              ))}
              {reported.length === 0 ? (
                <li className="py-3 text-muted-foreground">Nothing waiting.</li>
              ) : null}
            </ul>
          </div>

        </>
      ) : null}
      </>
      )}
    </div>
  );
}

/** The bank details or wording guests see on their charges page. */
function PayInstructions({ inviteId }: { inviteId: string | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = useQuery({
    queryKey: ["pay-instructions-host", inviteId],
    enabled: !!inviteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("pay_instructions, outfits_paid_by_host, fees_enabled")
        .eq("id", inviteId as string)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const value = text ?? current.data?.pay_instructions ?? "";
  const covered = current.data?.outfits_paid_by_host ?? true;
  const feesOn = current.data?.fees_enabled ?? true;

  const setFeesOn = async (next: boolean) => {
    if (!inviteId) return;
    const { error } = await supabase
      .from("invites")
      .update({ fees_enabled: next })
      .eq("id", inviteId);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["pay-instructions-host", inviteId] });
    await qc.invalidateQueries({ queryKey: ["fees-enabled-host", inviteId] });
    toast.success(
      next ? "Charges are switched on for this celebration." : "Charges are switched off — guests won't be asked for anything.",
    );
  };

  const setCovered = async (next: boolean) => {
    if (!inviteId) return;
    const { error } = await supabase
      .from("invites")
      .update({ outfits_paid_by_host: next })
      .eq("id", inviteId);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["pay-instructions-host", inviteId] });
    toast.success(next ? "You're covering the outfits." : "Guests pay for their own outfits.");
  };

  const save = async () => {
    if (!inviteId) return;
    setBusy(true);
    const { error } = await supabase
      .from("invites")
      .update({ pay_instructions: value.trim() || null })
      .eq("id", inviteId);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Guests will see this on their charges page.");
    await qc.invalidateQueries({ queryKey: ["pay-instructions-host", inviteId] });
  };

  if (!inviteId) return null;

  return (
    <div className="space-y-6">
      <div className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl">Charges for this celebration</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {feesOn
                ? "Charges are on — guests see what's payable and how to pay you."
                : "Charges are off — guests are never asked for money, and nothing payable shows on their pages. Your fee lines are kept for when you turn this back on."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{feesOn ? "On" : "Off"}</span>
            <Switch
              checked={feesOn}
              onCheckedChange={(v) => void setFeesOn(v)}
              aria-label="Charges for this celebration"
            />
          </div>
        </div>
      </div>

      {!feesOn ? null : (
      <>
      <div className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl">Who pays for the outfits</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Leave this on if you're dressing your guests. They'll see that the outfits are covered
              and never get asked to pay for them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{covered ? "We cover them" : "Guests pay"}</span>
            <Switch checked={covered} onCheckedChange={(v) => void setCovered(v)} />
          </div>
        </div>
      </div>

      <div className="panel p-4 sm:p-6">
      <h3 className="text-xl">How guests should pay you</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Bank details, a payment link or simply who to hand the money to. This appears on each
        guest's charges page.
      </p>
      <Textarea
        className="mt-4"
        rows={4}
        maxLength={1200}
        placeholder={"Bank: …\nAccount name: …\nIBAN: …\nPlease put your family name as the reference."}
        value={value}
        onChange={(e) => setText(e.target.value)}
      />
      <Button className="mt-3" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save"}
      </Button>
      </div>
      </>
      )}
    </div>
  );
}
