import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useInvites } from "@/components/host-invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CollapsiblePanel } from "@/components/collapsible-panel";

export const VENDOR_CATEGORIES = [
  { key: "venue", label: "Venue" },
  { key: "catering", label: "Catering" },
  { key: "decor", label: "Décor & flowers" },
  { key: "photo", label: "Photo & film" },
  { key: "music", label: "Music & entertainment" },
  { key: "attire", label: "Attire & tailoring" },
  { key: "beauty", label: "Hair & make-up" },
  { key: "transport", label: "Travel & transport" },
  { key: "stationery", label: "Invitations & stationery" },
  { key: "other", label: "Something else" },
] as const;

export const vendorCategoryLabel = (key: string) =>
  VENDOR_CATEGORIES.find((c) => c.key === key)?.label ?? key;

const STATUSES = [
  { key: "shortlisted", label: "Shortlisted" },
  { key: "in_talks", label: "In talks" },
  { key: "booked", label: "Booked" },
  { key: "paid", label: "Paid in full" },
  { key: "dropped", label: "Not going ahead" },
] as const;

export const vendorStatusLabel = (key: string) =>
  STATUSES.find((s) => s.key === key)?.label ?? key;

type Draft = {
  name: string;
  category: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  city: string;
  website: string;
  status: string;
  agreed_amount: string;
  invite_id: string;
  notes: string;
};

const empty: Draft = {
  name: "",
  category: "venue",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  city: "",
  website: "",
  status: "shortlisted",
  agreed_amount: "",
  invite_id: "",
  notes: "",
};

const money = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));

/** Everyone the hosts are working with for the wedding, and what was agreed. */
export function HostVendors() {
  const qc = useQueryClient();
  const invites = useInvites();
  const [draft, setDraft] = useState<Draft>(empty);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const vendors = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select(
          "id, name, category, contact_name, contact_email, contact_phone, city, website, status, agreed_amount, notes, invite_id",
        )
        .order("category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = vendors.data ?? [];
    if (!q) return list;
    return list.filter((v) =>
      `${v.name} ${v.city ?? ""} ${v.contact_name ?? ""} ${vendorCategoryLabel(v.category)}`
        .toLowerCase()
        .includes(q),
    );
  }, [vendors.data, search]);

  const totals = useMemo(() => {
    const list = vendors.data ?? [];
    return {
      count: list.length,
      booked: list.filter((v) => v.status === "booked" || v.status === "paid").length,
      agreed: list.reduce((sum, v) => sum + Number(v.agreed_amount ?? 0), 0),
    };
  }, [vendors.data]);

  const add = async () => {
    const name = draft.name.trim();
    if (!name) return void toast.error("Give the vendor a name.");
    setBusy(true);
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("vendors").insert({
      name,
      category: draft.category,
      contact_name: draft.contact_name.trim() || null,
      contact_email: draft.contact_email.trim() || null,
      contact_phone: draft.contact_phone.trim() || null,
      city: draft.city.trim() || null,
      website: draft.website.trim() || null,
      status: draft.status,
      agreed_amount: draft.agreed_amount.trim() ? Number(draft.agreed_amount) : null,
      invite_id: draft.invite_id || null,
      notes: draft.notes.trim() || null,
      created_by: me.user?.id ?? null,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setDraft(empty);
    toast.success("Vendor saved.");
    await qc.invalidateQueries({ queryKey: ["vendors"] });
  };

  const patch = async (
    id: string,
    values: { status?: string; agreed_amount?: number | null },
  ) => {
    const { error } = await supabase.from("vendors").update(values).eq("id", id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["vendors"] });
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the vendor list?`)) return;
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("Removed.");
    await qc.invalidateQueries({ queryKey: ["vendors"] });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="font-display text-3xl text-primary">{totals.count}</p>
          <p className="mt-1 text-xs text-muted-foreground">on the list</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-3xl text-primary">{totals.booked}</p>
          <p className="mt-1 text-xs text-muted-foreground">booked</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-3xl text-primary">{money(totals.agreed)}</p>
          <p className="mt-1 text-xs text-muted-foreground">agreed in total</p>
        </div>
      </div>

      <CollapsiblePanel title="Add a vendor" subtitle="Anyone you're booking for the wedding.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Marigold Caterers"
            />
          </div>
          <div>
            <Label htmlFor="vendor-category">What they do</Label>
            <select
              id="vendor-category"
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
            <Label htmlFor="vendor-contact">Who you speak to</Label>
            <Input
              id="vendor-contact"
              value={draft.contact_name}
              onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="vendor-phone">Mobile</Label>
            <Input
              id="vendor-phone"
              value={draft.contact_phone}
              onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="vendor-email">Email</Label>
            <Input
              id="vendor-email"
              value={draft.contact_email}
              onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="vendor-city">City</Label>
            <Input
              id="vendor-city"
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="vendor-status">Where it stands</Label>
            <select
              id="vendor-status"
              className="field-select w-full"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="vendor-amount">Agreed amount</Label>
            <Input
              id="vendor-amount"
              inputMode="decimal"
              value={draft.agreed_amount}
              onChange={(e) => setDraft({ ...draft, agreed_amount: e.target.value })}
              placeholder="e.g. 250000"
            />
          </div>
          <div>
            <Label htmlFor="vendor-invite">Which event</Label>
            <select
              id="vendor-invite"
              className="field-select w-full"
              value={draft.invite_id}
              onChange={(e) => setDraft({ ...draft, invite_id: e.target.value })}
            >
              <option value="">All events</option>
              {(invites.data ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="vendor-web">Website or profile</Label>
            <Input
              id="vendor-web"
              value={draft.website}
              onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea
              id="vendor-notes"
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>
        <Button type="button" className="mt-4" disabled={busy} onClick={() => void add()}>
          <Plus className="mr-1 size-4" /> Save vendor
        </Button>
      </CollapsiblePanel>

      <div className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl">Vendor list ({shown.length})</h3>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a vendor…"
            className="w-full sm:w-56"
          />
        </div>

        <ul className="mt-4 divide-y divide-border">
          {shown.map((v) => (
            <li key={v.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{v.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{vendorCategoryLabel(v.category)}</Badge>
                    {v.city ? <span>{v.city}</span> : null}
                    {v.contact_name ? <span>{v.contact_name}</span> : null}
                    {v.contact_phone ? <span>{v.contact_phone}</span> : null}
                    {v.contact_email ? <span>{v.contact_email}</span> : null}
                  </p>
                  {v.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{v.notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="field-select text-xs sm:w-40"
                    aria-label={`Where things stand with ${v.name}`}
                    value={v.status}
                    onChange={(e) => void patch(v.id, { status: e.target.value })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    defaultValue={v.agreed_amount ?? ""}
                    aria-label={`Agreed amount with ${v.name}`}
                    inputMode="decimal"
                    className="w-full sm:w-32"
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const next = raw ? Number(raw) : null;
                      if (next !== (v.agreed_amount === null ? null : Number(v.agreed_amount)))
                        void patch(v.id, { agreed_amount: next });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${v.name}`}
                    onClick={() => void remove(v.id, v.name)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">No vendors yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
