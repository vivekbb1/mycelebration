import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Message = {
  id: string;
  household: string;
  author_name: string | null;
  from_host: boolean;
  body: string;
  created_at: string;
  channel?: string | null;
  subject?: string | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Host inbox: every family thread, newest first, with a reply box. */
export function HostMessages() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["me-host-messages"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["host-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_messages")
        .select("id, household, author_name, from_host, body, created_at, channel, subject")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  const families = useQuery({
    queryKey: ["message-households"],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("name").order("name");
      if (error) throw error;
      return (data ?? []).map((f) => f.name as string);
    },
  });

  const threads = useMemo(() => {
    const map = new Map<string, Message[]>();
    for (const name of families.data ?? []) map.set(name, []);
    for (const m of messages.data ?? []) {
      map.set(m.household, [...(map.get(m.household) ?? []), m]);
    }
    const term = search.trim().toLowerCase();
    return [...map.entries()]
      .map(([household, list]) => ({
        household,
        list,
        last: list.length > 0 ? list[list.length - 1] : null,
        waiting: list.length > 0 && !list[list.length - 1]!.from_host,
      }))
      .filter((t) => !term || t.household.toLowerCase().includes(term))
      .sort((a, b) => {
        if (a.waiting !== b.waiting) return a.waiting ? -1 : 1;
        const at = a.last?.created_at ?? "";
        const bt = b.last?.created_at ?? "";
        return bt.localeCompare(at);
      });
  }, [messages.data, families.data, search]);

  const reply = async (household: string) => {
    const body = (draft[household] ?? "").trim();
    if (body.length < 2) {
      toast.error("Write a short reply first.");
      return;
    }
    setBusy(household);
    const { error } = await supabase.from("guest_messages").insert({
      household,
      author_id: me.data?.id ?? null,
      author_name: me.data?.full_name ?? "Your host",
      from_host: true,
      body,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft({ ...draft, [household]: "" });
    toast.success("Reply sent.");
    await queryClient.invalidateQueries({ queryKey: ["host-messages"] });
  };

  const waitingCount = threads.filter((t) => t.waiting).length;

  return (
    <div className="space-y-6">
      <div className="panel p-4 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 truncate text-xl">
              <MessageCircle className="size-4 shrink-0 text-primary" /> Messages from guests
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Replies land on each family's invitation page straight away.
            </p>
          </div>
          {waitingCount > 0 ? (
            <Badge className="shrink-0">{waitingCount} waiting on you</Badge>
          ) : null}
        </div>
        <Input
          className="mt-4"
          placeholder="Search a family"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {threads.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No families on the list yet — add them under Guests first.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {threads.map((t) => {
              const isOpen = open === t.household;
              return (
                <li key={t.household} className="rounded-lg border border-border p-3">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : t.household)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{t.household}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {t.last
                          ? `${t.last.from_host ? "You" : t.last.author_name || "Guest"}: ${t.last.body}`
                          : "No messages yet"}
                      </span>
                    </span>
                    {t.waiting ? <Badge className="shrink-0">Reply</Badge> : null}
                  </button>

                  {isOpen ? (
                    <div className="mt-4 space-y-3">
                      {t.list.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-lg border p-3 text-sm ${
                            m.from_host ? "border-primary/40 bg-primary/5" : "border-border"
                          }`}
                        >
                          <p className="text-xs text-muted-foreground">
                            {m.from_host ? m.author_name || "Host" : m.author_name || "Guest"} ·{" "}
                            {when(m.created_at)}
                            {m.channel && m.channel !== "app" ? (
                              <Badge variant="outline" className="ml-2">
                                {m.channel === "email" ? "Email" : "WhatsApp"}
                              </Badge>
                            ) : null}
                          </p>
                          {m.subject ? <p className="mt-1 font-medium">{m.subject}</p> : null}
                          <p className="mt-1 whitespace-pre-line">{m.body}</p>
                        </div>
                      ))}
                      <Textarea
                        rows={3}
                        maxLength={1000}
                        value={draft[t.household] ?? ""}
                        placeholder={`Reply to ${t.household}`}
                        onChange={(e) => setDraft({ ...draft, [t.household]: e.target.value })}
                      />
                      <Button
                        onClick={() => reply(t.household)}
                        disabled={busy === t.household}
                        className="w-full sm:w-auto"
                      >
                        <Send className="mr-2 size-4" />
                        {busy === t.household ? "Sending…" : "Send reply"}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
