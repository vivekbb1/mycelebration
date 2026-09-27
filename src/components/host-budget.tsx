import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useInvites } from "@/components/host-invites";
import { useSelectedEvent } from "@/lib/selected-event";
import { VENDOR_CATEGORIES, vendorCategoryLabel } from "@/components/host-vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CollapsiblePanel } from "@/components/collapsible-panel";

type Draft = {
  label: string;
  category: string;
  invite_id: string;
  event_id: string;
  vendor_id: string;
  planned_amount: string;
  actual_amount: string;
  paid_amount: string;
  due_on: string;
};

const empty: Draft = {
  label: "",
  category: "venue",
  invite_id: "",
  event_id: "",
  vendor_id: "",
  planned_amount: "",
  actual_amount: "",
  paid_amount: "",
  due_on: "",
};

const money = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));
const num = (v: string) => (v.trim() ? Number(v) : null);

/** What the wedding is costing: planned against agreed, and what's been paid. */
export function HostBudget() {
  const qc = useQueryClient();
  const invites = useInvites();
  const { inviteId: selectedEvent } = useSelectedEvent();
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);

  const events = useQuery({
    queryKey: ["budget-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, sort_order, invite_id")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendors = useQuery({
    queryKey: ["budget-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = useQuery({
    queryKey: ["budget-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_items")
        .select(
          "id, label, category, invite_id, event_id, vendor_id, planned_amount, actual_amount, paid_amount, due_on",
        )
        .order("category")
        .order("label");
      if (error) throw error;
      return data ?? [];
    },
  });

  const itemList = useMemo(
    () =>
      (items.data ?? []).filter(
        (i) => !selectedEvent || !i.invite_id || i.invite_id === selectedEvent,
      ),
    [items.data, selectedEvent],
  );

  const totals = useMemo(() => {
    const list = itemList;
    const planned = list.reduce((s, i) => s + Number(i.planned_amount ?? 0), 0);
    const actual = list.reduce(
      (s, i) => s + Number(i.actual_amount ?? i.planned_amount ?? 0),
      0,
    );
    const paid = list.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0);
    return { planned, actual, paid, left: actual - paid };
  }, [itemList]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number; paid: number }>();
    for (const i of itemList) {
      const row = map.get(i.category) ?? { planned: 0, actual: 0, paid: 0 };
      row.planned += Number(i.planned_amount ?? 0);
      row.actual += Number(i.actual_amount ?? i.planned_amount ?? 0);
      row.paid += Number(i.paid_amount ?? 0);
      map.set(i.category, row);
    }
    return [...map.entries()].sort((a, b) => b[1].actual - a[1].actual);
  }, [itemList]);

  const add = async () => {
    const label = draft.label.trim();
    if (!label) return void toast.error("Say what the cost is for.");
    setBusy(true);
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("budget_items").insert({
      label,
      category: draft.category,
      invite_id: draft.invite_id || selectedEvent || null,
      event_id: draft.event_id || null,
      vendor_id: draft.vendor_id || null,
      planned_amount: num(draft.planned_amount) ?? 0,
      actual_amount: num(draft.actual_amount),
      paid_amount: num(draft.paid_amount) ?? 0,
      due_on: draft.due_on || null,
      created_by: me.user?.id ?? null,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setDraft(empty);
    toast.success("Cost added.");
    await qc.invalidateQueries({ queryKey: ["budget-items"] });
  };

  const patch = async (
    id: string,
    values: { actual_amount?: number | null; paid_amount?: number },
  ) => {
    const { error } = await supabase.from("budget_items").update(values).eq("id", id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["budget-items"] });
  };

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Remove “${label}” from the costs?`)) return;
    const { error } = await supabase.from("budget_items").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["budget-items"] });
  };

  const eventName = (id: string | null) =>
    id ? (events.data ?? []).find((e) => e.id === id)?.name ?? "" : "";
  const vendorName = (id: string | null) =>
    id ? (vendors.data ?? []).find((v) => v.id === id)?.name ?? "" : "";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="panel p-4">
          <p className="font-display text-2xl text-primary">{money(totals.planned)}</p>
          <p className="mt-1 text-xs text-muted-foreground">planned</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl text-primary">{money(totals.actual)}</p>
          <p className="mt-1 text-xs text-muted-foreground">agreed or actual</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl text-primary">{money(totals.paid)}</p>
          <p className="mt-1 text-xs text-muted-foreground">paid so far</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl text-primary">{money(totals.left)}</p>
          <p className="mt-1 text-xs text-muted-foreground">still to pay</p>
        </div>
      </div>

      <CollapsiblePanel title="Add a cost" subtitle="One line per thing you're paying for.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cost-label">What it's for</Label>
            <Input
              id="cost-label"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="e.g. Mehendi dinner"
            />
          </div>
          <div>
            <Label htmlFor="cost-category">Kind of cost</Label>
            <select
              id="cost-category"
              className="field-select w-full"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {VENDOR_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cost-invite">Which celebration</Label>
            <select
              id="cost-invite"
              className="field-select w-full"
              value={draft.invite_id}
              onChange={(e) => setDraft({ ...draft, invite_id: e.target.value })}
            >
              <option value="">All celebrations</option>
              {(invites.data ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cost-function">Which event</Label>
            <select
              id="cost-function"
              className="field-select w-full"
              value={draft.event_id}
              onChange={(e) => setDraft({ ...draft, event_id: e.target.value })}
            >
              <option value="">Not tied to one</option>
              {(events.data ?? [])
                .filter((e) => !(draft.invite_id || selectedEvent) || e.invite_id === (draft.invite_id || selectedEvent))
                .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cost-vendor">Vendor</Label>
            <select
              id="cost-vendor"
              className="field-select w-full"
              value={draft.vendor_id}
              onChange={(e) => setDraft({ ...draft, vendor_id: e.target.value })}
            >
              <option value="">Nobody yet</option>
              {(vendors.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cost-due">Due on</Label>
            <Input
              id="cost-due"
              type="date"
              value={draft.due_on}
              onChange={(e) => setDraft({ ...draft, due_on: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="cost-planned">Planned</Label>
            <Input
              id="cost-planned"
              inputMode="decimal"
              value={draft.planned_amount}
              onChange={(e) => setDraft({ ...draft, planned_amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="cost-actual">Agreed or actual</Label>
            <Input
              id="cost-actual"
              inputMode="decimal"
              value={draft.actual_amount}
              onChange={(e) => setDraft({ ...draft, actual_amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="cost-paid">Paid so far</Label>
            <Input
              id="cost-paid"
              inputMode="decimal"
              value={draft.paid_amount}
              onChange={(e) => setDraft({ ...draft, paid_amount: e.target.value })}
            />
          </div>
        </div>
        <Button type="button" className="mt-4" disabled={busy} onClick={() => void add()}>
          <Plus className="mr-1 size-4" /> Save cost
        </Button>
      </CollapsiblePanel>

      <div className="panel p-4 sm:p-6">
        <h3 className="text-xl">Where the money goes</h3>
        <ul className="mt-4 space-y-3">
          {byCategory.map(([key, row]) => {
            const share = totals.actual > 0 ? Math.round((row.actual / totals.actual) * 100) : 0;
            return (
              <li key={key}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{vendorCategoryLabel(key)}</span>
                  <span className="text-xs text-muted-foreground">
                    {money(row.actual)} · paid {money(row.paid)} · {share}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-border">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${share}%` }}
                    aria-hidden
                  />
                </div>
              </li>
            );
          })}
          {byCategory.length === 0 ? (
            <li className="text-sm text-muted-foreground">Nothing added yet.</li>
          ) : null}
        </ul>
      </div>

      <div className="panel p-4 sm:p-6">
        <h3 className="text-xl">Every cost ({itemList.length})</h3>
        <ul className="mt-4 divide-y divide-border">
          {itemList.map((i) => (
            <li key={i.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{i.label}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{vendorCategoryLabel(i.category)}</Badge>
                    {eventName(i.event_id) ? <span>{eventName(i.event_id)}</span> : null}
                    {vendorName(i.vendor_id) ? <span>{vendorName(i.vendor_id)}</span> : null}
                    {i.due_on ? <span>due {i.due_on}</span> : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    defaultValue={i.actual_amount ?? i.planned_amount ?? ""}
                    aria-label={`Agreed amount for ${i.label}`}
                    inputMode="decimal"
                    className="w-full sm:w-28"
                    onBlur={(e) => void patch(i.id, { actual_amount: num(e.target.value) })}
                  />
                  <Input
                    defaultValue={i.paid_amount ?? ""}
                    aria-label={`Paid so far for ${i.label}`}
                    inputMode="decimal"
                    className="w-full sm:w-28"
                    onBlur={(e) => void patch(i.id, { paid_amount: num(e.target.value) ?? 0 })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${i.label}`}
                    onClick={() => void remove(i.id, i.label)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
          {itemList.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">No costs yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
