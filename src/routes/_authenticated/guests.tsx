import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, Trash2, Search, Mail, Eye } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { sendInviteEmail } from "@/lib/invite-email.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/_authenticated/guests")({
  head: () => ({
    meta: [
      { title: "Guest List — The Wedding Wardrobe" },
      {
        name: "description",
        content:
          "Invite guests by name and track who registered, who reserved a look, who sent measurements and who hasn't answered.",
      },
      { property: "og:title", content: "Guest List — The Wedding Wardrobe" },
      {
        property: "og:description",
        content: "Invitations, reservations, measurements and RSVPs for every wedding guest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuestListPage,
});

const inviteSchema = z.object({
  guest_name: z.string().trim().min(2, "Enter the guest's name").max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address"),
});

function makeCode(name: string) {
  const base =
    name
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .slice(0, 8) || "GUEST";
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function GuestListPage() {
  const queryClient = useQueryClient();
  const emailInvite = useServerFn(sendInviteEmail);
  const [form, setForm] = useState({ guest_name: "", email: "" });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);


  const role = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return Boolean(data);
    },
  });

  const invites = useQuery({
    queryKey: ["invites"],
    enabled: role.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, code, guest_name, email, claimed_by, claimed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ["all-profiles"],
    enabled: role.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, city, country, whatsapp, rsvp_status, rsvp_note");
      if (error) throw error;
      return data;
    },
  });

  const reservations = useQuery({
    queryKey: ["reservations"],
    enabled: role.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, outfit_id, guest_id, guest_name, created_at");
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["outfits"],
    enabled: role.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("id, title, event_id, size_note")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const measurements = useQuery({
    queryKey: ["all-measurements"],
    enabled: role.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("measurements").select("guest_id, unit, updated_at");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const outfitTitle = (id: string) => outfits.data?.find((o) => o.id === id)?.title ?? "Outfit";
    const list = (invites.data ?? []).map((inv) => {
      const profile = inv.claimed_by
        ? profiles.data?.find((p) => p.id === inv.claimed_by)
        : undefined;
      const guestId = inv.claimed_by;
      const looks = guestId
        ? (reservations.data ?? []).filter((r) => r.guest_id === guestId).map((r) => outfitTitle(r.outfit_id))
        : [];
      return {
        key: inv.id,
        guestId: guestId ?? null,
        code: inv.code,

        name: profile?.full_name || inv.guest_name,
        email: profile?.email || inv.email,
        location: [profile?.city, profile?.country].filter(Boolean).join(", "),
        registered: Boolean(inv.claimed_by),
        rsvp: profile?.rsvp_status ?? "pending",
        rsvpNote: profile?.rsvp_note ?? null,
        looks,
        measured: guestId ? Boolean(measurements.data?.some((m) => m.guest_id === guestId)) : false,
      };
    });
    const q = filter.trim().toLowerCase();
    return q
      ? list.filter((r) =>
          [r.name, r.email, r.code, ...r.looks].filter(Boolean).join(" ").toLowerCase().includes(q),
        )
      : list;
  }, [invites.data, profiles.data, reservations.data, outfits.data, measurements.data, filter]);

  const stats = useMemo(() => {
    const all = (invites.data ?? []).length;
    const registered = (invites.data ?? []).filter((i) => i.claimed_by).length;
    const reserved = new Set((reservations.data ?? []).map((r) => r.guest_id)).size;
    const measured = new Set((measurements.data ?? []).map((m) => m.guest_id)).size;
    const attending = (profiles.data ?? []).filter((p) => p.rsvp_status === "yes").length;
    return { all, registered, reserved, measured, attending, silent: all - registered };
  }, [invites.data, reservations.data, measurements.data, profiles.data]);

  const addInvite = async () => {
    const parsed = inviteSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const code = makeCode(parsed.data.guest_name);
    const { error } = await supabase.from("invite_codes").insert({
      code,
      guest_name: parsed.data.guest_name,
      email: parsed.data.email || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Invitation created for ${parsed.data.guest_name} (${code}).`);
    setForm({ guest_name: "", email: "" });
    await queryClient.invalidateQueries({ queryKey: ["invites"] });
  };

  const copyInvite = async (code: string, guestName: string) => {
    const link = `${window.location.origin}/auth?code=${encodeURIComponent(code)}`;
    const message = `Hi ${guestName}! As our gift, we've put together a wardrobe of festive Indian outfits for the wedding. Open your invitation, pick your look and send your measurements: ${link} (your code: ${code})`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Invitation message copied — paste it into WhatsApp or email.");
    } catch {
      toast.error(`Couldn't copy. Your invite link is: ${link}`);
    }
  };

  const mailInvite = async (id: string, name: string, email: string | null) => {
    if (!email) {
      toast.error(`Add an email address for ${name} first, or copy the message instead.`);
      return;
    }
    setSendingId(id);
    let result: { sent: boolean; reason?: string };
    try {
      result = await emailInvite({ data: { inviteId: id } });
    } catch {
      setSendingId(null);
      toast.error("We couldn't send that invitation. Please try again.");
      return;
    }
    setSendingId(null);
    if (result.sent) {
      toast.success(`Invitation emailed to ${email}.`);
      return;
    }
    toast.error(
      result.reason === "email_not_configured"
        ? "Email sending isn't set up yet — copy the invitation message instead."
        : "That invitation couldn't be sent. Copy the message instead.",
    );
  };


  const removeInvite = async (id: string, registered: boolean) => {
    if (registered) {
      toast.error("This guest already registered — their invitation can't be removed.");
      return;
    }
    const { error } = await supabase.from("invite_codes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation removed.");
    await queryClient.invalidateQueries({ queryKey: ["invites"] });
  };

  if (role.isLoading) {
    return <p className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!role.data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6">
          <h1 className="text-2xl">Hosts only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The guest list is visible to the hosting family only.
          </p>
          <Button asChild className="mt-5">
            <Link to="/lookbook">Back to the lookbook</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-eyebrow">Host area</p>
      <h1 className="mt-3 text-4xl">Guest list</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Invite each guest by name, then watch their progress: registered, look reserved,
        measurements in, RSVP answered.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Invited" value={stats.all} />
        <Stat label="Registered" value={stats.registered} />
        <Stat label="Attending" value={stats.attending} />
        <Stat label="Reserved a look" value={stats.reserved} />
        <Stat label="Measurements in" value={stats.measured} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="panel h-fit p-6">
          <h2 className="text-xl">Invite a guest</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Each guest gets their own code and link — that's how reservations stay tied to a name.
          </p>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="g-name">Guest name</Label>
              <Input
                id="g-name"
                maxLength={100}
                value={form.guest_name}
                placeholder="Emma Whitfield"
                onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-email">Email (optional)</Label>
              <Input
                id="g-email"
                maxLength={255}
                value={form.email}
                placeholder="emma@example.com"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <Button className="w-full" disabled={busy} onClick={addInvite}>
              {busy ? "Creating…" : "Create invitation"}
            </Button>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">Guests ({rows.length})</h2>
            <div className="relative">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                className="w-56 pl-9"
                placeholder="Search name, code, look…"
                maxLength={80}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>

          <ul className="mt-4 divide-y divide-border">
            {rows.map((r) => (
              <li key={r.key} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.code}
                      {r.email ? ` · ${r.email}` : ""}
                      {r.location ? ` · ${r.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={sendingId === r.key}
                      aria-label={`Email invitation code to ${r.name}`}
                      onClick={() => mailInvite(r.key, r.name, r.email ?? null)}
                    >
                      <Mail className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Copy invitation for ${r.name}`}
                      onClick={() => copyInvite(r.code, r.name)}
                    >
                      <Copy className="size-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove invitation for ${r.name}`}
                      onClick={() => removeInvite(r.key, r.registered)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant={r.registered ? "default" : "secondary"}>
                    {r.registered ? "Registered" : "Hasn't opened the invite"}
                  </Badge>
                  <Badge
                    variant={
                      r.rsvp === "yes" ? "default" : r.rsvp === "no" ? "outline" : "secondary"
                    }
                  >
                    {r.rsvp === "yes"
                      ? "Attending"
                      : r.rsvp === "no"
                        ? "Can't make it"
                        : "No RSVP yet"}
                  </Badge>
                  <Badge variant={r.looks.length ? "default" : "secondary"}>
                    {r.looks.length
                      ? `${r.looks.length} look${r.looks.length > 1 ? "s" : ""} reserved`
                      : "No look reserved"}
                  </Badge>
                  <Badge variant={r.measured ? "default" : "secondary"}>
                    {r.measured ? "Measurements in" : "No measurements"}
                  </Badge>
                </div>

                {r.looks.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reserved: {r.looks.join(" · ")}
                  </p>
                ) : null}
                {r.rsvpNote ? (
                  <p className="mt-1 text-xs text-muted-foreground italic">“{r.rsvpNote}”</p>
                ) : null}
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="py-4 text-sm text-muted-foreground">
                No guests match — invite someone to get started.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4">
      <p className="font-display text-3xl text-primary">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
