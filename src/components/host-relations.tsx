import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, HeartHandshake, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
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

/** Who personally invited each guest, and which host looks after them. */
export function HostRelations() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

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

  const hostsFor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of links.data ?? []) {
      map.set(row.invite_id, [...(map.get(row.invite_id) ?? []), row.host_id]);
    }
    return map;
  }, [links.data]);

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

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <HeartHandshake className="size-4 text-primary" /> Who invited whom
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tick the guests you invited personally, and put one or more hosts against each guest so
          every message comes from a familiar name.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
                return (
                  <div
                    key={g.id}
                    className="rounded-xl border border-border/60 p-4 sm:flex sm:items-start sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p>{g.guest_name}</p>
                      {g.email ? (
                        <p className="truncate text-xs text-muted-foreground">{g.email}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(hosts.data ?? []).map((h) => {
                          const on = assigned.includes(h.id);
                          return (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() =>
                                toggleHost.mutate({ inviteId: g.id, hostId: h.id })
                              }
                              className={`rounded-full border px-3 py-1 text-xs transition ${
                                on
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
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
                    <div className="mt-4 shrink-0 sm:mt-0">
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
                    </div>
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
