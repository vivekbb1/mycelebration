import { useQuery } from "@tanstack/react-query";
import { Check, Circle, Download } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** "Ready to invite" checklist for the selected celebration. */
export function ReadyToInvite({ inviteId }: { inviteId: string | null | undefined }) {
  const q = useQuery({
    queryKey: ["ready-to-invite", inviteId],
    enabled: !!inviteId,
    queryFn: async () => {
      const id = inviteId!;
      const [inv, ev, fam, sent] = await Promise.all([
        supabase.from("invites").select("branding_preset_id, public_logo_url, slug").eq("id", id).maybeSingle(),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("invite_id", id),
        supabase.from("families").select("id", { count: "exact", head: true }).eq("invite_id", id),
        supabase.from("invite_codes").select("id", { count: "exact", head: true }).eq("invite_id", id).not("invite_sent_at", "is", null),
      ]);
      return [
        { label: "Events added", done: (ev.count ?? 0) > 0, hint: "Setup → Events" },
        { label: "Families added", done: (fam.count ?? 0) > 0, hint: "Guests → Families" },
        { label: "Branding done", done: !!(inv.data?.branding_preset_id || inv.data?.public_logo_url), hint: "Setup → Branding" },
        { label: "Web address set", done: !!inv.data?.slug, hint: "Setup → Celebration" },
        { label: "Test invite sent", done: (sent.count ?? 0) > 0, hint: "Send one to yourself first" },
      ];
    },
  });
  const items = q.data ?? [];
  if (!inviteId || !items.length) return null;
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  return (
    <section className="panel p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl">Ready to invite?</h2>
        <span className="text-sm text-muted-foreground">{done} of {items.length} done</span>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-start gap-2 text-sm">
            {i.done ? <Check className="mt-0.5 size-4 text-primary" /> : <Circle className="mt-0.5 size-4 text-muted-foreground" />}
            <span className={i.done ? "text-muted-foreground line-through" : ""}>
              {i.label}
              {!i.done && <span className="block text-xs text-muted-foreground no-underline">{i.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Prefix text starting with a formula character so spreadsheets treat it as plain text.
const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const MEASURE = ["unit", "height", "bust", "waist", "hip", "shoulder", "sleeve_length", "top_length", "bottom_length", "inseam", "notes"] as const;

/** Spreadsheet downloads for the planner and the tailor. */
export function HostDownloads({ inviteId }: { inviteId: string | null | undefined }) {
  async function build(kind: "planner" | "tailor") {
    if (!inviteId) return;
    const [codes, events, att, res, outfits, meas] = await Promise.all([
      supabase.from("invite_codes").select("guest_name, household, email, phone, rsvp_status, claimed_by, gender").eq("invite_id", inviteId).order("household"),
      supabase.from("events").select("id, name").eq("invite_id", inviteId).order("sort_order"),
      supabase.from("event_attendance").select("household, event_id, attending, guest_count").eq("invite_id", inviteId),
      supabase.from("reservations").select("guest_id, guest_name, status, outfit_id").eq("invite_id", inviteId),
      supabase.from("outfits").select("id, title, designer, event_id").eq("invite_id", inviteId),
      supabase.from("measurements").select("*").eq("invite_id", inviteId),
    ]);
    const err = codes.error || events.error || res.error || outfits.error || meas.error;
    if (err) return void toast.error(err.message);
    const evName = new Map((events.data ?? []).map((e) => [e.id, e.name]));
    const outfit = new Map((outfits.data ?? []).map((o) => [o.id, o]));
    const looksFor = (id: string | null, name: string) =>
      (res.data ?? [])
        .filter((r) => (id && r.guest_id === id) || r.guest_name === name)
        .map((r) => {
          const o = outfit.get(r.outfit_id);
          return `${o?.title ?? "Look"}${o?.designer ? ` (${o.designer})` : ""}${o?.event_id ? ` – ${evName.get(o.event_id) ?? ""}` : ""} [${r.status}]`;
        })
        .join("; ");
    const measFor = (id: string | null, name: string) =>
      (meas.data ?? []).find((m) => (id && m.guest_id === id) || m.guest_name === name);

    const lines: string[] = [];
    if (kind === "planner") {
      const evs = events.data ?? [];
      lines.push(["Family", "Guest", "Email", "Phone", "Reply", ...evs.map((e) => e.name), "Chosen looks", "Measurements sent"].map(esc).join(","));
      for (const c of codes.data ?? []) {
        const perEvent = evs.map((e) => {
          const a = (att.data ?? []).find((x) => x.household === c.household && x.event_id === e.id);
          return a ? (a.attending ? `Yes (${a.guest_count})` : "No") : "";
        });
        lines.push([c.household, c.guest_name, c.email, c.phone, c.rsvp_status, ...perEvent, looksFor(c.claimed_by, c.guest_name), measFor(c.claimed_by, c.guest_name) ? "Yes" : "No"].map(esc).join(","));
      }
    } else {
      lines.push(["Family", "Guest", "Wardrobe", "Chosen looks", ...MEASURE].map(esc).join(","));
      for (const c of codes.data ?? []) {
        const m = measFor(c.claimed_by, c.guest_name) as Record<string, unknown> | undefined;
        lines.push([c.household, c.guest_name, c.gender, looksFor(c.claimed_by, c.guest_name), ...MEASURE.map((k) => m?.[k] ?? "")].map(esc).join(","));
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = kind === "planner" ? "guest-list-for-planner.csv" : "looks-and-measurements-for-tailor.csv";
    a.click();
  }
  if (!inviteId) return null;
  return (
    <section className="panel flex flex-wrap items-center gap-3 p-4 sm:p-6">
      <h2 className="mr-auto text-xl">Downloads</h2>
      <Button variant="outline" onClick={() => build("planner")}>
        <Download className="size-4" /> Guest list for the planner
      </Button>
      <Button variant="outline" onClick={() => build("tailor")}>
        <Download className="size-4" /> Looks & measurements for the tailor
      </Button>
    </section>
  );
}
