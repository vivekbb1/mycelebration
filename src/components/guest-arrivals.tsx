import { useQuery } from "@tanstack/react-query";
import { BedDouble, Car } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<string, string> = {
  pickup: "Pick-up",
  dropoff: "Drop-off",
  transfer: "Transfer",
};

const timeLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "time to follow";

const dayLabel = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "date to follow";


/** What a guest sees: the car collecting them and the room they've been given. */
export function GuestArrivals({ household }: { household: string }) {
  const rides = useQuery({
    queryKey: ["my-transport", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_transport")
        .select("*")
        .eq("household", household)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stays = useQuery({
    queryKey: ["my-stay", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_stays")
        .select("*")
        .eq("household", household)
        .order("checkin_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rideList = rides.data ?? [];
  const stayList = stays.data ?? [];
  if (rideList.length === 0 && stayList.length === 0) return null;

  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="text-xl">Getting you there</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your hosts have arranged these for you. Anything not right, just let them know.
      </p>

      {rideList.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {rideList.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Car className="size-4 text-primary" />
                <p className="text-sm">{KIND_LABEL[r.kind] ?? r.kind}</p>
                <Badge variant="outline">{r.status}</Badge>
                <span className="text-xs text-muted-foreground">{timeLabel(r.scheduled_at)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[r.from_place, r.to_place].filter(Boolean).join(" → ")}
                {r.flight ? ` · flight ${r.flight}` : ""}
                {r.driver_name ? ` · ${r.driver_name}` : ""}
                {r.driver_phone ? ` · ${r.driver_phone}` : ""}
                {r.vehicle ? ` · ${r.vehicle}` : ""}
              </p>
              {r.notes ? <p className="mt-1 text-xs">{r.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {stayList.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {stayList.map((s) => (
            <li key={s.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <BedDouble className="size-4 text-primary" />
                <p className="text-sm">{s.hotel_name ?? "Your hotel"}</p>
                {s.room_number ? <Badge variant="outline">Room {s.room_number}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.hotel_address ? `${s.hotel_address} · ` : ""}
                {s.checkin_date ? `check in ${dayLabel(s.checkin_date)}` : ""}
                {s.checkout_date ? ` · check out ${dayLabel(s.checkout_date)}` : ""}
                {s.room_type ? ` · ${s.room_type}` : ""}
                {s.host_contact ? ` · any trouble, call ${s.host_contact}` : ""}
              </p>
              {s.notes ? <p className="mt-1 text-xs">{s.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
