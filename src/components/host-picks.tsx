import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Check, Minus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Who has picked a look for which function. Functions where guests wear their
 * own outfit are left out entirely — there is nothing to pick there.
 */
export function HostPicks() {
  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("sort_order");
      if (error) throw error;
      return data;
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

  const loading =
    events.isLoading || guests.isLoading || outfits.isLoading || reservations.isLoading;

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <h2 className="text-xl">Outfit picks per guest</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One column per function that guests choose a look for.
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
            No function has outfit selection switched on yet.
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
                            {missing} function{missing > 1 ? "s" : ""}
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
    </div>
  );
}
