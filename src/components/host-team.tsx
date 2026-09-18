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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const hostInvites = useQuery({
    queryKey: ["host-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("host_invites")
        .select("id, email, full_name, code, claimed_by, claimed_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const sendHostInvite = async () => {
    const email = inviteEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const result = await inviteHostByEmail({
        data: { email, fullName: inviteName.trim() || undefined },
      });
      if (!result.ok) {
        toast.error(result.error ?? "We couldn't send that invitation.");
        return;
      }
      setInviteEmail("");
      setInviteName("");
      await queryClient.invalidateQueries({ queryKey: ["host-invites"] });
      if (result.sent) {
        toast.success(`Invitation sent to ${email}.`);
      } else {
        const link = result.link ?? "";
        const subject = encodeURIComponent("You've been invited to host the wedding wardrobe");
        const body = encodeURIComponent(
          `You can now help run the wedding wardrobe.\n\nRegister here: ${link}\nHost code: ${result.code}\n`,
        );
        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
        toast.success(
          "Opening your mail app with the host invitation ready to send. Set up a sending domain and the portal will send these for you.",
        );
      }
    } catch {
      toast.error("We couldn't send that invitation. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyHostLink = async (code: string) => {
    const link = `${window.location.origin}/auth?code=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Registration link copied.");
    } catch {
      toast.error("We couldn't copy the link.");
    }
  };

  const removeHostInvite = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("host_invites").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("We couldn't withdraw that invitation.");
      return;
    }
    toast.success("Invitation withdrawn.");
    await queryClient.invalidateQueries({ queryKey: ["host-invites"] });
  };

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

  const pendingInvites = (hostInvites.data ?? []).filter((i) => !i.claimed_by);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-6">
        <section className="panel p-4 sm:p-6">
          <h2 className="text-xl">Invite a host by email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            They don't need an account yet — we email them a link and their own host code, and they
            become a host as soon as they register.
          </p>
          <div className="mt-5 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="hi-email">Email</Label>
              <Input
                id="hi-email"
                type="email"
                maxLength={255}
                value={inviteEmail}
                placeholder="sister@example.com"
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hi-name">Name (optional)</Label>
              <Input
                id="hi-name"
                maxLength={100}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={busy || !inviteEmail} onClick={sendHostInvite}>
              <Mail className="mr-2 size-4" />
              Send host invitation
            </Button>
          </div>

          {pendingInvites.length > 0 ? (
            <div className="mt-6">
              <p className="text-eyebrow">Waiting to register ({pendingInvites.length})</p>
              <ul className="mt-3 divide-y divide-border/60">
                {pendingInvites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{i.full_name || i.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {i.full_name ? `${i.email} · ` : ""}
                        {i.code}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Copy registration link for ${i.email}`}
                        onClick={() => copyHostLink(i.code)}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        aria-label={`Withdraw invitation for ${i.email}`}
                        onClick={() => removeHostInvite(i.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="panel p-4 sm:p-6">
        <h2 className="text-xl">Add someone already registered</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hosts share everything: outfits, functions, the delivery plan, the guest list and
          measurements.
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
      </div>

      <section className="panel p-4 sm:p-6">
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
