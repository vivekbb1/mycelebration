import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Shirt, Sparkles, StickyNote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type WeddingFunction = {
  id: string;
  name: string;
  event_date: string | null;
  start_time: string | null;
  venue: string | null;
  venue_address: string | null;
  dress_code: string | null;
  note: string | null;
};

export const formatEventDate = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date to be confirmed";

/**
 * One function of the wedding, presented as an invitation card in the style of
 * the printed card: gold double frame, watercolour wash, engraved details.
 */
export function FunctionCard({
  event,
  picksOutfit = true,
  chosenLook = null,
  showOutfitAction = true,
}: {
  event: WeddingFunction;
  picksOutfit?: boolean;
  chosenLook?: string | null;
  showOutfitAction?: boolean;
}) {
  return (
    <article className="invite-card p-7 sm:p-9">
      <div className="relative">
        <p className="invite-ornament text-[0.65rem] tracking-[0.3em] uppercase">
          <Sparkles className="size-3" />
        </p>

        <h2 className="mt-4 text-center text-3xl leading-tight sm:text-4xl">{event.name}</h2>
        <p className="mt-2 text-center text-sm text-primary">{formatEventDate(event.event_date)}</p>

        <div className="gold-rule mx-auto mt-6 max-w-[14rem]" />

        <dl className="mx-auto mt-6 grid max-w-md gap-4 text-sm">
          {event.start_time ? (
            <Row icon={Clock} label="Timings" value={event.start_time} />
          ) : null}
          {event.venue ? (
            <Row
              icon={MapPin}
              label="Venue"
              value={event.venue}
              sub={event.venue_address ?? undefined}
            />
          ) : null}
          {event.dress_code ? (
            <Row icon={Shirt} label="Attire" value={event.dress_code} />
          ) : null}
          {event.note ? <Row icon={StickyNote} label="Good to know" value={event.note} /> : null}
        </dl>

        {showOutfitAction ? (
          <div className="mt-7 flex flex-col items-center gap-3">
            {picksOutfit ? (
              <>
                {chosenLook ? (
                  <Badge>Your look: {chosenLook}</Badge>
                ) : (
                  <Badge variant="secondary">Outfit is our gift to you</Badge>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to="/lookbook">
                    {chosenLook ? "Change your look" : `Choose your look for the ${event.name}`}
                  </Link>
                </Button>
              </>
            ) : (
              <Badge variant="secondary">Please wear your own outfit for this function</Badge>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string | undefined;
}) {
  return (
    <div className="flex justify-center gap-3 text-center sm:text-left">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <dt className="text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">{label}</dt>
        <dd className="mt-1 leading-relaxed">{value}</dd>
        {sub ? <dd className="mt-0.5 text-xs text-muted-foreground">{sub}</dd> : null}
      </div>
    </div>
  );
}
