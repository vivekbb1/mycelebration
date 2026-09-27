import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox, Megaphone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSelectedEvent } from "@/lib/selected-event";
import { splitTags } from "@/lib/tags";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

/** WhatsApp broadcast to guests + inbound emails/WhatsApps we couldn't match to a family. */
export function HostBroadcast() {
  const { inviteId } = useSelectedEvent();
  const qc = useQueryClient();
  const send = useServerFn(sendWhatsAppBroadcast);
  const [template, setTemplate] = useState("");
  const [language, setLanguage] = useState("en");
  const [withName, setWithName] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const guests = useQuery({
    queryKey: ["broadcast-guests", inviteId],
    enabled: !!inviteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("household, phone, tags")
        .eq("invite_id", inviteId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allTags = useMemo(
    () => [...new Set((guests.data ?? []).flatMap((g) => splitTags(g.tags ?? "")))].sort(),
    [guests.data],
  );
  const reach = useMemo(() => {
    const rows = (guests.data ?? []).filter(
      (g) => (g.phone ?? "").replace(/\D/g, "").length >= 8 &&
        (tags.length === 0 || splitTags(g.tags ?? "").some((t) => tags.includes(t))),
    );
    return { rows, households: [...new Set(rows.map((r) => r.household).filter(Boolean))] as string[] };
  }, [guests.data, tags]);

  const history = useQuery({
    queryKey: ["wa-broadcasts", inviteId],
    enabled: !!inviteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_broadcasts")
        .select("id, template_name, sent_count, failed_count, created_at")
        .eq("invite_id", inviteId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const unmatched = useQuery({
    queryKey: ["inbound-unmatched"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inbound_unmatched")
        .select("id, channel, sender, sender_name, subject, body, created_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const go = async () => {
    if (!inviteId) return;
    if (!/^[a-z0-9_]+$/.test(template)) {
      toast.error("Enter the approved template name exactly, e.g. wedding_invite.");
      return;
    }
    if (reach.rows.length === 0) {
      toast.error("No guests with a mobile number in this selection.");
      return;
    }
    if (!confirm(`Send "${template}" on WhatsApp to ${reach.rows.length} guests?`)) return;
    setBusy(true);
    try {
      const r = await send({
        data: { inviteId, template, language, withName, households: tags.length ? reach.households : null },
      });
      if (!r.ok) {
        toast.error(
          r.reason === "not_configured"
            ? "WhatsApp isn't connected yet — add your WhatsApp Business details first."
            : r.reason === "forbidden" ? "Only hosts can send broadcasts." : r.reason,
        );
      } else if (r.failed > 0) {
        toast.warning(`Sent to ${r.sent}. ${r.failed} failed — first: ${r.failures[0]?.error}`);
      } else toast.success(`Sent to ${r.sent} guests.`);
      await qc.invalidateQueries({ queryKey: ["wa-broadcasts", inviteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (id: string) => {
    await supabase.from("inbound_unmatched").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    await qc.invalidateQueries({ queryKey: ["inbound-unmatched"] });
  };

  return (
    <div className="space-y-6">
      <div className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Megaphone className="size-4 text-primary" /> WhatsApp broadcast
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          WhatsApp only allows messages approved in your WhatsApp Business account. Enter the
          template's name; replies from guests land in their family's Messages.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
          <Input placeholder="Template name, e.g. wedding_invite" value={template}
            onChange={(e) => setTemplate(e.target.value.trim().toLowerCase())} />
          <Input placeholder="Language" value={language} onChange={(e) => setLanguage(e.target.value.trim())} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <Switch checked={withName} onCheckedChange={setWithName} />
          Fill the template's first blank with each guest's name
        </label>
        {allTags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {allTags.map((t) => (
              <button key={t} type="button"
                onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>
                <Badge variant={tags.includes(t) ? "default" : "outline"}>#{t}</Badge>
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={go} disabled={busy || !inviteId}>
            {busy ? "Sending…" : `Send to ${reach.rows.length} guests`}
          </Button>
          <span className="text-xs text-muted-foreground">
            {tags.length ? "Only guests with the chosen tags" : "Everyone with a mobile number"}
          </span>
        </div>
        {(history.data ?? []).length > 0 ? (
          <ul className="mt-6 space-y-1 text-sm">
            {history.data!.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2">
                <span>{h.template_name} · {new Date(h.created_at).toLocaleString()}</span>
                <span className="text-muted-foreground">{h.sent_count} sent{h.failed_count ? ` · ${h.failed_count} failed` : ""}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Inbox className="size-4 text-primary" /> Not matched to a guest
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Emails and WhatsApps from addresses or numbers not on your guest list. Add their email or
          mobile to the guest and future messages file themselves.
        </p>
        {(unmatched.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing waiting.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {unmatched.data!.map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    <Badge variant="outline" className="mr-2">{m.channel === "email" ? "Email" : "WhatsApp"}</Badge>
                    {m.sender_name ? `${m.sender_name} · ` : ""}{m.sender}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => dismiss(m.id)}>Dismiss</Button>
                </div>
                {m.subject ? <p className="mt-2 font-medium">{m.subject}</p> : null}
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{m.body.slice(0, 600)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
