import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, Mail, Minus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { sendOutfitReminder } from "@/lib/outfit-reminder.functions";
import { useSelectedEvent } from "@/lib/selected-event";

/** Plain-English reasons a reminder didn't go out. */
const reminderReasons: Record<string, string> = {
  no_email: "no email address saved for this guest",
  already_chosen: "they've already chosen",
  nothing_to_choose: "nothing to choose for them",
  email_turned_off: "email sending is switched off",
  lovable_domain_not_set_up: "your sender domain isn't set up yet",
  from_address_missing: "no from address saved",
  api_key_missing: "the email service key is missing",
};

/**
 * Who has picked a look for which event. Events where guests wear their
 * own outfit are left out entirely — there is nothing to pick there.
 */
export function HostPicks() {
  const { inviteId: selectedInvite } = useSelectedEvent();

  const events = useQuery({
    queryKey: ["events", selectedInvite],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("sort_order");
      if (error) throw error;
      // Only the celebration being worked on.
      return (data ?? []).filter((e) => !selectedInvite || e.invite_id === selectedInvite);
    },
  });

  const guests = useQuery({
    queryKey: ["host-guests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, rsvp_status, household, gender")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["host-picks-outfits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("outfits").select("id, title, event_id");
      if (error) throw error;
      return data;
    },
  });

  const reservations = useQuery({
    queryKey: ["host-picks-reservations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reservations").select("id, outfit_id, guest_id");
      if (error) throw error;
      return data;
    },
  });

  /** Every guest's measurements, so the tailor's numbers sit beside their look. */
  const measurements = useQuery({
    queryKey: ["host-picks-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .order("guest_name");
      if (error) throw error;
      return data;
    },
  });

  const pickable = (events.data ?? []).filter((e) => e.outfit_selection !== false);
  const ownOutfit = (events.data ?? []).filter((e) => e.outfit_selection === false);

  const outfitById = useMemo(
    () => new Map((outfits.data ?? []).map((o) => [o.id, o])),
    [outfits.data],
  );

  /** guestId -> eventId -> outfit title */
  const picks = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const r of reservations.data ?? []) {
      const outfit = outfitById.get(r.outfit_id);
      if (!outfit) continue;
      const key = outfit.event_id ?? "any";
      const forGuest = map.get(r.guest_id) ?? new Map<string, string>();
      forGuest.set(key, outfit.title);
      map.set(r.guest_id, forGuest);
    }
    return map;
  }, [reservations.data, outfitById]);

  /** The guest list as invited (invitation codes), so reminders can go out by email. */
  const invited = useQuery({
    queryKey: ["host-picks-invited", selectedInvite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, email, claimed_by, household, invite_id")
        .order("guest_name");
      if (error) throw error;
      return (data ?? []).filter((g) => !selectedInvite || g.invite_id === selectedInvite);
    },
  });

  /** Families stay together, so a couple's picks sit side by side.
   *  Only people holding an invitation in this celebration are listed —
   *  hosts and stray accounts never appear. */
  const sortedGuests = useMemo(() => {
    const onList = new Set(
      (invited.data ?? []).map((g) => g.claimed_by).filter((v): v is string => Boolean(v)),
    );
    return [...(guests.data ?? [])]
      .filter((g) => onList.has(g.id))
      .sort(
        (a, b) =>
          ((a.household as string | null) ?? "zzzz").localeCompare(
            (b.household as string | null) ?? "zzzz",
          ) || (a.full_name ?? "").localeCompare(b.full_name ?? ""),
      );
  }, [guests.data, invited.data]);

  const loading =
    events.isLoading || guests.isLoading || outfits.isLoading || reservations.isLoading;

  const remind = useServerFn(sendOutfitReminder);
  const [sending, setSending] = useState<string | null>(null);

  /** Guests with an email who still have at least one look to choose. */
  const toRemind = useMemo(() => {
    if (pickable.length === 0) return [];
    return (invited.data ?? [])
      .filter((g) => g.email)
      .map((g) => {
        const chosen = g.claimed_by ? picks.get(g.claimed_by) : undefined;
        const missing = pickable.filter((ev) => !chosen?.get(ev.id));
        return { ...g, missing };
      })
      .filter((g) => g.missing.length > 0);
  }, [invited.data, picks, pickable]);

  async function sendReminder(id: string, name: string) {
    setSending(id);
    try {
      const result = await remind({ data: { inviteId: id } });
      if (result.sent) toast.success(`Reminder sent to ${name}`);
      else
        toast.error(
          `Couldn't remind ${name} — ${reminderReasons[result.reason ?? ""] ?? "the email didn't go out"}`,
        );
    } catch {
      toast.error(`Couldn't remind ${name} just now`);
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="panel p-4 sm:p-6">
        <h2 className="text-xl">Nudge guests who haven't chosen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A short email listing the days still waiting on them, with a link to the wardrobe.
        </p>

        {invited.isLoading || loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : toRemind.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Everyone with an email address has chosen their looks.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-border">
            {toRemind.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{g.guest_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.missing.map((e) => e.name).join(", ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sending === g.id}
                  onClick={() => sendReminder(g.id, g.guest_name)}
                >
                  <Mail className="mr-2 size-3.5" />
                  {sending === g.id ? "Sending…" : "Send reminder"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel p-4 sm:p-6">
        <h2 className="text-xl">Outfit picks per guest</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One column per event that guests choose a look for.
          {ownOutfit.length > 0
            ? ` ${ownOutfit.map((e) => e.name).join(", ")} ${
                ownOutfit.length > 1 ? "are" : "is"
              } own-outfit, so nothing is tracked there.`
            : ""}
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : pickable.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No event has outfit selection switched on yet.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-normal">Guest</th>
                  {pickable.map((ev) => (
                    <th key={ev.id} className="py-2 pr-4 font-normal">
                      {ev.name}
                    </th>
                  ))}
                  <th className="py-2 font-normal">Still to pick</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedGuests.map((g) => {
                  const forGuest = picks.get(g.id);
                  const missing = pickable.filter((ev) => !forGuest?.get(ev.id)).length;
                  return (
                    <tr key={g.id}>
                      <td className="py-3 pr-4">
                        <p className="truncate">{g.full_name || g.email || "Guest"}</p>
                        {g.household ? (
                          <p className="truncate text-xs text-primary">{g.household}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {g.rsvp_status}
                          {g.gender ? ` · ${g.gender === "men" ? "menswear" : "womenswear"}` : ""}
                        </p>
                      </td>
                      {pickable.map((ev) => {
                        const title = forGuest?.get(ev.id);
                        return (
                          <td key={ev.id} className="py-3 pr-4 align-top">
                            {title ? (
                              <span className="flex items-start gap-1 text-primary">
                                <Check className="mt-0.5 size-3.5 shrink-0" />
                                <span className="text-xs">{title}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Minus className="size-3.5" />
                                <span className="text-xs">Not chosen</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 text-xs">
                        {missing === 0 ? (
                          <span className="text-primary">All set</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {missing} event{missing > 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(guests.data ?? []).length === 0 ? (
                  <tr>
                    <td className="py-4 text-sm text-muted-foreground" colSpan={pickable.length + 2}>
                      No guests have signed in yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel p-4 sm:p-6">
        <h2 className="text-xl">Measurements</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What each guest has sent for their tailoring, in the units they chose.
        </p>
        {measurements.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (measurements.data ?? []).length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Nobody has sent their measurements yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {(measurements.data ?? []).map((m) => {
              const unit = (m.unit as string | null) ?? "cm";
              const guest = (guests.data ?? []).find((g) => g.id === m.guest_id);
              const fields: Array<[string, unknown]> = [
                ["Height", m.height],
                ["Bust / chest", m.bust],
                ["Waist", m.waist],
                ["Hip", m.hip],
                ["Shoulder", m.shoulder],
                ["Sleeve", m.sleeve_length],
                ["Blouse / kurta length", m.top_length],
                ["Skirt / trouser length", m.bottom_length],
                ["Inseam", m.inseam],
              ];
              const given = fields.filter(([, v]) => v !== null && v !== undefined);
              return (
                <div key={m.id as string} className="rounded-xl border border-border p-4">
                  <p className="text-sm">
                    {(m.guest_name as string) || guest?.full_name || "Guest"}
                    {guest?.household ? (
                      <span className="text-xs text-primary"> · {guest.household}</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground"> · in {unit}</span>
                  </p>
                  {given.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">Nothing filled in yet.</p>
                  ) : (
                    <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                      {given.map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-3">
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd className="text-sm">
                            {String(value)} {unit}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {m.notes ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Note for the tailor: {m.notes as string}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
