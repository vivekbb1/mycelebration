import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  HeartHandshake,
  MessageCircle,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Guest = {
  id: string;
  guest_name: string;
  household: string | null;
  email: string | null;
  personally_invited: boolean;
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
  const [onlyMine, setOnlyMine] = useState(false);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    channel: string;
    outcome: string;
    notes: string;
    follow_up_on: string;
  }>({ channel: "call", outcome: "reached", notes: "", follow_up_on: "" });

  const me = useQuery({
    queryKey: ["relations-me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const hosts = useQuery({
    queryKey: ["relations-hosts"],
    queryFn: async (): Promise<Host[]> => {
      const roles = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (roles.error) throw roles.error;
      const ids = (roles.data ?? []).map((r) => r.user_id);
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
        .select("id, guest_name, household, email, personally_invited")
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
        .select("id, invite_id, host_id, channel, outcome, notes, follow_up_on, contacted_at")
        .order("contacted_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const hostsFor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of links.data ?? []) {
      map.set(row.invite_id, [...(map.get(row.invite_id) ?? []), row.host_id]);
    }
    return map;
  }, [links.data]);

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

  const removeNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guest_communications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relations-notes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const term = search.trim().toLowerCase();
  const matched = (guests.data ?? []).filter((g) => {
    const hit =
      !term ||
      g.guest_name.toLowerCase().includes(term) ||
      (g.household ?? "").toLowerCase().includes(term) ||
      (g.email ?? "").toLowerCase().includes(term);
    const mine = !onlyMine || (me.data ? (hostsFor.get(g.id) ?? []).includes(me.data) : false);
    return hit && mine;
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
  const assignedCount = new Set((links.data ?? []).map((r) => r.invite_id)).size;
  const spokenCount = new Set((notes.data ?? []).map((r) => r.invite_id)).size;
  const today = new Date().toISOString().slice(0, 10);
  const dueFollowUps = (notes.data ?? []).filter(
    (n) => n.follow_up_on && n.follow_up_on <= today,
  );

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <HeartHandshake className="size-4 text-primary" /> Who invited whom
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tick the guests you invited personally, put one or more hosts against each guest, and
          record every call or message so nobody is chased twice — or forgotten.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{guests.data?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Guests on the list</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{personallyCount}</p>
            <p className="text-xs text-muted-foreground">Invited personally</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{assignedCount}</p>
            <p className="text-xs text-muted-foreground">Looked after by a host</p>
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
          <Button
            type="button"
            variant={onlyMine ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyMine((v) => !v)}
          >
            <UserCheck className="mr-2 size-4" /> Only my guests
          </Button>
        </div>
      </section>

      {hosts.data && hosts.data.length <= 1 ? (
        <p className="text-sm text-muted-foreground">
          You're the only host so far. Invite more hosts under Setup &rarr; Hosts, and they'll
          appear here to share the guests with.
        </p>
      ) : null}

      <div className="space-y-4">
        {families.map(([family, members]) => (
          <section key={family} className="panel p-6">
            <h3 className="text-lg">{family}</h3>
            <div className="mt-4 space-y-4">
              {members.map((g) => {
                const assigned = hostsFor.get(g.id) ?? [];
                const history = notesFor.get(g.id) ?? [];
                const latest = history[0];
                const followUp = history.find((n) => n.follow_up_on);
                const isOpen = openLog === g.id;
                const isMine = me.data ? assigned.includes(me.data) : false;
                const someoneElse = !isMine && assigned.length > 0;
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
