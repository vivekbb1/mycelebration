import { useQuery } from "@tanstack/react-query";
import { Plane } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const dateLabel = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "—";

/** Arrival and departure details guests have given, shown on the RSVP board. */
export function HostFlights() {
  const plans = useQuery({
    queryKey: ["all-travel-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_plans")
        .select("*")
        .order("household");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = plans.data ?? [];

  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <Plane className="size-4 text-primary" /> Flights
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No travel details yet — guests fill these in on their schedule page.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Family / person</th>
                <th className="py-2 pr-4">Guests</th>
                <th className="py-2 pr-4">Arrives</th>
                <th className="py-2 pr-4">Leaves</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="py-3 pr-4">
                    <p>{p.household}</p>
                    {p.guest_name ? (
                      <p className="text-xs text-muted-foreground">{p.guest_name}</p>
                    ) : (
                      <Badge variant="outline" className="mt-1">
                        whole family
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 pr-4">{p.party_size ?? "—"}</td>
                  <td className="py-3 pr-4">
                    {dateLabel(p.arrival_date)}
                    {p.arrival_time ? ` · ${p.arrival_time}` : ""}
                    {p.arrival_flight ? (
                      <span className="block text-xs text-muted-foreground">{p.arrival_flight}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">
                    {dateLabel(p.departure_date)}
                    {p.departure_time ? ` · ${p.departure_time}` : ""}
                    {p.departure_flight ? (
                      <span className="block text-xs text-muted-foreground">
                        {p.departure_flight}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-muted-foreground">{p.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
