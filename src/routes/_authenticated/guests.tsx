import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Search, Mail, Eye } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { sendInviteEmail } from "@/lib/invite-email.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/components/host-families";
import { useFeatures } from "@/lib/features";
import { HostFamilies } from "@/components/host-families";
import {
  EventPicker,
  SelectedEventProvider,
  matchesSelectedEvent,
  useSelectedEvent,
} from "@/lib/selected-event";


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
  component: GuestListRoute,
});


/** Keeps the guest list on the same chosen celebration as the rest of the host area. */
function GuestListRoute() {
  return (
    <SelectedEventProvider>
      <GuestListPage />
    </SelectedEventProvider>
  );
}

export function GuestListPage() {
  const queryClient = useQueryClient();
  const features = useFeatures();
  const emailInvite = useServerFn(sendInviteEmail);
  const [filter, setFilter] = useState("");
  const { inviteId: selectedEvent } = useSelectedEvent();

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);


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
        .select(
          "id, code, guest_name, email, phone, category, tags, invite_sent_at, claimed_by, claimed_at, household, gender, invite_id",
        )
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
        .select(
          "id, full_name, email, phone, city, country, whatsapp, rsvp_status, rsvp_note, household, gender",
        );
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

  // The days of this celebration, and which households have been assigned to them.
  const events = useQuery({
    queryKey: ["guest-list-events"],
    enabled: role.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, name, invite_id");
      if (error) throw error;
      return data;
    },
  });

  const assignments = useQuery({
    queryKey: ["guest-list-assignments"],
    enabled: role.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_event_invites")
        .select("household, event_id");
      if (error) throw error;
      return data;
    },
  });

  /** Households with at least one day picked for them in this celebration. */
  const assignedHouseholds = useMemo(() => {
    const ids = new Set(
      (events.data ?? [])
        .filter((e) => matchesSelectedEvent(e.invite_id, selectedEvent))
        .map((e) => e.id),
    );
    const set = new Set<string>();
    for (const a of assignments.data ?? []) {
      if (ids.has(a.event_id)) set.add((a.household ?? "").toLowerCase());
    }
    return set;
  }, [events.data, assignments.data, selectedEvent]);

  // Only the guests belonging to the celebration the host is working on.
  const scopedInvites = useMemo(
    () => (invites.data ?? []).filter((i) => matchesSelectedEvent(i.invite_id, selectedEvent)),
    [invites.data, selectedEvent],
  );

  const rows = useMemo(() => {
    const outfitTitle = (id: string) => outfits.data?.find((o) => o.id === id)?.title ?? "Outfit";
    const list = scopedInvites.map((inv) => {
      const profile = inv.claimed_by
        ? profiles.data?.find((p) => p.id === inv.claimed_by)
        : undefined;
      const guestId = inv.claimed_by;
      const looks = guestId
        ? (reservations.data ?? []).filter((r) => r.guest_id === guestId).map((r) => outfitTitle(r.outfit_id))
        : [];
      const household = profile?.household || inv.household || "";
      return {
        key: inv.id,
        guestId: guestId ?? null,
        code: inv.code,
        tags: inv.tags ?? "",
        invitedAt: inv.invite_sent_at ?? null,
        assigned: assignedHouseholds.has((household || inv.guest_name).toLowerCase()),
        name: profile?.full_name || inv.guest_name,
        email: profile?.email || inv.email,
        phone: profile?.phone || inv.phone || "",
        category: inv.category ?? "family",
        location: [profile?.city, profile?.country].filter(Boolean).join(", "),
        registered: Boolean(inv.claimed_by),
        rsvp: profile?.rsvp_status ?? "pending",
        rsvpNote: profile?.rsvp_note ?? null,
        looks,
        household,
        gender: profile?.gender || inv.gender || "",
        measured: guestId ? Boolean(measurements.data?.some((m) => m.guest_id === guestId)) : false,
      };
    });
    list.sort((a, b) =>
      (a.household || "zzzz").localeCompare(b.household || "zzzz") || a.name.localeCompare(b.name),
    );
    const q = filter.trim().toLowerCase();
    return q
      ? list.filter((r) =>
          [
            r.name,
            r.email,
            r.phone,
            r.code,
            r.household,
            r.tags,
            categoryLabel(r.category),
            ...r.looks,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : list;
  }, [
    scopedInvites,
    profiles.data,
    reservations.data,
    outfits.data,
    measurements.data,
    assignedHouseholds,
    filter,
  ]);

  const stats = useMemo(() => {
    const all = scopedInvites.length;
    const registered = scopedInvites.filter((i) => i.claimed_by).length;
    const mine = new Set(scopedInvites.map((i) => i.claimed_by).filter(Boolean) as string[]);
    const reserved = new Set(
      (reservations.data ?? []).filter((r) => mine.has(r.guest_id)).map((r) => r.guest_id),
    ).size;
    const measured = new Set(
      (measurements.data ?? []).filter((m) => mine.has(m.guest_id)).map((m) => m.guest_id),
    ).size;
    const attending = (profiles.data ?? []).filter(
      (p) => p.rsvp_status === "yes" && mine.has(p.id),
    ).length;
    return { all, registered, reserved, measured, attending, silent: all - registered };
  }, [scopedInvites, reservations.data, measurements.data, profiles.data]);


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

  const inviteText = (guestName: string, code: string) => {
    const link = `${window.location.origin}/auth?code=${encodeURIComponent(code)}`;
    return (
      `Hi ${guestName},\n\n` +
      `As our gift, we've put together a wardrobe of festive Indian outfits for the wedding.\n\n` +
      `Open your invitation: ${link}\nYour personal code: ${code}\n\n` +
      `Pick your look and send your measurements — tailoring and delivery are on us. ` +
      `Each outfit can be reserved by one guest only, so do choose early.\n\nWith love,\nThe hosts`
    );
  };

  const openMailApp = (name: string, email: string, code: string) => {
    const subject = `${name}, your outfit invitation for the wedding`;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(inviteText(name, code))}`;
  };

  /** Notes on the guest that their invitation has gone out. */
  const markInvited = async (id: string) => {
    await supabase
      .from("invite_codes")
      .update({ invite_sent_at: new Date().toISOString() })
      .eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["invites"] });
  };

  const mailInvite = async (
    id: string,
    name: string,
    email: string | null,
    code: string,
    assigned: boolean,
  ) => {
    if (!assigned) {
      toast.error(`Choose which days ${name} is invited to first, on the Assign tab.`);
      return;
    }
    if (!email) {
      toast.error(`Add an email address for ${name} first, or copy the message instead.`);
      return;
    }
    setSendingId(id);
    let result: { sent: boolean; reason?: string };
    try {
      result = await emailInvite({ data: { inviteId: id } });
    } catch {
      result = { sent: false, reason: "network_error" };
    }
    setSendingId(null);
    if (result.sent) {
      toast.success(`Invitation emailed to ${email}.`);
      await markInvited(id);
      return;
    }
    // No sender domain yet — hand the ready-made invitation to the host's own mail app.
    openMailApp(name, email, code);
    await markInvited(id);
    toast.message("Opening your mail app with the invitation ready to send.", {
      description: "Set up a sending domain and the portal will send these for you automatically.",
    });
  };

  /** Free-text tags the hosts keep on a guest (table, side of the family, notes). */
  const saveTags = async (id: string, value: string) => {
    const { error } = await supabase
      .from("invite_codes")
      .update({ tags: value.trim() || null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["invites"] });
  };





  const removeInvite = async (id: string, registered: boolean, name: string) => {
    if (registered && confirmRemove !== id) {
      setConfirmRemove(id);
      toast.warning(
        `${name} has already registered. Click remove again to take them off the guest list — anything they chose stays on record.`,
      );
      return;
    }
    setConfirmRemove(null);
    const { error } = await supabase.from("invite_codes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation removed.");
    await queryClient.invalidateQueries({ queryKey: ["invites"] });
  };

  if (role.isLoading) {
    return <p className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!role.data) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <div className="panel p-4 sm:p-6">
          <h1 className="text-2xl">Hosts only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The guest list is visible to the hosting family only.
          </p>
          <Button asChild className="mt-5">
            <Link to="/outfits">Back to the lookbook</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (!features.has("guest_list")) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <div className="panel p-4 sm:p-6">
          <h1 className="text-2xl">Not in your package</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The guest list isn't part of your current package.
          </p>
          <Button asChild className="mt-5" variant="outline">
            <Link to="/host">Back to your celebration</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-eyebrow">Host area</p>
      <h1 className="mt-3 text-4xl">Guest list</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Invite each guest by name, then watch their progress: registered, look reserved,
        measurements in, RSVP answered.
      </p>

      <EventPicker />

      <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Invited" value={stats.all} />
        <Stat label="Registered" value={stats.registered} />
        <Stat label="Attending" value={stats.attending} />
        <Stat label="Reserved a look" value={stats.reserved} />
        <Stat label="Measurements in" value={stats.measured} />
      </div>

      <div className="mt-8">
        <HostFamilies />
      </div>

      <div className="mt-8">
        <div className="panel p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">Everyone invited ({rows.length})</h2>
            <Button variant="ghost" disabled={bulkBusy} onClick={mailEveryone}>
              <Mail className="size-4" /> Email everyone pending
            </Button>
            <div className="relative">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                className="w-full pl-9 sm:w-56"
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
                    <p className="flex flex-wrap items-center gap-2 truncate">
                      {r.name}
                      {r.gender ? (
                        <Badge variant="outline">
                          {r.gender === "men" ? "Menswear" : "Womenswear"}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary">{categoryLabel(r.category)}</Badge>
                    </p>
                    {r.household ? (
                      <p className="truncate text-xs text-primary">{r.household}</p>
                    ) : null}
                    <p className="truncate text-xs text-muted-foreground">
                      {r.code}
                      {r.email ? ` · ${r.email}` : ""}
                      {r.phone ? ` · ${r.phone}` : ""}
                      {r.location ? ` · ${r.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={sendingId === r.key}
                      aria-label={`Email invitation code to ${r.name}`}
                      onClick={() => mailInvite(r.key, r.name, r.email ?? null, r.code)}
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
                    {r.guestId ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        aria-label={`View the portal as ${r.name}`}
                      >
                        <Link to="/guest/$guestId" params={{ guestId: r.guestId }}>
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                    ) : null}



                    <Button
                      variant={confirmRemove === r.key ? "destructive" : "ghost"}
                      size="icon"
                      aria-label={
                        confirmRemove === r.key
                          ? `Confirm removing ${r.name}`
                          : `Remove invitation for ${r.name}`
                      }
                      onClick={() => removeInvite(r.key, r.registered, r.name)}
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
