import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type GuestMessage = {
  id: string;
  household: string;
  author_name: string | null;
  from_host: boolean;
  body: string;
  created_at: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** The guest side of the thread: notes from the hosts, and a reply box. */
export function GuestMessages() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const me = useQuery({
    queryKey: ["me-messages"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, household")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const thread = useQuery({
    queryKey: ["guest-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_messages")
        .select("id, household, author_name, from_host, body, created_at")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as GuestMessage[];
    },
  });

  const send = async () => {
    const body = draft.trim();
    if (body.length < 2) {
      toast.error("Write a short message first.");
      return;
    }
    if (!me.data?.household) {
      toast.error("We can't find your family on the guest list yet — please tell the hosts.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("guest_messages").insert({
      household: me.data.household,
      author_id: me.data.id,
      author_name: me.data.full_name,
      from_host: false,
      body,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    toast.success("Sent — the hosts will see it.");
    await queryClient.invalidateQueries({ queryKey: ["guest-messages"] });
  };

  const messages = thread.data ?? [];

  return (
    <section className="panel p-4 sm:p-6">
      <p className="text-eyebrow">Messages</p>
      <h2 className="mt-2 flex items-center gap-2 text-xl">
        <MessageCircle className="size-4 shrink-0 text-primary" /> Talk to the hosts
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Anything you'd like us to know — arrival times, a change of plan, a question about the
        outfits. Everyone in your family sees this thread.
      </p>

      {messages.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-lg border p-3 text-sm ${
                m.from_host ? "border-primary/40 bg-primary/5" : "border-border"
              }`}
            >
              <p className="text-xs text-muted-foreground">
                {m.from_host ? (m.author_name || "Your host") : (m.author_name || "You")} ·{" "}
                {when(m.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          No messages yet. Say hello — we reply here.
        </p>
      )}

      <div className="mt-5 space-y-3">
        <Textarea
          rows={3}
          maxLength={1000}
          value={draft}
          placeholder="We land on the 19th in the afternoon…"
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button onClick={send} disabled={busy} className="w-full sm:w-auto">
          <Send className="mr-2 size-4" /> {busy ? "Sending…" : "Send to the hosts"}
        </Button>
      </div>
    </section>
  );
}
