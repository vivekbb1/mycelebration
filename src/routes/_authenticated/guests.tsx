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
import { Textarea } from "@/components/ui/textarea";
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
  household: z.string().trim().max(120),
  gender: z.enum(["women", "men", ""]),
});

/**
 * A pasted line can say who the person is: "Vivek Bhatia, vivek@x.com, husband"
 * or "(m)" / "(f)". Anything else leaves the choice to the guest.
 */
const MEN_WORDS = ["m", "male", "man", "husband", "son", "boy", "menswear"];
const WOMEN_WORDS = ["f", "female", "woman", "wife", "daughter", "girl", "womenswear"];

function genderFrom(line: string): { gender: "women" | "men" | ""; cleaned: string } {
  // Markers appear as a bracketed hint or the last comma-separated field.
  const bracket = line.match(/\((m|f|male|female|husband|wife)\)/i);
  let rest = line.replace(/\([^)]*\)/g, " ");
  let marker = bracket ? bracket[1].toLowerCase() : "";

  if (!marker) {
    const parts = rest.split(/[,;]/).map((p) => p.trim());
    const last = (parts[parts.length - 1] ?? "").toLowerCase();
    if (parts.length > 1 && (MEN_WORDS.includes(last) || WOMEN_WORDS.includes(last))) {
      marker = last;
      parts.pop();
      rest = parts.join(", ");
    }
  }

  const cleaned = rest.replace(/\s{2,}/g, " ").trim();
  if (MEN_WORDS.includes(marker)) return { gender: "men", cleaned };
  if (WOMEN_WORDS.includes(marker)) return { gender: "women", cleaned };
  return { gender: "", cleaned };
}

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
  const [form, setForm] = useState<{
    guest_name: string;
    email: string;
    household: string;
    gender: "women" | "men" | "";
  }>({ guest_name: "", email: "", household: "", gender: "" });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulk, setBulk] = useState("");
  const [bulkHousehold, setBulkHousehold] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);


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
        .select("id, code, guest_name, email, claimed_by, claimed_at, household, gender")
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
          "id, full_name, email, city, country, whatsapp, rsvp_status, rsvp_note, household, gender",
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
        household: profile?.household || inv.household || "",
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
          [r.name, r.email, r.code, r.household, ...r.looks]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
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
      household: parsed.data.household || null,
      gender: parsed.data.gender || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Invitation created for ${parsed.data.guest_name} (${code}).`);
    setForm((f) => ({ guest_name: "", email: "", household: f.household, gender: "" }));
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

  const mailInvite = async (id: string, name: string, email: string | null, code: string) => {
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
      return;
    }
    // No sender domain yet — hand the ready-made invitation to the host's own mail app.
    openMailApp(name, email, code);
    toast.message("Opening your mail app with the invitation ready to send.", {
      description: "Set up a sending domain and the portal will send these for you automatically.",
    });
  };

  const mailEveryone = async () => {
    const pending = rows.filter((r) => r.email && !r.registered);
    if (pending.length === 0) {
      toast.message("Everyone with an email address has already registered.");
      return;
    }
    setBulkBusy(true);
    let sent = 0;
    for (const r of pending) {
      try {
        const result = await emailInvite({ data: { inviteId: r.key } });
        if (result.sent) sent += 1;
      } catch {
        // ignore and report at the end
      }
    }
    setBulkBusy(false);
    if (sent > 0) {
      toast.success(`Invitation emailed to ${sent} guest${sent === 1 ? "" : "s"}.`);
      return;
    }
    const all = pending
      .map((r) => `${r.name} <${r.email}>\n${inviteText(r.name, r.code)}`)
      .join("\n\n———\n\n");
    try {
      await navigator.clipboard.writeText(all);
      toast.message(`Copied ${pending.length} invitations to your clipboard.`, {
        description:
          "Sending from the portal needs a domain of your own — until then paste these into email or WhatsApp.",
      });
    } catch {
      toast.error("Couldn't send or copy. Use the mail button on each guest instead.");
    }
  };

  const addBulk = async () => {
    const parsedRows = bulk
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((rawLine) => {
        // "Name, email, husband | Bhatia Family" — the family after a pipe is optional.
        const [beforePipe, afterPipe] = rawLine.split("|");
        const household = (afterPipe ?? "").trim() || bulkHousehold.trim();
        const { gender, cleaned } = genderFrom(beforePipe ?? "");
        const emailMatch = cleaned.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/);
        const email = emailMatch ? emailMatch[0] : "";
        const name = cleaned
          .replace(email, "")
          .replace(/[<>]/g, "")
          .replace(/[,;\t]+/g, " ")
          .trim();
        return { name, email, gender, household };
      })
      .filter((r) => r.name.length >= 2);

    if (parsedRows.length === 0) {
      toast.error("Add one guest per line, e.g. Emma Whitfield, emma@example.com");
      return;
    }

    setBulkBusy(true);
    const { error } = await supabase.from("invite_codes").insert(
      parsedRows.map((r) => ({
        code: makeCode(r.name),
        guest_name: r.name,
        email: r.email || null,
      })),
    );
    setBulkBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `${parsedRows.length} invitation${parsedRows.length === 1 ? "" : "s"} created.`,
    );
    setBulk("");
    await queryClient.invalidateQueries({ queryKey: ["invites"] });
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

          <div className="gold-rule my-6" />

          <h2 className="text-xl">Invite in bulk</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            One guest per line — paste straight from a spreadsheet. Name first, email after a comma,
            tab or space. Everyone gets their own code.
          </p>
          <Textarea
            className="mt-3 font-mono text-xs"
            rows={7}
            value={bulk}
            placeholder={"Emma Whitfield, emma@example.com\nDaniel Osei, daniel@example.com\nMarie Lambert"}
            onChange={(e) => setBulk(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={bulkBusy} onClick={addBulk}>
              {bulkBusy ? "Working…" : "Create invitations"}
            </Button>
            <Button variant="ghost" disabled={bulkBusy} onClick={mailEveryone}>
              <Mail className="size-4" /> Email everyone pending
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
