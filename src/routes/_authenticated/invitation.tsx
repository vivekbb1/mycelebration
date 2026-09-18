import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowRight, CalendarCheck, Check, Ruler, Sparkles, Truck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FunctionCard, type WeddingFunction } from "@/components/function-card";
import { scheduleSummary } from "@/lib/schedule";
import { useSiteContent } from "@/lib/site-content";
import { useNeedsWardrobe } from "@/lib/wardrobe";

export const Route = createFileRoute("/_authenticated/invitation")({
  head: () => ({
    meta: [
      { title: "Your Invitation — Reply, Outfit & Measurements" },
      {
        name: "description",
        content:
          "Your personal wedding invitation in three simple steps: reply, choose your outfit, send your measurements.",
      },
      { property: "og:title", content: "Your Invitation — Reply, Outfit & Measurements" },
      {
        property: "og:description",
        content:
          "Three steps: tell us if you're coming, choose the outfit we've set aside for you, send your measurements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitationPage,
});

type StepTarget = "/event" | "/lookbook" | "/measurements";

function InvitationPage() {
  const { t } = useSiteContent();
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
          "id, name, event_date, start_time, venue, venue_address, dress_code, note, outfit_selection, sort_order, background_image_url",
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

  const myMeasurements = useQuery({
    queryKey: ["my-measurements", "invitation"],
    queryFn: async () => {
      const { data, error } = await supabase.from("measurements").select("id").limit(1);
      if (error) throw error;
      return data ?? [];
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

  const { needsWardrobe } = useNeedsWardrobe();
  const firstName = (profile.data?.full_name ?? "").trim().split(" ")[0] ?? "";
  const rsvp = profile.data?.rsvp_status ?? "pending";
  const list = events.data ?? [];

  const outfitFunctions = list.filter((ev) => picksOutfit(ev));
  const chosenCount = outfitFunctions.filter((ev) => lookByEvent.has(ev.id)).length;
  const needsOutfits = outfitFunctions.length > 0;

  const rsvpDone = rsvp === "yes" || rsvp === "no";
  const outfitsDone = !needsOutfits || (chosenCount > 0 && chosenCount === outfitFunctions.length);
  const measurementsDone = (myMeasurements.data ?? []).length > 0;

  const allSteps: {
    to: StepTarget;
    icon: typeof Sparkles;
    title: string;
    body: string;
    done: boolean;
    status: string;
    cta: string;
  }[] = [
    {
      to: "/event",
      icon: CalendarCheck,
      title: t("step.rsvp_title", "Tell us if you're coming"),
      body: t(
        "step.rsvp_body",
        "A yes or no, plus anything we should know — arrival day, food, who's travelling with you.",
      ),
      done: rsvpDone,
      status:
        rsvp === "yes"
          ? "You've said yes"
          : rsvp === "no"
            ? "You've let us know you can't come"
            : "Not answered yet",
      cta: rsvpDone
        ? t("step.rsvp_cta_done", "Change your answer")
        : t("step.rsvp_cta", "Reply now"),
    },
    {
      to: "/lookbook",
      icon: Sparkles,
      title: t("step.outfit_title", "Choose your outfit"),
      body: needsOutfits
        ? t(
            "step.outfit_body",
            "Pick a look for each function where the outfit is our gift to you.",
          )
        : t(
            "step.outfit_body_own",
            "For your functions you'll wear your own outfit — nothing to choose here.",
          ),
      done: outfitsDone,
      status: !needsOutfits
        ? "Not needed"
        : chosenCount === 0
          ? `Nothing chosen yet · ${outfitFunctions.length} to choose`
          : chosenCount === outfitFunctions.length
            ? "All chosen"
            : `${chosenCount} of ${outfitFunctions.length} chosen`,
      cta:
        chosenCount > 0
          ? t("step.outfit_cta_done", "See or change your looks")
          : t("step.outfit_cta", "Choose a look"),
    },
    {
      to: "/measurements",
      icon: Ruler,
      title: t("step.measure_title", "Send your measurements"),
      body: t(
        "step.measure_body",
        "So your outfit is tailored before you arrive. Every field has a tip to help you measure.",
      ),
      done: measurementsDone,
      status: measurementsDone ? "Sent — thank you" : "Not sent yet",
      cta: measurementsDone
        ? t("step.measure_cta_done", "Update measurements")
        : t("step.measure_cta", "Send measurements"),
    },
  ];

  // RSVP-only families have nothing to choose and nothing to measure.
  const steps = allSteps.filter((step) => needsWardrobe || step.to === "/event");

  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done) ?? null;
  const couple = t("invitation.couple", "Our Wedding");
  const coupleParts = couple.split("&").map((part) => part.trim());

  return (
    <main className="bg-zari">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <section className="invite-card p-8 text-center sm:p-12">
          <div className="relative">
            <p className="text-eyebrow">
              {t("invitation.eyebrow", "Together with our families")}
            </p>
            <h1 className="mt-6 text-5xl leading-none sm:text-6xl">
              {coupleParts.length === 2 ? (
                <>
                  {coupleParts[0]} <span className="text-primary">&</span> {coupleParts[1]}
                </>
              ) : (
                couple
              )}
            </h1>
            <div className="gold-rule mx-auto mt-6 max-w-[16rem]" />
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {firstName ? `${firstName}, ` : ""}
              {t("invitation.greeting", "we would be honoured to have you with us.")}
              {list.length > 0 ? ` ${scheduleSummary(list)}` : ""}
            </p>
          </div>
        </section>

        <section className="panel mt-8 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-eyebrow">
                {t("invitation.steps_eyebrow", "Three simple steps")}
              </p>
              <h2 className="mt-3 text-2xl">
                {doneCount === steps.length
                  ? t("invitation.steps_title_done", "You're all set")
                  : t("invitation.steps_title_open", "Here's what's left to do")}
              </h2>
            </div>
            <Badge variant={doneCount === steps.length ? "default" : "secondary"}>
              {doneCount} of {steps.length} done
            </Badge>
          </div>

          <div className="mt-5 flex gap-2" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          <ol className="mt-7 space-y-4">
            {steps.map((step, i) => (
              <li key={step.to}>
                <Link
                  to={step.to}
                  className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/60"
                >
                  <span
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm ${
                      step.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {step.done ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-display text-xl">{step.title}</span>
                      <span className="text-xs text-muted-foreground">{step.status}</span>
                    </span>
                    <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </span>
                  </span>
                  <step.icon className="mt-1 size-5 shrink-0 text-primary" />
                </Link>
              </li>
            ))}
          </ol>

          {nextStep ? (
            <Button asChild className="mt-6 w-full sm:w-auto">
              <Link to={nextStep.to}>
                {nextStep.cta} <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <p className="mt-6 text-sm whitespace-pre-line text-muted-foreground">
              {t(
                "invitation.all_done_note",
                "Everything's done — we'll be in touch about delivery. You can still change any answer.",
              )}
            </p>
          )}
        </section>

        <div className="gold-rule my-12" />

        <p className="text-center text-eyebrow">
          {t("invitation.functions_title", "Your functions")}
        </p>

        {events.isLoading ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Opening your invitation…</p>
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
              <Truck className="size-4" />{" "}
              {t("invitation.delivery_cta", "How your outfit reaches you")}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
