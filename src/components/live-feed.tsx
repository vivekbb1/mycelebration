import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { browseEventFeed, claimFeedLook, type FeedLook } from "@/lib/feed.functions";

const AUDIENCES = [
  { value: "women", label: "Women's" },
  { value: "men", label: "Men's" },
  { value: "kids", label: "Children's" },
];

/**
 * The shop's live looks for one event. Guests claim from it; hosts (mode
 * "host") preview it and hide single looks.
 */
export function LiveFeed({
  eventId,
  defaultAudience,
  guestName,
  mode = "guest",
}: {
  eventId: string;
  defaultAudience?: string | null;
  guestName?: string | null;
  mode?: "guest" | "host";
}) {
  const queryClient = useQueryClient();
  const browse = useServerFn(browseEventFeed);
  const claim = useServerFn(claimFeedLook);
  const [audience, setAudience] = useState(defaultAudience ?? "women");
  const [page, setPage] = useState(1);
  const [looks, setLooks] = useState<FeedLook[]>([]);
  const [more, setMore] = useState(false);
  const [hasFeeds, setHasFeeds] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (defaultAudience) setAudience(defaultAudience);
  }, [defaultAudience]);

  const load = async (p: number, reset: boolean) => {
    setLoading(true);
    try {
      const res = await browse({ data: { eventId, audience, page: p } });
      setHasFeeds(res.hasFeeds);
      setMore(res.more);
      setPage(p);
      setLooks((prev) => {
        if (reset) return res.looks;
        const have = new Set(prev.map((l) => l.slug));
        return [...prev, ...res.looks.filter((l) => !have.has(l.slug))];
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the looks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLooks([]);
    void load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, audience]);

  const reserve = async (look: FeedLook) => {
    setBusy(look.slug);
    try {
      await claim({ data: { eventId, audience, slug: look.slug, guestName: guestName ?? null } });
      toast.success(`${look.title} is yours.`);
      setLooks((prev) => prev.filter((l) => l.slug !== look.slug));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reservations"] }),
        queryClient.invalidateQueries({ queryKey: ["outfits"] }),
        queryClient.invalidateQueries({ queryKey: ["my-wardrobe"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reserve that look.");
      void load(1, true);
    } finally {
      setBusy(null);
    }
  };

  const toggleHidden = async (look: FeedLook) => {
    setBusy(look.slug);
    const { error } = look.hidden
      ? await supabase.from("outfit_feed_hidden").delete().eq("event_id", eventId).eq("slug", look.slug)
      : await supabase.from("outfit_feed_hidden").insert({ event_id: eventId, slug: look.slug });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setLooks((prev) => prev.map((l) => (l.slug === look.slug ? { ...l, hidden: !l.hidden } : l)));
  };

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">{mode === "host" ? "Live preview" : "More looks to choose from"}</h2>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              onClick={() => setAudience(a.value)}
              aria-pressed={audience === a.value}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                audience === a.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {!hasFeeds ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {mode === "host" ? "No live feed saved for this audience yet." : "Nothing more here yet."}
        </p>
      ) : looks.length === 0 && loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading looks…</p>
      ) : looks.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No looks match right now.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {looks.map((l) => (
            <article
              key={l.slug}
              className={`panel flex flex-col overflow-hidden ${l.hidden ? "opacity-50" : ""}`}
            >
              {l.images[0] ? (
                <img
                  src={l.images[0]}
                  referrerPolicy="no-referrer"
                  alt={l.title}
                  loading="lazy"
                  className="aspect-[3/4] w-full bg-secondary object-cover"
                />
              ) : (
                <div className="aspect-[3/4] w-full bg-secondary" />
              )}
              <div className="flex flex-1 flex-col p-3">
                <p className="line-clamp-2 text-sm leading-snug">{l.title}</p>
                {l.designer ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{l.designer}</p>
                ) : null}
                <div className="mt-auto pt-3">
                  {mode === "host" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={busy === l.slug}
                      onClick={() => toggleHidden(l)}
                    >
                      {l.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      {l.hidden ? "Show" : "Hide"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={busy !== null}
                      onClick={() => reserve(l)}
                    >
                      {busy === l.slug ? "Reserving…" : "Reserve"}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {more && looks.length > 0 ? (
        <div className="mt-6 text-center">
          <Button variant="outline" disabled={loading} onClick={() => load(page + 1, false)}>
            {loading ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
