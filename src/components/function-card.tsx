import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Shirt, Sparkles, StickyNote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/lib/site-content";

export type WeddingFunction = {
  id: string;
  name: string;
  event_date: string | null;
  start_time: string | null;
  venue: string | null;
  venue_address: string | null;
  dress_code: string | null;
  note: string | null;
  background_image_url?: string | null;
  outfit_choose_by?: string | null;
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
 * One event of the wedding, presented as an invitation card in the style of
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
  const { t } = useSiteContent();
  const eventName = /^the\s/i.test(event.name) ? event.name : `the ${event.name}`;

  const background = event.background_image_url?.trim() || null;

  return (
    <article className="invite-card flex h-full flex-col overflow-hidden p-6 sm:p-9">
      {background ? (
        <>
          <img
            src={background}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full rounded-[inherit] object-cover"
          />
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-surface/80 backdrop-blur-[1px]" />
        </>
      ) : null}
      <div className="relative flex flex-1 flex-col">
        <p className="invite-ornament text-[0.65rem] tracking-[0.3em] uppercase">
          <Sparkles className="size-3" />
        </p>

        <h2 className="mt-4 text-center text-3xl leading-tight sm:text-4xl">{event.name}</h2>
        <p className="mt-2 text-center text-sm text-primary">{formatEventDate(event.event_date)}</p>

        <div className="gold-rule mx-auto mt-6 max-w-[14rem]" />

        <dl className="mx-auto mt-6 grid w-full max-w-sm gap-4 text-left text-sm">
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
          <div className="mt-auto flex flex-col items-center gap-3 pt-7">
            {picksOutfit ? (
              <>
                {chosenLook ? (
                  <Badge>
                    {t("card.look_prefix", "Your look:")} {chosenLook}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {t("card.gift_badge", "With compliments from the family")}
                  </Badge>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to="/guest/outfits">
                    {chosenLook
                      ? t("card.change_cta", "Change your look")
                      : `${t("card.choose_prefix", "Choose your look for")} ${eventName}`}
                  </Link>
                </Button>
                {event.outfit_choose_by && !chosenLook ? (
                  <p className="text-xs text-muted-foreground">
                    {new Date().toISOString().slice(0, 10) > event.outfit_choose_by
                      ? "Choices closed on "
                      : "Choose by "}
                    {new Date(`${event.outfit_choose_by}T00:00:00`).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                ) : null}
              </>
            ) : null}
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
    <div className="flex items-start gap-3 text-left">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <dt className="text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">{label}</dt>
        <dd className="mt-1 leading-relaxed">{value}</dd>
        {sub ? <dd className="mt-0.5 text-xs text-muted-foreground">{sub}</dd> : null}
      </div>
    </div>
  );
}
