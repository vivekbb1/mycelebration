import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, ShieldCheck, Trash2, UserMinus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { inviteHostByEmail } from "@/lib/host-invite.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Lets an existing host share host access with other registered users, so a
 * wedding can be run by several people (siblings, planner, parents).
 */
export function HostTeam() {
  const queryClient = useQueryClient();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const me = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });

  const hostRoles = useQuery({
    queryKey: ["host-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, created_at")
        .eq("role", "admin")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, city, country, rsvp_status, rsvp_note, whatsapp");
      if (error) throw error;
      return data;
    },
  });

  const hosts = useMemo(() => {
    return (hostRoles.data ?? []).map((r) => {
      const p = profiles.data?.find((x) => x.id === r.user_id);
      return {
        roleId: r.id,
        userId: r.user_id,
        name: p?.full_name || "Host",
        email: p?.email ?? null,
      };
    });
  }, [hostRoles.data, profiles.data]);

  const candidates = useMemo(() => {
    const hostIds = new Set(hosts.map((h) => h.userId));
    return (profiles.data ?? []).filter((p) => !hostIds.has(p.id));
  }, [hosts, profiles.data]);

  const addHost = async () => {
    if (!pick) {
      toast.error("Choose who should become a host.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: pick, role: "admin" });
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "That person is already a host."
          : "We couldn't add that host. Please try again.",
      );
      return;
    }
    const name = candidates.find((c) => c.id === pick)?.full_name || "That guest";
    toast.success(`${name} can now manage the wardrobe.`);
    setPick("");
    await queryClient.invalidateQueries({ queryKey: ["host-roles"] });
  };

  const removeHost = async (roleId: string, userId: string, name: string) => {
    if (userId === me.data) {
      toast.error("You can't remove your own host access.");
      return;
    }
    if (hosts.length <= 1) {
      toast.error("There has to be at least one host.");
      return;
    }
    if (!window.confirm(`Remove host access for ${name}? They keep their guest access.`)) return;
    setBusy(true);
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    setBusy(false);
    if (error) {
      toast.error("We couldn't remove that host. Please try again.");
      return;
    }
    toast.success(`${name} is a guest again.`);
    await queryClient.invalidateQueries({ queryKey: ["host-roles"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <section className="panel p-6">
        <h2 className="text-xl">Add a host</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hosts share everything: outfits, functions, the delivery plan, the guest list and
          measurements. Anyone who has already registered on the portal can be made a host.
        </p>

        <div className="mt-5 space-y-3">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a registered person" />
            </SelectTrigger>
            <SelectContent>
              {candidates.length === 0 ? (
                <SelectItem value="none" disabled>
                  Everyone registered is already a host
                </SelectItem>
              ) : (
                candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name || "Unnamed"}
                    {c.email ? ` · ${c.email}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button className="w-full" disabled={busy || !pick} onClick={addHost}>
            Make them a host
          </Button>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-xl">Hosts ({hosts.length})</h2>
        {hostRoles.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60">
            {hosts.map((h) => (
              <li key={h.roleId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate">
                    <ShieldCheck className="size-4 shrink-0 text-primary" />
                    {h.name}
                    {h.userId === me.data ? (
                      <Badge variant="secondary" className="shrink-0">
                        You
                      </Badge>
                    ) : null}
                  </p>
                  {h.email ? (
                    <p className="truncate text-xs text-muted-foreground">{h.email}</p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy || h.userId === me.data || hosts.length <= 1}
                  aria-label={`Remove host access for ${h.name}`}
                  onClick={() => removeHost(h.roleId, h.userId, h.name)}
                >
                  <UserMinus className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
