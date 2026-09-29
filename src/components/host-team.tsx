import { PUBLIC_ORIGIN, authLink } from "@/lib/public-url";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Pencil, ShieldCheck, Trash2, UserMinus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { inviteHostByEmail } from "@/lib/host-invite.functions";
import { useCelebrationSlug, useSelectedEvent } from "@/lib/selected-event";
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
  const { inviteId } = useSelectedEvent();
  const slug = useCelebrationSlug();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const hostInvites = useQuery({
    queryKey: ["host-invites", inviteId],
    enabled: Boolean(inviteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("host_invites")
        .select("id, email, full_name, code, claimed_by, claimed_at, created_at")
        .eq("invite_id", inviteId)
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
        data: { email, fullName: inviteName.trim() || undefined, inviteId },
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
        const subject = encodeURIComponent("You've been invited to help host on My Celebration");
        const body = encodeURIComponent(
          `You can now help run the celebration.\n\nRegister here: ${link}\nHost code: ${result.code}\n`,
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
    const link = authLink(code, slug);
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
    queryKey: ["host-roles", inviteId],
    enabled: Boolean(inviteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("celebration_hosts")
        .select("id, user_id, role, created_at")
        .eq("invite_id", inviteId)
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
        owner: r.role === "owner",
        name: p?.full_name || "Host",
        email: p?.email ?? null,
      };
    });
  }, [hostRoles.data, profiles.data]);

  const target0 = (roleId: string) => hosts.find((h) => h.roleId === roleId);
  const iAmOwner = hosts.some((h) => h.userId === me.data && h.owner);

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
      .from("celebration_hosts")
      .insert({ user_id: pick, invite_id: inviteId, role: "host" });
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
    if (!iAmOwner || target0(roleId)?.owner) {
      toast.error("Only the main host can remove co-hosts, and the main host can't be removed.");
      return;
    }
    if (userId === me.data) {
      toast.error("You can't remove your own host access.");
      return;
    }
    const target = hosts.find((h) => h.roleId === roleId);
    if (target?.owner && hosts.filter((h) => h.owner).length <= 1) {
      toast.error("A celebration needs at least one owner.");
      return;
    }
    if (!window.confirm(`Remove host access for ${name}? They keep their guest access.`)) return;
    setBusy(true);
    const { error } = await supabase.from("celebration_hosts").delete().eq("id", roleId);
    setBusy(false);
    if (error) {
      toast.error("We couldn't remove that host. Please try again.");
      return;
    }
    toast.success(`${name} is a guest again.`);
    await queryClient.invalidateQueries({ queryKey: ["host-roles"] });
  };

  const setRole = async (roleId: string, name: string, owner: boolean) => {
    if (!iAmOwner) return;
    if (!owner && hosts.filter((h) => h.owner).length <= 1) {
      toast.error("A celebration needs at least one owner.");
      return;
    }
    const msg = owner
      ? `Make ${name} an owner? Owners can add, remove and change other hosts.`
      : `Make ${name} a co-host? They keep access but can't manage other hosts.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const { error } = await supabase
      .from("celebration_hosts")
      .update({ role: owner ? "owner" : "host" })
      .eq("id", roleId);
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("owner")
          ? "A celebration needs at least one owner."
          : "We couldn't change that. Please try again.",
      );
      return;
    }
    toast.success(`${name} is now ${owner ? "an owner" : "a co-host"}.`);
    await queryClient.invalidateQueries({ queryKey: ["host-roles"] });
  };

  const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

  /** Fix the address on a host invitation that hasn't been used yet. */
  const editInviteEmail = async (id: string, current: string) => {
    const next = window.prompt("Email for this host invitation", current)?.trim();
    if (!next || next === current) return;
    if (!validEmail(next)) return void toast.error("Enter a valid email address.");
    setBusy(true);
    const { error } = await supabase.from("host_invites").update({ email: next }).eq("id", id);
    setBusy(false);
    if (error) return void toast.error("We couldn't change that email.");
    toast.success("Email updated. Copy the link again to send it to the new address.");
    await queryClient.invalidateQueries({ queryKey: ["host-invites"] });
  };

  /** They already registered under another email: give that account host access. */
  const linkInvite = async (id: string, userId: string) => {
    if (!userId) return;
    const person = candidates.find((c) => c.id === userId);
    if (!window.confirm(`Make ${person?.full_name || person?.email || "this person"} a host using their registered account?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("celebration_hosts")
      .insert({ user_id: userId, invite_id: inviteId, role: "host" });
    if (error && error.code !== "23505") {
      setBusy(false);
      return void toast.error("We couldn't add that host.");
    }
    await supabase
      .from("host_invites")
      .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    toast.success("They're now a host.");
    await queryClient.invalidateQueries({ queryKey: ["host-invites"] });
    await queryClient.invalidateQueries({ queryKey: ["host-roles"] });
  };

  /** Change the contact email saved for a host (not their sign-in). */
  const editHostEmail = async (userId: string, current: string | null) => {
    const next = window.prompt("Contact email for this host", current ?? "")?.trim();
    if (!next || next === current) return;
    if (!validEmail(next)) return void toast.error("Enter a valid email address.");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ email: next }).eq("id", userId);
    setBusy(false);
    if (error) return void toast.error("We couldn't change that email.");
    toast.success("Contact email updated.");
    await queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
  };

  const pendingInvites = (hostInvites.data ?? []).filter((i) => !i.claimed_by);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-6">
        <section className="panel p-4 sm:p-6">
          <h2 className="text-xl">Invite a host by email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            They don't need an account yet — we email them a link and their own host code, and they
            join as a co-host as soon as they register. An owner can make them an owner later.
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
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
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
                        disabled={busy}
                        aria-label={`Edit email for ${i.email}`}
                        onClick={() => editInviteEmail(i.id, i.email)}
                      >
                        <Pencil className="size-4" />
                      </Button>
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
                    {iAmOwner && candidates.length > 0 ? (
                      <select
                        aria-label={`Already registered under another email`}
                        className="field-select mt-1 h-8 w-full py-0 text-xs"
                        value=""
                        disabled={busy}
                        onChange={(e) => void linkInvite(i.id, e.target.value)}
                      >
                        <option value="">Registered with another email? Pick them…</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name || "Unnamed"}
                            {c.email ? ` · ${c.email}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="panel p-4 sm:p-6">
        <h2 className="text-xl">Add someone already registered</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hosts of this celebration share its outfits, events, delivery plan, guest list and
          measurements. They can't see any other celebration.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          To fix or remove someone in this list (for example a test account), go to Guests →
          Registered and use the pencil or bin button.
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
                    {h.owner ? (
                      <Badge variant="outline" className="shrink-0">
                        Owner
                      </Badge>
                    ) : null}
                    {h.userId === me.data ? (
                      <Badge variant="secondary" className="shrink-0">
                        You
                      </Badge>
                    ) : null}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {h.email ?? "No email"}
                    {h.userId !== me.data ? (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Edit email for ${h.name}`}
                        onClick={() => editHostEmail(h.userId, h.email)}
                        className="text-primary"
                      >
                        <Pencil className="size-3" />
                      </button>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                {iAmOwner ? (
                  <select
                    aria-label={`Rights for ${h.name}`}
                    className="field-select h-8 py-0 text-xs"
                    value={h.owner ? "owner" : "host"}
                    disabled={busy || (h.owner && hosts.filter((x) => x.owner).length <= 1)}
                    onChange={(e) => void setRole(h.roleId, h.name, e.target.value === "owner")}
                  >
                    <option value="owner">Owner</option>
                    <option value="host">Co-host</option>
                  </select>
                ) : null}
                {iAmOwner && !h.owner && h.userId !== me.data ? (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={`Remove host access for ${h.name}`}
                  onClick={() => removeHost(h.roleId, h.userId, h.name)}
                >
                  <UserMinus className="size-4" />
                </Button>
                ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
