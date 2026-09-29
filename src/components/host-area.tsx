import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { hostSplat, parseHostPath, HOST_SUB_LABELS } from "@/lib/host-url";
import { useFeatures } from "@/lib/features";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Pencil, Pin, Trash2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { claimHostAccess } from "@/lib/guest-access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { HostByBoutique } from "@/components/host-by-boutique";
import { HostImport } from "@/components/host-import";
import { HostEvents } from "@/components/host-events";
import { HostInvites, useInvites } from "@/components/host-invites";
import { HostFunctionAccess } from "@/components/host-function-access";
import { HostGuestList } from "@/components/host-guest-list";
import { HostRegistered } from "@/components/host-registered";
import { HostTags } from "@/components/host-tags";
import { HostPicks } from "@/components/host-picks";
import { HostFeeds } from "@/components/host-feeds";
import { HostOrders } from "@/components/host-orders";
import { HostTravel } from "@/components/host-travel";
import { HostArrivals } from "@/components/host-arrivals";

import { HostRelations } from "@/components/host-relations";
import { HostWorkload } from "@/components/host-workload";
import { HostOverview } from "@/components/host-overview";
import { HostGuestTracker } from "@/components/host-guest-tracker";
import { HostLogistics } from "@/components/host-logistics";
import { HostRooms } from "@/components/host-rooms";
import { HostTeam } from "@/components/host-team";
import { HostEmail } from "@/components/host-email";
import { HostContent } from "@/components/host-content";
import { HostBoutiques } from "@/components/host-boutiques";
import { HostVendors } from "@/components/host-vendors";
import { HostFees } from "@/components/host-fees";
import { SelectedEventProvider, useSelectedEvent } from "@/lib/selected-event";
import { HostBudget } from "@/components/host-budget";
import { HostRsvp } from "@/components/host-rsvp";
import { HostMessages } from "@/components/host-messages";
import { HostBroadcast } from "@/components/host-broadcast";




const outfitSchema = z.object({
  title: z.string().trim().min(2, "Give the outfit a name").max(120),
  designer: z.string().trim().max(120).optional(),
  boutique_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//.test(v), "Link must start with http:// or https://")
    .optional(),
  image_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^https?:\/\//.test(v) || v.startsWith("/"),
      "Image link must start with http(s):// ",
    )
    .optional(),
  color_family: z.string().trim().max(60).optional(),
  garment_type: z.string().trim().max(60).optional(),
  size_note: z.string().trim().max(60).optional(),
  price_note: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(600).optional(),
});

type OutfitForm = {
  title: string;
  designer: string;
  boutique_url: string;
  image_url: string;
  color_family: string;
  garment_type: string;
  size_note: string;
  price_note: string;
  notes: string;
  gender: string;
  event_id: string;
  boutique_id: string;
};

const emptyOutfit: OutfitForm = {
  title: "",
  designer: "",
  boutique_url: "",
  image_url: "",
  color_family: "",
  garment_type: "",
  size_note: "",
  price_note: "",
  notes: "",
  gender: "women",
  event_id: "",
  boutique_id: "",
};

function HostPage() {
  const queryClient = useQueryClient();
  const claimHost = useServerFn(claimHostAccess);

  const role = useQuery({
    queryKey: ["host-area-access"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const [host, admin] = await Promise.all([
        supabase.rpc("is_any_host"),
        supabase.rpc("is_platform_admin"),
      ]);
      if (host.data === true || admin.data === true) return true;
      // Approved to create a celebration: let them in to set up their first one.
      const { data: canCreate } = await supabase.rpc("can_create_celebration");
      return canCreate === true;
    },
  });

  if (role.isLoading) {
    return <p className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!role.data) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <div className="panel p-4 sm:p-6">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="mt-4 text-2xl">Host access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is for the hosting family. If you're the host and no one has claimed host
            access yet, you can claim it now.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={async () => {
              let result;
              try {
                result = await claimHost();
              } catch {
                toast.error("We couldn't claim host access. Please try again.");
                return;
              }
              if (!result.ok) {
                toast.error(result.error ?? "Host access is already claimed");
                return;
              }
              toast.success("You're the host now.");
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["host-area-access"] }),
                queryClient.invalidateQueries({ queryKey: ["is-any-host"] }),
              ]);
            }}
          >
            Claim host access
          </Button>
        </div>
      </main>
    );
  }

  return <HostDashboard />;
}

const TAB_TITLES: Record<string, string> = {
  overview: "Overview",
  invitations: "Your celebration",
  functions: "Events",
  guests: "Guests",
  wardrobe: "Wardrobe",
  setup: "Setup",
};

function HostDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { _splat } = useParams({ strict: false }) as { _splat?: string };
  const { section: tab, sub } = parseHostPath(_splat);
  const go = (section: string, subTab?: string | null) =>
    navigate({ to: "/host/$", params: { _splat: hostSplat(section, subTab) } });
  const tabTitle = TAB_TITLES[tab] ?? "Run the celebration";
  const { has, isPlatformAdmin } = useFeatures();
  const [form, setForm] = useState<OutfitForm>({ ...emptyOutfit });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  const { inviteId: selectedEvent } = useSelectedEvent();
  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, dress_code, sort_order, invite_id")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["outfits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const boutiques = useQuery({
    queryKey: ["boutiques"],
    queryFn: async () => {
      const { data, error } = await supabase.from("boutiques").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });



  const reservations = useQuery({
    queryKey: ["reservations", selectedEvent],
    queryFn: async () => {
      let q = supabase.from("reservations").select("id, outfit_id, guest_id, guest_name, created_at");
      if (selectedEvent) q = q.eq("invite_id", selectedEvent);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, rsvp_status");
      if (error) throw error;
      return data;
    },
  });

  const invites = useQuery({
    queryKey: ["invites", selectedEvent],
    queryFn: async () => {
      let q = supabase.from("invite_codes").select("id, code, guest_name, email, claimed_by");
      if (selectedEvent) q = q.eq("invite_id", selectedEvent);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const measurements = useQuery({
    queryKey: ["all-measurements", selectedEvent],
    queryFn: async () => {
      let q = supabase.from("measurements").select("*");
      if (selectedEvent) q = q.eq("invite_id", selectedEvent);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const guestName = (guestId: string, forName: string | null) => {
    const by =
      profiles.data?.find((p) => p.id === guestId)?.full_name ||
      invites.data?.find((i) => i.claimed_by === guestId)?.guest_name ||
      null;
    const who = (forName ?? "").trim();
    if (who && by && who.toLowerCase() !== by.trim().toLowerCase()) return `${who} (by ${by})`;
    return who || by || "Guest";
  };

  /** Only the events and looks that belong to the celebration being worked on. */
  const eventList = useMemo(
    () =>
      (events.data ?? []).filter(
        (e) => !selectedEvent || !e.invite_id || e.invite_id === selectedEvent,
      ),
    [events.data, selectedEvent],
  );
  const allowedEventIds = useMemo(() => new Set(eventList.map((e) => e.id)), [eventList]);
  const outfitList = useMemo(
    () => (outfits.data ?? []).filter((o) => !o.event_id || allowedEventIds.has(o.event_id)),
    [outfits.data, allowedEventIds],
  );

  const [fq, setFq] = useState("");
  const [fEvent, setFEvent] = useState("all");
  const [fGender, setFGender] = useState("all");
  const [fType, setFType] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fSort, setFSort] = useState("pinned");
  const [bulkType, setBulkType] = useState("");
  const reservedIds = useMemo(
    () => new Set((reservations.data ?? []).map((r) => r.outfit_id)),
    [reservations.data],
  );
  // One check per filter; `skip` leaves one out so each dropdown only offers choices that still match the rest.
  const matchesFilters = (o: (typeof outfitList)[number], skip?: "event" | "gender" | "type" | "status") => {
    const q = fq.trim().toLowerCase();
    if (q) {
      const hay = `${o.title} ${o.designer ?? ""} ${o.source_sku ?? ""} ${o.boutique_url ?? ""}`.toLowerCase();
      const link = q.startsWith("http") ? (q.split(/[?#]/)[0] ?? q).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : q;
      if (!hay.includes(link)) return false;
    }
    if (skip !== "event" && fEvent !== "all" && (o.event_id ?? "none") !== fEvent) return false;
    if (skip !== "gender" && fGender !== "all" && o.gender !== fGender) return false;
    if (skip !== "type" && fType !== "all" && (o.garment_type ?? "") !== fType) return false;
    if (skip !== "status") {
      if (fStatus === "reserved" && !reservedIds.has(o.id)) return false;
      if (fStatus === "pinned" && !o.is_pinned) return false;
      if (fStatus === "available" && reservedIds.has(o.id)) return false;
    }
    return true;
  };
  const typeOptions = useMemo(
    () =>
      Array.from(new Set(outfitList.map((o) => o.garment_type).filter(Boolean) as string[])).sort(),
    [outfitList],
  );
  const facets = useMemo(() => {
    const ev = new Set<string>(), gen = new Set<string>(), typ = new Set<string>();
    let avail = 0, res = 0, pin = 0;
    for (const o of outfitList) {
      if (matchesFilters(o, "event")) ev.add(o.event_id ?? "none");
      if (matchesFilters(o, "gender") && o.gender) gen.add(o.gender);
      if (matchesFilters(o, "type") && o.garment_type) typ.add(o.garment_type);
      if (matchesFilters(o, "status")) {
        if (reservedIds.has(o.id)) res++; else avail++;
        if (o.is_pinned) pin++;
      }
    }
    return { ev, gen, typ: Array.from(typ).sort(), avail, res, pin };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfitList, fq, fEvent, fGender, fType, fStatus, reservedIds]);
  const shownList = useMemo(() => {
    const filtered = outfitList.filter((o) => matchesFilters(o));
    const price = (o: (typeof outfitList)[number]) => (o.price_inr != null ? Number(o.price_inr) : null);
    const byPrice = (dir: 1 | -1) => (a: (typeof outfitList)[number], b: (typeof outfitList)[number]) => {
      const pa = price(a), pb = price(b);
      if (pa == null) return pb == null ? 0 : 1;
      if (pb == null) return -1;
      return (pa - pb) * dir;
    };
    const sorted = [...filtered];
    if (fSort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (fSort === "newest") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else if (fSort === "oldest") sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (fSort === "price_low") sorted.sort(byPrice(1));
    else if (fSort === "price_high") sorted.sort(byPrice(-1));
    else sorted.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfitList, fq, fEvent, fGender, fType, fStatus, fSort, reservedIds]);

  const eventName = (id: string | null) =>
    eventList.find((e) => e.id === id)?.name ?? "No event";

  const reservedRows = useMemo(
    () =>
      (reservations.data ?? []).map((r) => {
        const outfit = outfits.data?.find((o) => o.id === r.outfit_id);
        return {
          id: r.id,
          guest: guestName(r.guest_id, r.guest_name),
          guestId: r.guest_id,
          outfit: outfit?.title ?? "Outfit",
          image: outfit?.image_url ?? null,
          size: outfit?.size_note ?? "Made to measure",
          event: eventName(outfit?.event_id ?? null),
          measured: Boolean(measurements.data?.some((m) => m.guest_id === r.guest_id)),
        };
      }),
    [reservations.data, outfits.data, measurements.data, profiles.data, invites.data, events.data],
  );

  const stats = useMemo(() => {
    const total = outfitList.length;
    const reserved = (reservations.data ?? []).length;
    const measured = new Set((measurements.data ?? []).map((m) => m.guest_id)).size;
    const invited = (invites.data ?? []).length;
    const silent = (invites.data ?? []).filter((i) => !i.claimed_by).length;
    const mine = new Set((invites.data ?? []).map((i) => i.claimed_by).filter(Boolean));
    const awaitingRsvp = (profiles.data ?? []).filter(
      (p) => mine.has(p.id) && p.rsvp_status === "pending",
    ).length;
    return { total, reserved, available: total - reserved, measured, invited, silent, awaitingRsvp };
  }, [outfitList, reservations.data, measurements.data, invites.data, profiles.data]);

  const resetForm = () => {
    setForm({ ...emptyOutfit });
    setEditingId(null);
  };

  const saveOutfit = async () => {
    const parsed = outfitSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const payload = {
      title: parsed.data.title,
      designer: parsed.data.designer || null,
      boutique_url: parsed.data.boutique_url || null,
      image_url: parsed.data.image_url || null,
      color_family: parsed.data.color_family || null,
      garment_type: parsed.data.garment_type || null,
      size_note: parsed.data.size_note || null,
      price_note: parsed.data.price_note || null,
      notes: parsed.data.notes || null,
      gender: form.gender,
      event_id: form.event_id || null,
      boutique_id: form.boutique_id || null,
    };
    const { error } = editingId
      ? await supabase.from("outfits").update(payload).eq("id", editingId)
      : await supabase.from("outfits").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Outfit updated." : "Outfit added to the lookbook.");
    resetForm();
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  const startEdit = (id: string) => {
    const o = outfits.data?.find((row) => row.id === id);
    if (!o) return;
    setEditingId(id);
    setForm({
      title: o.title ?? "",
      designer: o.designer ?? "",
      boutique_url: o.boutique_url ?? "",
      image_url: o.image_url ?? "",
      color_family: o.color_family ?? "",
      garment_type: o.garment_type ?? "",
      size_note: o.size_note ?? "",
      price_note: o.price_note ?? "",
      notes: o.notes ?? "",
      gender: o.gender ?? "women",
      event_id: o.event_id ?? "",
      boutique_id: o.boutique_id ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const bulkAssign = async (
    field: "event_id" | "boutique_id" | "gender" | "garment_type",
    value: string,
  ) => {
    if (selected.length === 0) return;
    setBulkBusy(true);
    const next = value === "none" || value === "" ? null : value;
    const patch =
      field === "event_id"
        ? { event_id: next }
        : field === "boutique_id"
          ? { boutique_id: next }
          : field === "gender"
            ? { gender: value }
            : { garment_type: next };
    const { error } = await supabase.from("outfits").update(patch).in("id", selected);

    setBulkBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${selected.length} look${selected.length === 1 ? "" : "s"} updated.`);
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  const setPinned = async (ids: string[], pinned: boolean) => {
    if (ids.length === 0) return;
    setBulkBusy(true);
    const { error } = await supabase.from("outfits").update({ is_pinned: pinned }).in("id", ids);
    setBulkBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(pinned ? "Pinned for guests." : "Unpinned.");
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  const bulkRemove = async () => {
    if (selected.length === 0) return;
    const reservedNames = (reservations.data ?? [])
      .filter((r) => selected.includes(r.outfit_id))
      .map((r) => r.outfit_id);
    if (reservedNames.length > 0) {
      toast.error("Some selected looks are already reserved — unreserve them first.");
      return;
    }
    setBulkBusy(true);
    const { error } = await supabase.from("outfits").delete().in("id", selected);
    setBulkBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${selected.length} look${selected.length === 1 ? "" : "s"} removed.`);
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  const removeOutfit = async (id: string, title: string) => {
    if (!window.confirm(`Remove “${title}” from the lookbook? Any reservation on it is released.`)) {
      return;
    }
    await supabase.from("reservations").delete().eq("outfit_id", id);
    const { error } = await supabase.from("outfits").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (editingId === id) resetForm();
    toast.success("Outfit removed.");
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  const releaseReservation = async (id: string) => {
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reservation released — the look is available again.");
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="min-w-0">
        <p className="text-eyebrow">Host area</p>
        <h1 className="mt-3 truncate text-3xl sm:text-4xl">{tabTitle}</h1>
        <div className="gold-rule mt-6" />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => go(v)}
        className="mt-8"
      >

        <TabsContent value="overview" className="mt-6 space-y-8">

          <HostOverview />
          <HostGuestTracker />

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Outfits" value={stats.total} />
            <Stat label="Reserved" value={stats.reserved} />
            <Stat label="Still available" value={stats.available} />
            <Stat label="Measurements in" value={stats.measured} />
            <Stat label="Not registered" value={stats.silent} />
            <Stat label="No RSVP yet" value={stats.awaitingRsvp} />
          </div>

          <section className="panel p-4 sm:p-6">
            <h2 className="text-xl">Reserved looks ({reservedRows.length})</h2>
            <ul className="mt-4 divide-y divide-border">
              {reservedRows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-4 py-4">
                  {r.image ? (
                    <img
                      src={r.image}
                      referrerPolicy="no-referrer"
                      alt={r.outfit}
                      loading="lazy"
                      width={56}
                      height={75}
                      className="h-[75px] w-14 rounded-md object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="text-primary">{r.guest}</span> — {r.outfit}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.event} · size: {r.size}
                    </p>
                  </div>
                  <Badge variant={r.measured ? "default" : "secondary"}>
                    {r.measured ? "Measurements in" : "Awaiting measurements"}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => releaseReservation(r.id)}>
                    Release
                  </Button>
                </li>
              ))}
              {reservedRows.length === 0 ? (
                <li className="py-4 text-sm text-muted-foreground">No reservations yet.</li>
              ) : null}
            </ul>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-4 sm:p-6">
              <h2 className="text-xl">Measurements submitted</h2>
              <ul className="mt-4 space-y-3">
                {(measurements.data ?? []).map((m) => (
                  <li key={m.id} className="rounded-lg border border-border p-4">
                    <p className="text-sm text-primary">
                      {(m.guest_name ?? "").trim() || guestName(m.guest_id, null)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {(
                        [
                          ["Height", m.height],
                          ["Bust", m.bust],
                          ["Waist", m.waist],
                          ["Hip", m.hip],
                          ["Shoulder", m.shoulder],
                          ["Sleeve", m.sleeve_length],
                          ["Top length", m.top_length],
                          ["Bottom length", m.bottom_length],
                          ["Inseam", m.inseam],
                        ] as const
                      )
                        .filter(([, v]) => v != null)
                        .map(([label, v]) => `${label} ${v}${m.unit}`)
                        .join(" · ") || "No values entered yet"}
                      {m.notes ? ` — ${m.notes}` : ""}
                    </p>
                  </li>
                ))}
                {(measurements.data ?? []).length === 0 ? (
                  <li className="text-sm text-muted-foreground">Nobody has sent measurements yet.</li>
                ) : null}
              </ul>
            </div>

            <div className="panel p-4 sm:p-6">
              <h2 className="text-xl">Waiting on these guests</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Invited but not registered, or registered without a look, measurements or an RSVP.
              </p>
              <ul className="mt-4 divide-y divide-border">
                {(invites.data ?? []).map((inv) => {
                  const profile = inv.claimed_by
                    ? profiles.data?.find((p) => p.id === inv.claimed_by)
                    : undefined;
                  const hasLook = Boolean(
                    inv.claimed_by && reservations.data?.some((r) => r.guest_id === inv.claimed_by),
                  );
                  const hasMeasurements = Boolean(
                    inv.claimed_by && measurements.data?.some((m) => m.guest_id === inv.claimed_by),
                  );
                  const missing = [
                    !inv.claimed_by ? "not registered" : null,
                    inv.claimed_by && (profile?.rsvp_status ?? "pending") === "pending"
                      ? "no RSVP"
                      : null,
                    inv.claimed_by && !hasLook ? "no look reserved" : null,
                    inv.claimed_by && !hasMeasurements ? "no measurements" : null,
                  ].filter(Boolean) as string[];
                  if (missing.length === 0) return null;
                  return (
                    <li key={inv.id} className="py-3">
                      <p className="text-sm">{profile?.full_name || inv.guest_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.code} · {missing.join(", ")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </TabsContent>

        {!has("guest_list") ? null : (
        <TabsContent value="guests" className="mt-6">
          <Tabs value={sub ?? "list"} onValueChange={(v) => go("guests", v)}>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="registered">Registered</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
              <TabsTrigger value="invited">Assign</TabsTrigger>

              <TabsTrigger value="replies">RSVP</TabsTrigger>
              {has("messaging") ? (
                <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
              ) : null}
              {has("rsvp_extended") && has("arrivals") ? (
                <TabsTrigger value="travel">Count</TabsTrigger>
              ) : null}
              {has("arrivals") ? (
                <TabsTrigger value="arrivals">Logistics</TabsTrigger>
              ) : null}
              {has("arrivals") ? (
                <TabsTrigger value="rooms">Rooms</TabsTrigger>
              ) : null}

              {has("guest_communication") ? (
                <TabsTrigger value="hosts">Communication</TabsTrigger>
              ) : null}
              {has("guest_tracker") ? (
                <TabsTrigger value="tracker">Tracker</TabsTrigger>
              ) : null}
            </TabsList>
            <TabsContent value="list" className="mt-6">
              <HostGuestList />
            </TabsContent>
            <TabsContent value="registered" className="mt-6">
              <HostRegistered />
            </TabsContent>
            <TabsContent value="invited" className="mt-6">
              <HostFunctionAccess />
            </TabsContent>
            <TabsContent value="tags" className="mt-6">
              <HostTags />
            </TabsContent>
            <TabsContent value="replies" className="mt-6 space-y-8">
              <HostRsvp />
              {has("messaging") ? <HostMessages /> : null}
            </TabsContent>
            {has("messaging") ? (
              <TabsContent value="broadcast" className="mt-6">
                <HostBroadcast />
              </TabsContent>
            ) : null}
            {has("rsvp_extended") && has("arrivals") ? (
              <TabsContent value="travel" className="mt-6">
                <HostTravel />
              </TabsContent>
            ) : null}
            {has("arrivals") ? (
              <TabsContent value="arrivals" className="mt-6">
                <HostArrivals />
              </TabsContent>
            ) : null}
            {has("arrivals") ? (
              <TabsContent value="rooms" className="mt-6">
                <HostRooms />
              </TabsContent>
            ) : null}

            {has("guest_communication") ? (
              <TabsContent value="hosts" className="mt-6 space-y-8">
                <HostRelations />
              </TabsContent>
            ) : null}
            {has("guest_tracker") ? (
              <TabsContent value="tracker" className="mt-6 space-y-8">
                <HostWorkload />
              </TabsContent>
            ) : null}
          </Tabs>
        </TabsContent>
        )}


        <TabsContent value="invitations" className="mt-6">
          <HostInvites />
        </TabsContent>

        {!has("functions") ? null : (
        <TabsContent value="functions" className="mt-6 space-y-6">
          <div className="panel p-4 sm:p-6">
            <h2 className="text-xl">Four steps</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Create the celebration under the Celebration tab — one per celebration.</li>
              <li>Add its events below.</li>
              <li>Add families under Guests.</li>
              <li>Tick who's invited to what, then send their invitation.</li>
            </ol>
          </div>
          <HostEvents />
        </TabsContent>
        )}

        {!has("wardrobe_picker") ? null : (
        <TabsContent value="wardrobe" className="mt-6">
          <Tabs value={!sub || sub === "import" ? "outfits" : sub} onValueChange={(v) => go("wardrobe", v)}>
            <TabsList className="max-w-full justify-start overflow-x-auto">  
              <TabsTrigger value="outfits">Upload</TabsTrigger>
              <TabsTrigger value="manage">Manage</TabsTrigger>
              <TabsTrigger value="feeds">Live feeds</TabsTrigger>
              <TabsTrigger value="picks">Selection</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              {has("delivery") ? <TabsTrigger value="logistics">Delivery</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="feeds" className="mt-6">
              <HostFeeds />
            </TabsContent>

            <TabsContent value="picks" className="mt-6">
              <HostPicks />
            </TabsContent>

            <TabsContent value="orders" className="mt-6">
              <HostOrders />
            </TabsContent>


        <TabsContent value="outfits" className="mt-6 space-y-8">

          <div className="panel h-fit min-w-0 p-4 sm:p-6">
            <h2 className="text-xl">{editingId ? "Edit outfit" : "Add an outfit"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Copy the image link and product link from Pernia's Pop-Up Shop (or any boutique) and
              paste them here.
            </p>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="o-title">Outfit name</Label>
                <Input
                  id="o-title"
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm((o) => ({ ...o, title: e.target.value }))}
                  placeholder="Emerald zardosi lehenga"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="o-designer">Designer / boutique</Label>
                  <Input
                    id="o-designer"
                    maxLength={120}
                    value={form.designer}
                    onChange={(e) => setForm((o) => ({ ...o, designer: e.target.value }))}
                    placeholder="Anita Dongre"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Event</Label>
                  <Select
                    value={form.event_id}
                    onValueChange={(v) => setForm((o) => ({ ...o, event_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventList.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Boutique / atelier</Label>
                  <Select
                    value={form.boutique_id}
                    onValueChange={(v) => setForm((o) => ({ ...o, boutique_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Who supplies this look?" />
                    </SelectTrigger>
                    <SelectContent>
                      {(boutiques.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Their stylist then sees this look's orders and measurements in the atelier
                    portal.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="o-image">Image link</Label>
                <Input
                  id="o-image"
                  maxLength={500}
                  value={form.image_url}
                  onChange={(e) => setForm((o) => ({ ...o, image_url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-link">Product link</Label>
                <Input
                  id="o-link"
                  maxLength={500}
                  value={form.boutique_url}
                  onChange={(e) => setForm((o) => ({ ...o, boutique_url: e.target.value }))}
                  placeholder="https://www.perniaspopupshop.com/…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="o-color">Colour family</Label>
                  <Input
                    id="o-color"
                    maxLength={60}
                    value={form.color_family}
                    onChange={(e) => setForm((o) => ({ ...o, color_family: e.target.value }))}
                    placeholder="Emerald"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-type">Garment type</Label>
                  <Input
                    id="o-type"
                    maxLength={60}
                    value={form.garment_type}
                    onChange={(e) => setForm((o) => ({ ...o, garment_type: e.target.value }))}
                    placeholder="Lehenga"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="o-size">Size note</Label>
                  <Input
                    id="o-size"
                    maxLength={60}
                    value={form.size_note}
                    onChange={(e) => setForm((o) => ({ ...o, size_note: e.target.value }))}
                    placeholder="Made to measure"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-price">Price guidance</Label>
                  <Input
                    id="o-price"
                    maxLength={60}
                    value={form.price_note}
                    onChange={(e) => setForm((o) => ({ ...o, price_note: e.target.value }))}
                    placeholder="approx. ₹95,000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>For</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm((o) => ({ ...o, gender: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="women">Women</SelectItem>
                    <SelectItem value="men">Men</SelectItem>
                    <SelectItem value="unisex">Anyone</SelectItem>
                    <SelectItem value="boy">Boy</SelectItem>
                    <SelectItem value="girl">Girl</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-notes">Notes for guests</Label>
                <Textarea
                  id="o-notes"
                  rows={3}
                  maxLength={600}
                  value={form.notes}
                  onChange={(e) => setForm((o) => ({ ...o, notes: e.target.value }))}
                  placeholder="Comes with a stitched blouse and matching dupatta."
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={saveOutfit} disabled={busy} className="flex-1">
                  {busy ? "Saving…" : editingId ? "Save changes" : "Add to lookbook"}
                </Button>
                {editingId ? (
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-xl">Add many at once</h2>
            <HostImport />
          </div>
        </TabsContent>

        <TabsContent value="manage" className="mt-6">
          <div className="panel h-fit min-w-0 p-4 sm:p-6">
            <h2 className="text-xl">
              In the lookbook ({shownList.length}
              {shownList.length !== outfitList.length ? ` of ${outfitList.length}` : ""})
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Input
                className="col-span-2 sm:col-span-3"
                placeholder="Search name, designer, code or paste a shop link"
                value={fq}
                onChange={(e) => setFq(e.target.value)}
              />
              <Select value={fEvent} onValueChange={setFEvent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  {facets.ev.has("none") || fEvent === "none" ? <SelectItem value="none">No event</SelectItem> : null}
                  {eventList.filter((e) => facets.ev.has(e.id) || fEvent === e.id).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fGender} onValueChange={setFGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  {[["women", "Women"], ["men", "Men"], ["boy", "Boy"], ["girl", "Girl"], ["unisex", "Unisex"]]
                    .filter(([v]) => facets.gen.has(v) || fGender === v)
                    .map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(fType !== "all" && !facets.typ.includes(fType) ? [fType, ...facets.typ] : facets.typ).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fSort} onValueChange={setFSort}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pinned">Pinned first</SelectItem>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                  <SelectItem value="price_low">Price: low to high</SelectItem>
                  <SelectItem value="price_high">Price: high to low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="available">Available ({facets.avail})</SelectItem>
                  <SelectItem value="reserved">Chosen by a guest ({facets.res})</SelectItem>
                  <SelectItem value="pinned">Pinned ({facets.pin})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                id="select-all-looks"
                checked={
                  shownList.length > 0 && shownList.every((o) => selected.includes(o.id))
                }
                onCheckedChange={(v) =>
                  setSelected(v ? shownList.map((o) => o.id) : [])
                }
              />
              <Label htmlFor="select-all-looks" className="text-xs font-normal">
                Select all shown — then edit or remove several looks at once
              </Label>
            </div>

            {selected.length > 0 ? (
              <div className="mt-3 space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs">
                  {selected.length} selected — apply to all of them:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Select disabled={bulkBusy} onValueChange={(v) => bulkAssign("event_id", v)}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Set event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No event</SelectItem>
                      {eventList.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select disabled={bulkBusy} onValueChange={(v) => bulkAssign("boutique_id", v)}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Set boutique" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No boutique</SelectItem>
                      {(boutiques.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select disabled={bulkBusy} onValueChange={(v) => bulkAssign("gender", v)}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Set who it's for" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="women">Women</SelectItem>
                      <SelectItem value="men">Men</SelectItem>
                      <SelectItem value="boy">Boy</SelectItem>
                      <SelectItem value="girl">Girl</SelectItem>
                      <SelectItem value="unisex">Unisex</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Input
                      className="sm:w-40"
                      list="garment-types"
                      placeholder="Category, e.g. Lehenga"
                      value={bulkType}
                      onChange={(e) => setBulkType(e.target.value)}
                    />
                    <datalist id="garment-types">
                      {typeOptions.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <Button
                      variant="outline"
                      disabled={bulkBusy}
                      onClick={async () => {
                        await bulkAssign("garment_type", bulkType.trim());
                        setBulkType("");
                      }}
                    >
                      Set
                    </Button>
                  </div>
                  <Button variant="outline" disabled={bulkBusy} onClick={() => setPinned(selected, true)}>
                    <Pin className="size-4" /> Pin
                  </Button>
                  <Button variant="outline" disabled={bulkBusy} onClick={() => setPinned(selected, false)}>
                    Unpin
                  </Button>
                  <Button variant="destructive" disabled={bulkBusy} onClick={bulkRemove}>
                    <Trash2 className="size-4" /> Remove selected
                  </Button>
                  <Button variant="ghost" onClick={() => setSelected([])}>
                    Clear
                  </Button>
                </div>
              </div>
            ) : null}

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shownList.map((o) => {
                const res = reservations.data?.find((r) => r.outfit_id === o.id);
                const isSel = selected.includes(o.id);
                return (
                  <li
                    key={o.id}
                    className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card ${isSel ? "border-primary ring-1 ring-primary" : "border-border"}`}
                  >
                    <div className="relative aspect-[3/4] bg-muted">
                      {o.image_url ? (
                        <img
                          src={o.image_url}
                          referrerPolicy="no-referrer"
                          alt={o.title}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : null}
                      <div className="absolute left-2 top-2 rounded bg-background/90 p-1">
                        <Checkbox
                          checked={isSel}
                          aria-label={`Select ${o.title}`}
                          onCheckedChange={() => toggleSelected(o.id)}
                        />
                      </div>
                      <div className="absolute right-2 top-2">
                        {res ? (
                          <Badge variant="secondary" className="max-w-28 truncate">
                            {guestName(res.guest_id, res.guest_name)}
                          </Badge>
                        ) : (
                          <Badge>Available</Badge>
                        )}
                      </div>
                      {o.is_pinned ? (
                        <Pin className="absolute bottom-2 left-2 size-4 fill-current text-primary" />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-2">
                      <p className="line-clamp-2 text-sm">{o.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {eventName(o.event_id)}
                        {o.designer ? ` · ${o.designer}` : ""}
                        {o.garment_type ? ` · ${o.garment_type}` : ""}
                      </p>
                      <p className="text-xs">
                        {o.price_inr != null ? (
                          <span className="font-medium">₹{Number(o.price_inr).toLocaleString("en-IN")}{o.price_note ? ` · ${o.price_note}` : ""}</span>
                        ) : o.price_note ? (
                          <span className="font-medium">{o.price_note}</span>
                        ) : (
                          <span className="text-muted-foreground">No price</span>
                        )}
                        {o.boutique_url ? (
                          <a href={o.boutique_url} target="_blank" rel="noreferrer" className="ml-2 text-primary underline">
                            Shop link
                          </a>
                        ) : null}
                      </p>
                      <div className="mt-auto flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={bulkBusy}
                          aria-label={o.is_pinned ? `Unpin ${o.title}` : `Pin ${o.title}`}
                          onClick={() => setPinned([o.id], !o.is_pinned)}
                        >
                          <Pin className={`size-4 ${o.is_pinned ? "fill-current text-primary" : "text-muted-foreground"}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${o.title}`}
                          onClick={() => { startEdit(o.id); go("wardrobe", "outfits"); }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${o.title}`}
                          onClick={() => removeOutfit(o.id, o.title)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {shownList.length === 0 ? (
                <li className="col-span-full py-4 text-sm text-muted-foreground">
                  {outfitList.length === 0 ? "No outfits added yet." : "No looks match these filters."}
                </li>
              ) : null}
            </ul>
          </div>
        </TabsContent>

            {has("delivery") ? (
              <TabsContent value="logistics" className="mt-6">
                <HostLogistics />
              </TabsContent>
            ) : null}
          </Tabs>
        </TabsContent>
        )}

        <TabsContent value="setup" className="mt-6">
          <Tabs
            value={
              sub ?? (has("vendor_management") ? "boutiques" : has("fees") ? "fees" : "hosts")
            }
            onValueChange={(v) => go("setup", v)}
          >
            <TabsList>
              {has("vendor_management") ? (
                <TabsTrigger value="boutiques">Boutiques</TabsTrigger>
              ) : null}
              {has("vendor_management") ? (
                <TabsTrigger value="vendors">Vendors</TabsTrigger>
              ) : null}
              {has("budgeting") ? <TabsTrigger value="budget">Budget</TabsTrigger> : null}
              {has("fees") ? <TabsTrigger value="fees">Celebration fees</TabsTrigger> : null}
              <TabsTrigger value="hosts">Hosts</TabsTrigger>
              {has("email") ? <TabsTrigger value="email">Email</TabsTrigger> : null}
              {has("branding") ? <TabsTrigger value="look">Wording</TabsTrigger> : null}
            </TabsList>
            {has("vendor_management") ? (
              <TabsContent value="boutiques" className="mt-6 space-y-8">
                <HostBoutiques />
                <HostByBoutique />
              </TabsContent>
            ) : null}
            {has("fees") ? (
              <TabsContent value="fees" className="mt-6">
                <HostFees audience="guest" />
              </TabsContent>
            ) : null}
            {has("vendor_management") ? (
              <TabsContent value="vendors" className="mt-6">
                <HostVendors />
              </TabsContent>
            ) : null}
            {has("budgeting") ? (
              <TabsContent value="budget" className="mt-6">
                <HostBudget />
              </TabsContent>
            ) : null}
            <TabsContent value="hosts" className="mt-6 space-y-6">
              <div className="panel p-4 sm:p-6">
                <h3 className="text-xl">Host dashboard</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every host account with their package, the replies still to come and the outfit
                  slots still open.
                </p>
                <Button asChild variant="outline" className="mt-3">
                  <Link to="/hosts">Open the host dashboard</Link>
                </Button>
              </div>
              <HostTeam />
            </TabsContent>
            {has("email") ? (
              <TabsContent value="email" className="mt-6">
                <HostEmail />
              </TabsContent>
            ) : null}
            {has("branding") ? (
              <TabsContent value="look" className="mt-6 space-y-8">
                <HostContent
                  inviteId={selectedEvent || null}
                  exclude={["Welcome page", "Site-wide"]}
                  intro="Choose a page, then edit its headlines, paragraphs and buttons. Save and your guests see the new wording straight away. The welcome page and the portal name are looked after by the platform owner."
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </TabsContent>
      </Tabs>

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

/** Wraps the host area so every tab works on the same chosen celebration. */
export function HostRoute() {
  return (
    <SelectedEventProvider>
      <HostPage />
    </SelectedEventProvider>
  );
}

