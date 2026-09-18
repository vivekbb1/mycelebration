import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CalendarCheck, Ruler, Sparkles, Truck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FunctionCard, type WeddingFunction } from "@/components/function-card";
import { scheduleSummary } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/invitation")({
  head: () => ({
    meta: [
      { title: "Your Invitation — Kush & Khyati" },
      {
        name: "description",
        content:
          "Your personal wedding invitation: the functions you're invited to, your RSVP and the outfit chosen for you.",
      },
      { property: "og:title", content: "Your Invitation — Kush & Khyati" },
      {
        property: "og:description",
        content:
          "Every function you're invited to, with timings, venues, attire, your RSVP and your outfit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitationPage,
});

function InvitationPage() {
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, household, rsvp_status")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const myEventIds = useQuery({
    queryKey: ["my-event-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_event_ids");
      if (error) throw error;
      return new Set(((data ?? []) as { event_id: string }[]).map((r) => r.event_id));
    },
  });

  const events = useQuery({
    queryKey: ["events", "mine", [...(myEventIds.data ?? [])].sort().join(",")],
    enabled: myEventIds.isSuccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, event_date, start_time, venue, venue_address, dress_code, note, outfit_selection, sort_order",
        )
        .order("sort_order");
      if (error) throw error;
      const allowed = myEventIds.data;
      return allowed ? data.filter((e) => allowed.has(e.id)) : data;
    },
  });

  // Whether this family picks a look from us, per function.
  const myAccess = useQuery({
    queryKey: ["my-household-event-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_event_invites")
        .select("event_id, outfit_selection");
      if (error) throw error;
      return data;
    },
  });

  const myLooks = useQuery({
    queryKey: ["my-reservations", "invitation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("outfit_id, outfits(title, event_id)");
      if (error) throw error;
      return data;
    },
  });

  const lookByEvent = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of myLooks.data ?? []) {
      const outfit = row.outfits as { title: string; event_id: string | null } | null;
      if (outfit?.event_id) map.set(outfit.event_id, outfit.title);
    }
    return map;
  }, [myLooks.data]);

  const picksOutfit = (event: { id: string; outfit_selection: boolean | null }) => {
    if (event.outfit_selection === false) return false;
    const row = (myAccess.data ?? []).find((r) => r.event_id === event.id);
    return row ? row.outfit_selection !== false : true;
  };

  const firstName = (profile.data?.full_name ?? "").trim().split(" ")[0] ?? "";
  const rsvp = profile.data?.rsvp_status ?? "pending";
  const list = events.data ?? [];

  return (
    <main className="bg-zari">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <section className="invite-card p-8 text-center sm:p-12">
          <div className="relative">
            <p className="text-eyebrow">Together with our families</p>
            <h1 className="mt-6 text-5xl leading-none sm:text-6xl">
              Kush <span className="text-primary">&</span> Khyati
            </h1>
            <div className="gold-rule mx-auto mt-6 max-w-[16rem]" />
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {firstName ? `${firstName}, ` : ""}we would be honoured to have you with us.
              {list.length > 0
                ? ` ${scheduleSummary(list)} Below are the functions we've saved a place for you at.`
                : " Your functions will appear here as soon as they're confirmed."}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Badge variant={rsvp === "yes" ? "default" : "secondary"}>
                {rsvp === "yes"
                  ? "You've said yes"
                  : rsvp === "no"
                    ? "You've let us know you can't come"
                    : "We're still waiting for your reply"}
              </Badge>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <HubLink
            to="/event"
            icon={CalendarCheck}
            title={rsvp === "pending" ? "RSVP" : "Update your RSVP"}
            body="Tell us whether you'll join, and anything we should know."
          />
          <HubLink
            to="/lookbook"
            icon={Sparkles}
            title="Choose your outfit"
            body="Pick a look for each function — tailoring and delivery are on us."
          />
          <HubLink
            to="/measurements"
            icon={Ruler}
            title="Send measurements"
            body="A guided form with a tip for every measurement a tailor needs."
          />
        </section>

        <div className="gold-rule my-12" />

        <p className="text-center text-eyebrow">Your functions</p>

        {events.isLoading ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Opening your invitation…
          </p>
        ) : (
          <div className="mt-8 space-y-7">
            {list.map((ev) => (
              <FunctionCard
                key={ev.id}
                event={ev as WeddingFunction}
                picksOutfit={picksOutfit(ev)}
                chosenLook={lookByEvent.get(ev.id) ?? null}
              />
            ))}
            {list.length === 0 ? (
              <p className="panel p-6 text-center text-sm text-muted-foreground">
                The schedule is being finalised — your functions will appear here shortly.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-12 text-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/delivery">
              <Truck className="size-4" /> How your outfit reaches you
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function HubLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: "/event" | "/lookbook" | "/measurements";
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <Link to={to} className="panel block p-6 transition-shadow hover:shadow-glow">
      <Icon className="size-5 text-primary" />
      <h2 className="mt-4 text-xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Link>
  );
}
