import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { scheduleEyebrow, scheduleHeadline, scheduleSummary } from "@/lib/schedule";
import { Check, X, HelpCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSiteContent } from "@/lib/site-content";
import { GuestTravel } from "@/components/guest-travel";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Your Schedule — Dates, Venues & Replies" },
      {
        name: "description",
        content:
          "The functions you're invited to: dates, timings, venues, dress codes, head counts and your replies.",
      },
      { property: "og:title", content: "Your Schedule — Dates, Venues & Replies" },
      {
        property: "og:description",
        content:
          "Your functions with timings, venues and dress codes — reply for each one and add travel details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventPage,
});

const formatDate = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date to be confirmed";

function EventPage() {
  const { t } = useSiteContent();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteTouched, setNoteTouched] = useState(false);

  // Only the functions this family is invited to.
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
          "id, name, event_date, start_time, venue, venue_address, dress_code, note, rsvp_by, sort_order, background_image_url",
        )
        .order("sort_order");
      if (error) throw error;
      const allowed = myEventIds.data;
      return allowed ? data.filter((e) => allowed.has(e.id)) : data;
    },
  });

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, rsvp_status, rsvp_note")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const currentNote = noteTouched ? note : (profile.data?.rsvp_note ?? "");

  const saveRsvp = async (status: "yes" | "no") => {
    if (!profile.data) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        rsvp_status: status,
        rsvp_note: currentNote.trim() || null,
        rsvp_updated_at: new Date().toISOString(),
      })
      .eq("id", profile.data.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      status === "yes"
        ? t("rsvp.thanks_yes", "Wonderful — you're on the list.")
        : t("rsvp.thanks_no", "Thank you for letting us know."),
    );
    setNoteTouched(false);
    await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    // Saying yes takes them straight to what's expected of them (outfit slots, dates).
    if (status === "yes") navigate({ to: "/plan" });
  };

  const rsvp = profile.data?.rsvp_status ?? "pending";
  const rsvpBy = events.data?.find((e) => e.rsvp_by)?.rsvp_by ?? null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-eyebrow">{scheduleEyebrow(events.data ?? [])}</p>
      <h1 className="mt-3 text-4xl">{scheduleHeadline(events.data ?? [])}</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        {scheduleSummary(events.data ?? [])}{" "}
        {t(
          "rsvp.dress_note",
          "Dress codes are guidance, not rules — but red and ivory are reserved for the couple.",
        )}{" "}
        Once you know which functions you'll join,{" "}
        <Link to="/outfits" className="text-primary underline-offset-4 hover:underline">
          reserve your looks in the lookbook
        </Link>
        .
      </p>

      <section className="panel mt-8 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl">{t("rsvp.title", "Your RSVP")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {rsvpBy ? `Please let us know by ${formatDate(rsvpBy)}.` : "Please let us know soon."}
            </p>
          </div>
          <Badge variant={rsvp === "yes" ? "default" : "secondary"}>
            {rsvp === "yes" ? (
              <>
                <Check className="size-3" /> Attending
              </>
            ) : rsvp === "no" ? (
              <>
                <X className="size-3" /> Can't make it
              </>
            ) : (
              <>
                <HelpCircle className="size-3" /> Awaiting your answer
              </>
            )}
          </Badge>
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="rsvp-note">
            {t("rsvp.note_label", "Anything we should know? (optional)")}
          </Label>
          <Textarea
            id="rsvp-note"
            rows={3}
            maxLength={600}
            value={currentNote}
            placeholder={t(
              "rsvp.note_placeholder",
              "Arrival date, dietary needs, travelling with family…",
            )}
            onChange={(e) => {
              setNoteTouched(true);
              setNote(e.target.value);
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => saveRsvp("yes")}>
            {rsvp === "yes"
              ? t("rsvp.yes_update", "Update — I'll be there")
              : t("rsvp.yes_cta", "I'll be there")}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => saveRsvp("no")}>
            {t("rsvp.no_cta", "Sadly can't make it")}
          </Button>
        </div>
      </section>

      <GuestTravel events={events.data ?? []} />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Dates, venues and dress codes for each function are on{" "}
        <Link to="/invite" className="text-primary underline-offset-4 hover:underline">
          your invitation
        </Link>
        .
      </p>
    </main>
  );
}
