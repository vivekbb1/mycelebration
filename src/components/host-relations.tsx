import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRightLeft,
  BellRing,
  Check,
  Copy,
  HeartHandshake,
  MessageCircle,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { splitTags } from "@/lib/tags";
import { suggestFollowUp, type FollowUpSuggestion } from "@/lib/followup.functions";
import { sendFollowUpReminders } from "@/lib/followup-reminders.functions";

type Guest = {
  id: string;
  guest_name: string;
  household: string | null;
  email: string | null;
  personally_invited: boolean;
  tags: string | null;
};

type Host = { id: string; name: string };

type Note = {
  id: string;
  invite_id: string;
  host_id: string | null;
  channel: string;
  outcome: string;
  notes: string | null;
  follow_up_on: string | null;
  contacted_at: string;
  reminder_sent_at: string | null;
};

type Transfer = {
  id: string;
  invite_id: string;
  from_host: string | null;
  to_host: string;
  reason: string | null;
  effective_on: string;
  applied_at: string | null;
  created_at: string;
};

const CHANNELS = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "in_person", label: "In person" },
];

const OUTCOMES = [
  { value: "reached", label: "Spoke to them" },
  { value: "no_answer", label: "No answer" },
  { value: "left_message", label: "Left a message" },
  { value: "confirmed", label: "Confirmed coming" },
  { value: "declined", label: "Can't come" },
];

const labelOf = (list: { value: string; label: string }[], value: string) =>
  list.find((l) => l.value === value)?.label ?? value;

const prettyDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** Who personally invited each guest, which host looks after them, and how talks are going. */
export function HostRelations() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [hostFilter, setHostFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [advice, setAdvice] = useState<Record<string, FollowUpSuggestion>>({});
  const [openHandover, setOpenHandover] = useState<string | null>(null);
  const [handoverDraft, setHandoverDraft] = useState<{
    to: string;
    reason: string;
    effective: string;
  }>({ to: "", reason: "", effective: new Date().toISOString().slice(0, 10) });
  const [draft, setDraft] = useState<{
    channel: string;
    outcome: string;
    notes: string;
    follow_up_on: string;
  }>({ channel: "call", outcome: "reached", notes: "", follow_up_on: "" });

  const askAi = useServerFn(suggestFollowUp);
  const runReminders = useServerFn(sendFollowUpReminders);

  const me = useQuery({
    queryKey: ["relations-me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const hosts = useQuery({
    queryKey: ["relations-hosts", selectedInviteId],
    enabled: Boolean(selectedInviteId),
    queryFn: async (): Promise<Host[]> => {
      const roles = await supabase
        .from("celebration_hosts")
        .select("user_id")
        .eq("invite_id", selectedInviteId as string);
      if (roles.error) throw roles.error;
      const ids = [...new Set((roles.data ?? []).map((r) => r.user_id))];
      if (ids.length === 0) return [];
      const people = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (people.error) throw people.error;
      return ids.map((id) => {
        const p = (people.data ?? []).find((row) => row.id === id);
        const label = (p?.full_name ?? "").trim() || (p?.email ?? "") || "Host";
        return { id, name: label };
      });
    },
  });

  const guests = useQuery({
    queryKey: ["relations-guests"],
    queryFn: async (): Promise<Guest[]> => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, household, email, personally_invited, tags")
        .order("household")
        .order("guest_name");
      if (error) throw error;
      return data as Guest[];
    },
  });

  const links = useQuery({
    queryKey: ["relations-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("guest_hosts").select("invite_id, host_id");
      if (error) throw error;
      return data;
    },
  });

  const notes = useQuery({
    queryKey: ["relations-notes"],
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase
        .from("guest_communications")
        .select(
          "id, invite_id, host_id, channel, outcome, notes, follow_up_on, contacted_at, reminder_sent_at",
        )
        .order("contacted_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  /** Which hosts look after which tags, set under Guests → Tags. */
  const tagHosts = useQuery({
    queryKey: ["relations-tag-hosts"],
    queryFn: async () => {
      const tags = await supabase.from("guest_tags").select("id, name");
      if (tags.error) throw tags.error;
      const rows = await supabase.from("guest_tag_hosts").select("tag_id, host_id");
      if (rows.error) throw rows.error;
      const nameOf = new Map((tags.data ?? []).map((t) => [t.id, t.name.toLowerCase()]));
      const map = new Map<string, string[]>();
      for (const r of rows.data ?? []) {
        const name = nameOf.get(r.tag_id);
        if (!name) continue;
        map.set(name, [...(map.get(name) ?? []), r.host_id]);
      }
      return map;
    },
  });

  const hostsFor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of links.data ?? []) {
      map.set(row.invite_id, [...(map.get(row.invite_id) ?? []), row.host_id]);
    }
    // A guest's tags bring their hosts along too.
    for (const g of guests.data ?? []) {
      for (const tag of splitTags(g.tags)) {
        for (const host of tagHosts.data?.get(tag) ?? []) {
          const current = map.get(g.id) ?? [];
          if (!current.includes(host)) map.set(g.id, [...current, host]);
        }
      }
    }
    return map;
  }, [links.data, guests.data, tagHosts.data]);

  const notesFor = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const row of notes.data ?? []) {
      map.set(row.invite_id, [...(map.get(row.invite_id) ?? []), row]);
    }
    return map;
  }, [notes.data]);

  const hostName = (id: string | null) =>
    (hosts.data ?? []).find((h) => h.id === id)?.name ?? "A host";

  const toggleHost = useMutation({
    mutationFn: async ({ inviteId, hostId }: { inviteId: string; hostId: string }) => {
      const assigned = (hostsFor.get(inviteId) ?? []).includes(hostId);
      if (assigned) {
        const { error } = await supabase
          .from("guest_hosts")
          .delete()
          .eq("invite_id", inviteId)
          .eq("host_id", hostId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("guest_hosts")
          .insert({ invite_id: inviteId, host_id: hostId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relations-links"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePersonal = useMutation({
    mutationFn: async ({ guest, next }: { guest: Guest; next: boolean }) => {
      const { error } = await supabase
        .from("invite_codes")
        .update({
          personally_invited: next,
          personally_invited_at: next ? new Date().toISOString() : null,
          personally_invited_by: next ? (me.data ?? null) : null,
        })
        .eq("id", guest.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relations-guests"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from("guest_communications").insert({
        invite_id: inviteId,
        host_id: me.data ?? null,
        channel: draft.channel,
        outcome: draft.outcome,
        notes: draft.notes.trim() || null,
        follow_up_on: draft.follow_up_on || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpenLog(null);
      setDraft({ channel: "call", outcome: "reached", notes: "", follow_up_on: "" });
      qc.invalidateQueries({ queryKey: ["relations-notes"] });
      toast.success("Noted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const transfers = useQuery({
    queryKey: ["relations-transfers"],
    queryFn: async (): Promise<Transfer[]> => {
      const { data, error } = await supabase
        .from("guest_host_transfers")
        .select("id, invite_id, from_host, to_host, reason, effective_on, applied_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Transfer[];
    },
  });

  const transfersFor = useMemo(() => {
    const map = new Map<string, Transfer[]>();
    for (const row of transfers.data ?? []) {
      map.set(row.invite_id, [...(map.get(row.invite_id) ?? []), row]);
    }
    return map;
  }, [transfers.data]);

  const handOver = useMutation({
    mutationFn: async (guest: Guest) => {
      if (!handoverDraft.to) throw new Error("Choose the host taking over.");
      const assigned = hostsFor.get(guest.id) ?? [];
      const from = me.data && assigned.includes(me.data) ? me.data : (assigned[0] ?? null);
      if (from === handoverDraft.to) throw new Error("They already look after this guest.");
      const { error } = await supabase.from("guest_host_transfers").insert({
        invite_id: guest.id,
        from_host: from,
        to_host: handoverDraft.to,
        reason: handoverDraft.reason.trim() || null,
        effective_on: handoverDraft.effective || new Date().toISOString().slice(0, 10),
        created_by: me.data ?? null,
      });
      if (error) throw error;
      const applied = await supabase.rpc("apply_due_guest_transfers");
      if (applied.error) throw applied.error;
      return handoverDraft.effective > new Date().toISOString().slice(0, 10);
    },
    onSuccess: (later) => {
      setOpenHandover(null);
      setHandoverDraft({ to: "", reason: "", effective: new Date().toISOString().slice(0, 10) });
      qc.invalidateQueries({ queryKey: ["relations-links"] });
      qc.invalidateQueries({ queryKey: ["relations-transfers"] });
      toast.success(
        later
          ? "Hand-over booked — it takes effect on the date you chose."
          : "Handed over. Every note stays on the guest's record.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guest_communications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relations-notes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const myGuestIds = useMemo(() => {
    const set = new Set<string>();
    if (!me.data) return set;
    for (const row of links.data ?? []) {
      if (row.host_id === me.data) set.add(row.invite_id);
    }
    return set;
  }, [links.data, me.data]);

  const showingMine = scope === "mine" && myGuestIds.size > 0;
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  const term = search.trim().toLowerCase();
  const matched = (guests.data ?? []).filter((g) => {
    const hit =
      !term ||
      g.guest_name.toLowerCase().includes(term) ||
      (g.household ?? "").toLowerCase().includes(term) ||
      (g.email ?? "").toLowerCase().includes(term);
    const mine = !showingMine || myGuestIds.has(g.id);

    const assigned = hostsFor.get(g.id) ?? [];
    const byHost =
      hostFilter === "all" ||
      (hostFilter === "none" ? assigned.length === 0 : assigned.includes(hostFilter));

    const history = notesFor.get(g.id) ?? [];
    const byStatus =
      statusFilter === "all" ||
      (statusFilter === "none"
        ? history.length === 0
        : history[0]?.outcome === statusFilter);
    const byChannel =
      channelFilter === "all" || history.some((n) => n.channel === channelFilter);
    const byOverdue =
      !overdueOnly || history.some((n) => n.follow_up_on && n.follow_up_on <= today);

    return hit && mine && byHost && byStatus && byChannel && byOverdue;
  });

  const families = useMemo(() => {
    const map = new Map<string, Guest[]>();
    for (const g of matched) {
      const key = g.household ?? "Guests without a family";
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return [...map.entries()];
  }, [matched]);

  const personallyCount = (guests.data ?? []).filter((g) => g.personally_invited).length;
  const spokenCount = new Set((notes.data ?? []).map((r) => r.invite_id)).size;
  const dueFollowUps = (notes.data ?? []).filter(
    (n) => n.follow_up_on && n.follow_up_on <= today,
  );
  const comingUp = (notes.data ?? []).filter(
    (n) => n.follow_up_on && n.follow_up_on > today && n.follow_up_on <= soon,
  );
  const myDue = dueFollowUps.filter((n) => myGuestIds.has(n.invite_id));
  const guestName = (inviteId: string) =>
    (guests.data ?? []).find((g) => g.id === inviteId)?.guest_name ?? "A guest";
  const myReminders = [...dueFollowUps, ...comingUp].filter(
    (n) => myGuestIds.size === 0 || myGuestIds.has(n.invite_id),
  );

  const suggest = useMutation({
    mutationFn: async (inviteId: string) => {
      setThinking(inviteId);
      return await askAi({ data: { inviteId } });
    },
    onSettled: () => setThinking(null),
    onSuccess: (result, inviteId) => {
      if (!result.ok || !result.suggestion) {
        toast.error(result.error ?? "No suggestion came back.");
        return;
      }
      setAdvice((prev) => ({ ...prev, [inviteId]: result.suggestion! }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remind = useMutation({
    mutationFn: async () => await runReminders({ data: undefined }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Reminders could not go out.");
        return;
      }
      if ((result.sent ?? 0) === 0) {
        toast.message(
          result.due === 0
            ? "Nothing due — no reminders needed."
            : "No reminder went out. Check the sending address under Setup → Email.",
        );
      } else {
        toast.success(`Reminder sent to ${result.sent} host${result.sent === 1 ? "" : "s"}.`);
      }
      qc.invalidateQueries({ queryKey: ["relations-notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bring any booked hand-overs into effect once their date has arrived.
  useEffect(() => {
    void supabase.rpc("apply_due_guest_transfers").then(({ data }) => {
      if (data && data > 0) {
        qc.invalidateQueries({ queryKey: ["relations-links"] });
        qc.invalidateQueries({ queryKey: ["relations-transfers"] });
      }
    });
  }, [qc]);

  // Once a day, the first host to open this page sets the reminder emails going.
  useEffect(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("followup-reminders-run") === stamp) return;
    window.localStorage.setItem("followup-reminders-run", stamp);
    void runReminders({ data: undefined }).catch(() => undefined);
  }, [runReminders]);



  return (
    <div className="space-y-6">
      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <HeartHandshake className="size-4 text-primary" /> Who invited whom
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You start on your own guests — the ones put against your name. Switch to everyone for the
          full picture; guests looked after by another host are read-only until you offer to help.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{myGuestIds.size}</p>
            <p className="text-xs text-muted-foreground">
              Your guests{myDue.length > 0 ? ` · ${myDue.length} to follow up` : ""}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{guests.data?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Guests on the list</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{personallyCount}</p>
            <p className="text-xs text-muted-foreground">Invited personally</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{spokenCount}</p>
            <p className="text-xs text-muted-foreground">
              Contacted{dueFollowUps.length > 0 ? ` · ${dueFollowUps.length} to follow up` : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a name, family or email"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={showingMine ? "default" : "outline"}
              size="sm"
              onClick={() => setScope("mine")}
            >
              <UserCheck className="mr-2 size-4" /> My guests ({myGuestIds.size})
            </Button>
            <Button
              type="button"
              variant={showingMine ? "outline" : "default"}
              size="sm"
              onClick={() => setScope("all")}
            >
              <Users className="mr-2 size-4" /> Everyone ({guests.data?.length ?? 0})
            </Button>
          </div>
        </div>
        {scope === "mine" && myGuestIds.size === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No guests are against your name yet — showing everyone. Tap your own name on a guest to
            take them on.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted-foreground">
            Looked after by
            <Select value={hostFilter} onValueChange={setHostFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any host</SelectItem>
                <SelectItem value="none">No host yet</SelectItem>
                {(hosts.data ?? []).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="text-xs text-muted-foreground">
            Where the talk stands
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="none">Not contacted yet</SelectItem>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="text-xs text-muted-foreground">
            How they were contacted
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any way</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              variant={overdueOnly ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setOverdueOnly((v) => !v)}
            >
              Only follow-ups due ({dueFollowUps.length})
            </Button>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="sm:flex sm:items-start sm:justify-between sm:gap-6">
          <div>
            <h3 className="flex items-center gap-2 text-lg">
              <BellRing className="size-4 text-primary" /> Reminders
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Every host gets an email when a guest they look after is due a word — the day it
              falls, two days before, and again if it slips. Nobody is reminded twice about the
              same note.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 shrink-0 sm:mt-0"
            disabled={remind.isPending}
            onClick={() => remind.mutate()}
          >
            {remind.isPending ? "Sending…" : "Send reminders now"}
          </Button>
        </div>
        {myReminders.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {myReminders.slice(0, 8).map((n) => {
              const overdue = !!n.follow_up_on && n.follow_up_on <= today;
              return (
                <li
                  key={n.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 p-3 text-xs"
                >
                  <Badge variant={overdue ? "destructive" : "outline"}>
                    {overdue ? "Due" : "Coming up"} {prettyDate(n.follow_up_on)}
                  </Badge>
                  <span>{guestName(n.invite_id)}</span>
                  <span className="text-muted-foreground">
                    {labelOf(OUTCOMES, n.outcome)} · {labelOf(CHANNELS, n.channel)}
                  </span>
                  {n.reminder_sent_at ? (
                    <span className="text-muted-foreground">· reminder sent</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing waiting — set a follow-up date when you record a talk and it will show here.
          </p>
        )}
      </section>

      {hosts.data && hosts.data.length <= 1 ? (
        <p className="text-sm text-muted-foreground">
          You're the only host so far. Invite more hosts under Setup &rarr; Hosts, and they'll
          appear here to share the guests with.
        </p>
      ) : null}


      <div className="space-y-4">
        {families.map(([family, members]) => (
          <section key={family} className="panel p-4 sm:p-6">
            <h3 className="text-lg">{family}</h3>
            <div className="mt-4 space-y-4">
              {members.map((g) => {
                const assigned = hostsFor.get(g.id) ?? [];
                const history = notesFor.get(g.id) ?? [];
                const latest = history[0];
                const followUp = history.find((n) => n.follow_up_on);
                const isOpen = openLog === g.id;
                const isMine = me.data ? assigned.includes(me.data) : false;
                const tip = advice[g.id];
                const someoneElse = !isMine && assigned.length > 0;
                const handovers = transfersFor.get(g.id) ?? [];
                const handingOver = openHandover === g.id;
                return (
                  <div key={g.id} className="rounded-xl border border-border/60 p-4">
                    <div className="sm:flex sm:items-start sm:justify-between sm:gap-6">
                      <div className="min-w-0">
                        <p>{g.guest_name}</p>
                        {g.email ? (
                          <p className="truncate text-xs text-muted-foreground">{g.email}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(hosts.data ?? []).map((h) => {
                            const on = assigned.includes(h.id);
                            const canChange = !someoneElse || h.id === me.data;
                            return (
                              <button
                                key={h.id}
                                type="button"
                                disabled={!canChange}
                                onClick={() =>
                                  toggleHost.mutate({ inviteId: g.id, hostId: h.id })
                                }
                                className={`rounded-full border px-3 py-1 text-xs transition ${
                                  on
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border text-muted-foreground hover:text-foreground"
                                } ${canChange ? "" : "cursor-default opacity-70"}`}
                              >
                                {on ? <Check className="mr-1 inline size-3" /> : null}
                                {h.name}
                              </button>
                            );
                          })}
                          {assigned.length === 0 ? (
                            <Badge variant="outline">No host yet</Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex shrink-0 flex-wrap gap-2 sm:mt-0">
                        {someoneElse ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              me.data
                                ? toggleHost.mutate({ inviteId: g.id, hostId: me.data })
                                : undefined
                            }
                          >
                            <UserPlus className="mr-2 size-4" /> Help with this guest
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setOpenLog(isOpen ? null : g.id)}
                            >
                              <MessageCircle className="mr-2 size-4" />
                              {isOpen ? "Close" : "Record a talk"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={thinking === g.id}
                              onClick={() => suggest.mutate(g.id)}
                            >
                              <Sparkles className="mr-2 size-4" />
                              {thinking === g.id ? "Thinking…" : "Suggest a follow-up"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={g.personally_invited ? "default" : "outline"}
                              onClick={() =>
                                togglePersonal.mutate({ guest: g, next: !g.personally_invited })
                              }
                            >
                              {g.personally_invited ? (
                                <>
                                  <Check className="mr-2 size-4" /> Invited personally
                                </>
                              ) : (
                                "Mark invited personally"
                              )}
                            </Button>
                            {(hosts.data ?? []).length > 1 && assigned.length > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setOpenHandover(handingOver ? null : g.id)}
                              >
                                <ArrowRightLeft className="mr-2 size-4" />
                                {handingOver ? "Close" : "Hand over"}
                              </Button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {latest ? (
                        <>
                          <Badge variant="secondary">
                            {labelOf(OUTCOMES, latest.outcome)} · {labelOf(CHANNELS, latest.channel)}
                          </Badge>
                          <span className="text-muted-foreground">
                            {prettyDate(latest.contacted_at)} by {hostName(latest.host_id)}
                          </span>
                        </>
                      ) : (
                        <Badge variant="outline">Not contacted yet</Badge>
                      )}
                      {followUp?.follow_up_on ? (
                        <Badge
                          variant={followUp.follow_up_on <= today ? "destructive" : "outline"}
                        >
                          Follow up {prettyDate(followUp.follow_up_on)}
                        </Badge>
                      ) : null}
                    </div>

                    {handingOver ? (
                      <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface/60 p-4 text-sm">
                        <p className="text-xs text-muted-foreground">
                          Pass this guest to another host. Every talk and note already recorded
                          stays with the guest, so whoever takes over sees the whole story.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Taking over</span>
                            <Select
                              value={handoverDraft.to}
                              onValueChange={(v) =>
                                setHandoverDraft((d) => ({ ...d, to: v }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a host" />
                              </SelectTrigger>
                              <SelectContent>
                                {(hosts.data ?? [])
                                  .filter((h) => !assigned.includes(h.id))
                                  .map((h) => (
                                    <SelectItem key={h.id} value={h.id}>
                                      {h.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">From this date</span>
                            <Input
                              type="date"
                              value={handoverDraft.effective}
                              onChange={(e) =>
                                setHandoverDraft((d) => ({ ...d, effective: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                        <Textarea
                          rows={2}
                          placeholder="Why the change — travelling, closer to the family, sharing the load…"
                          value={handoverDraft.reason}
                          onChange={(e) =>
                            setHandoverDraft((d) => ({ ...d, reason: e.target.value }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={handOver.isPending || !handoverDraft.to}
                            onClick={() => handOver.mutate(g)}
                          >
                            {handOver.isPending ? "Handing over…" : "Confirm hand-over"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setOpenHandover(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {handovers.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {handovers.slice(0, 3).map((t) => (
                          <li key={t.id}>
                            {t.applied_at ? "Handed over" : "Hand-over booked"} —{" "}
                            {hostName(t.from_host)} &rarr; {hostName(t.to_host)} ·{" "}
                            {prettyDate(t.effective_on)}
                            {t.reason ? ` · ${t.reason}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {tip ? (
                      <div className="mt-4 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{tip.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Suggested for you — change anything before you send it.
                          </span>
                        </div>
                        <p>{tip.next_step}</p>
                        <p className="whitespace-pre-wrap rounded-md border border-border/60 bg-background/60 p-3">
                          {tip.message}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void navigator.clipboard.writeText(tip.message);
                              toast.success("Message copied.");
                            }}
                          >
                            <Copy className="mr-2 size-4" /> Copy message
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const when = new Date(
                                Date.now() + tip.suggested_follow_up_days * 86400000,
                              )
                                .toISOString()
                                .slice(0, 10);
                              setDraft((d) => ({
                                ...d,
                                notes: tip.message,
                                follow_up_on: when,
                              }));
                              setOpenLog(g.id);
                            }}
                          >
                            Use it in a note
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setAdvice((prev) => {
                                const next = { ...prev };
                                delete next[g.id];
                                return next;
                              })
                            }
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ) : null}


                    {isOpen ? (
                      <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-background/40 p-4">
                        <div className="flex flex-wrap gap-2">
                          {CHANNELS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setDraft((d) => ({ ...d, channel: c.value }))}
                              className={`rounded-full border px-3 py-1 text-xs transition ${
                                draft.channel === c.value
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {OUTCOMES.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => setDraft((d) => ({ ...d, outcome: o.value }))}
                              className={`rounded-full border px-3 py-1 text-xs transition ${
                                draft.outcome === o.value
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                        <Textarea
                          value={draft.notes}
                          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                          placeholder="What was said — who's coming, what they asked for, anything to remember."
                          rows={3}
                        />
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="text-xs text-muted-foreground">
                            Follow up on
                            <Input
                              type="date"
                              value={draft.follow_up_on}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, follow_up_on: e.target.value }))
                              }
                              className="mt-1"
                            />
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            disabled={addNote.isPending}
                            onClick={() => addNote.mutate(g.id)}
                          >
                            Save note
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {history.length > 0 ? (
                      <ul className="mt-4 space-y-2">
                        {history.map((n) => (
                          <li
                            key={n.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border/50 p-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p>
                                {labelOf(CHANNELS, n.channel)} ·{" "}
                                {labelOf(OUTCOMES, n.outcome)} ·{" "}
                                <span className="text-muted-foreground">
                                  {prettyDate(n.contacted_at)} · {hostName(n.host_id)}
                                </span>
                              </p>
                              {n.notes ? (
                                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                  {n.notes}
                                </p>
                              ) : null}
                              {n.follow_up_on ? (
                                <p className="mt-1 text-muted-foreground">
                                  Follow up {prettyDate(n.follow_up_on)}
                                </p>
                              ) : null}
                            </div>
                            {n.host_id && me.data && n.host_id === me.data ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Remove this note"
                                onClick={() => removeNote.mutate(n.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {families.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guests match that search.</p>
        ) : null}
      </div>
    </div>
  );
}
