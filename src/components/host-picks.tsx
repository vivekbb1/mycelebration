import { missingOutfitEvents } from "@/lib/outfit-pick-progress";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, Mail, Minus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { sendOutfitReminder } from "@/lib/outfit-reminder.functions";
import { useSelectedEvent } from "@/lib/selected-event";
import { HostFamilyPicks } from "@/components/host-family-picks";

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
      const { data, error } = await supabase.from("reservations").select("id, outfit_id, guest_id, guest_name, outfits(event_id)");
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

  /** The guest list as invited (invitation codes), so reminders can go out by email. */
  const invited = useQuery({
    queryKey: ["host-picks-invited", selectedInvite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, email, claimed_by, household, invite_id, gender")
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

  const access = useQuery({
    queryKey: ["family-picks-access", selectedInvite],
    queryFn: async () => {
      if (!selectedInvite) return [];
      const { data, error } = await supabase.from("household_event_invites")
        .select("household, event_id, outfit_selection, invite_id").eq("invite_id", selectedInvite);
      if (error) throw error;
      return data ?? [];
    },
  });
  const kids = useQuery({
    queryKey: ["family-picks-kids", selectedInvite],
    queryFn: async () => {
      const ids = pickable.map((e) => e.id);
      if (!ids.length) return new Set<string>();
      const [outfits, feeds] = await Promise.all([
        supabase.from("outfits").select("event_id, gender").in("event_id", ids).in("gender", ["boy", "girl"]),
        supabase.from("outfit_feeds").select("event_id, audience").in("event_id", ids).in("audience", ["boy", "girl"]),
      ]);
      if (outfits.error) throw outfits.error;
      if (feeds.error) throw feeds.error;
      return new Set([
        ...(outfits.data ?? []).map((o) => `${o.event_id}|${o.gender}`),
        ...(feeds.data ?? []).map((f) => `${f.event_id}|${f.audience}`),
      ]);
    },
  });
  const toRemind = useMemo(() => (invited.data ?? [])
    .map((g) => {
      const missing = missingOutfitEvents(g, invited.data ?? [], pickable, access.data ?? [], reservations.data ?? [], kids.data ?? new Set());
      const familyEmail = (invited.data ?? []).find((m) => m.household === g.household && m.email)?.email;
      return { ...g, missing, contactEmail: g.email || familyEmail };
    })
    .filter((g) => g.missing.length > 0),
    [invited.data, pickable, access.data, reservations.data, kids.data]);

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

        {invited.isLoading || loading || access.isLoading || kids.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : toRemind.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Everyone has chosen their looks.
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
                  disabled={sending === g.id || !g.contactEmail}
                  onClick={() => sendReminder(g.id, g.guest_name)}
                >
                  <Mail className="mr-2 size-3.5" />
                  {sending === g.id ? "Sending…" : !g.contactEmail ? "No family email" : "Send reminder"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <HostFamilyPicks
        inviteId={selectedInvite ?? null}
        events={events.data ?? []}
        measurements={(measurements.data ?? []) as Array<{ guest_id: string; guest_name: string | null }>}
      />


      <div className="panel p-4 sm:p-6">
        <h2 className="text-xl">Measurements</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What each guest has sent for their tailoring, in the units they chose.
        </p>
        {measurements.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (measurements.data ?? []).filter((m) => sortedGuests.some((g) => g.id === m.guest_id)).length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Nobody has sent their measurements yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {(measurements.data ?? []).filter((m) => sortedGuests.some((g) => g.id === m.guest_id)).map((m) => {
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
