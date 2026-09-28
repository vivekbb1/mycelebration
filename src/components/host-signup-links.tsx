import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { randomCode } from "@/lib/secure-code";
import { signupUrl } from "@/lib/signup-link";

/** Hosts' sign-up links: each one lets families register themselves for the events ticked. */
export function HostSignupLinks({ inviteId, slug }: { inviteId: string; slug: string | null | undefined }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const key = ["signup-links", inviteId];

  const data = useQuery({
    queryKey: key,
    enabled: Boolean(inviteId),
    queryFn: async () => {
      const [links, events, fams] = await Promise.all([
        supabase.from("signup_links").select("*").eq("invite_id", inviteId).order("created_at"),
        supabase.from("events").select("id, name").eq("invite_id", inviteId).order("sort_order"),
        supabase.from("families").select("signup_link_id").eq("invite_id", inviteId).not("signup_link_id", "is", null),
      ]);
      const counts = new Map<string, number>();
      for (const f of fams.data ?? []) counts.set(f.signup_link_id!, (counts.get(f.signup_link_id!) ?? 0) + 1);
      return { links: links.data ?? [], events: events.data ?? [], counts };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const create = async () => {
    const events = data.data?.events.map((e) => e.id) ?? [];
    const { error } = await supabase.from("signup_links").insert({
      invite_id: inviteId,
      label: label.trim() || "Family sign-up",
      token: randomCode(24),
      event_ids: events,
    });
    if (error) { toast.error(error.message); return; }
    setLabel("");
    toast.success("Link made — it covers every event until you untick some.");
    await refresh();
  };

  const update = async (id: string, patch: { event_ids?: string[]; enabled?: boolean; label?: string }) => {
    const { error } = await supabase.from("signup_links").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    await refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this link? Families already registered stay on your list.")) return;
    await supabase.from("signup_links").delete().eq("id", id);
    await refresh();
  };

  if (!inviteId) return null;

  return (
    <CollapsiblePanel
      title="Family sign-up links"
      subtitle="Share a link and families register themselves, add their members and get a family code. They join the events you tick."
    >
      {!slug ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Give the celebration a web address first (Setup → Celebration) to make sign-up links.
        </p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <Input
              value={label}
              maxLength={60}
              placeholder="Label, e.g. Reception only"
              onChange={(e) => setLabel(e.target.value)}
            />
            <Button type="button" onClick={create}>
              <Plus className="size-4" /> New link
            </Button>
          </div>
          <ul className="mt-4 space-y-4">
            {(data.data?.links ?? []).map((l) => {
              const url = signupUrl(slug, l.token);
              const chosen = new Set(l.event_ids ?? []);
              return (
                <li key={l.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      defaultValue={l.label}
                      maxLength={60}
                      className="h-8"
                      onBlur={(e) => e.target.value.trim() && e.target.value !== l.label && update(l.id, { label: e.target.value.trim() })}
                    />
                    <label className="flex shrink-0 items-center gap-2 text-xs">
                      <Switch checked={l.enabled} onCheckedChange={(v) => update(l.id, { enabled: v })} />
                      {l.enabled ? "Open" : "Paused"}
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(data.data?.events ?? []).map((e) => (
                      <Button
                        key={e.id}
                        type="button"
                        size="sm"
                        variant={chosen.has(e.id) ? "default" : "outline"}
                        onClick={() => {
                          const next = new Set(chosen);
                          if (next.has(e.id)) next.delete(e.id);
                          else next.add(e.id);
                          if (next.size === 0) { toast.error("A link needs at least one event."); return; }
                          void update(l.id, { event_ids: [...next] });
                        }}
                      >
                        {e.name}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Copy link"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        toast.success("Link copied");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Delete link" onClick={() => remove(l.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.data?.counts.get(l.id) ?? 0} families registered. Changing events only affects families who register after the change.
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </CollapsiblePanel>
  );
}
