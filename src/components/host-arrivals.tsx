import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Car, BedDouble, Mail, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSelectedEvent } from "@/lib/selected-event";
import { sendArrivalDetails } from "@/lib/arrival-email.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const RIDE_STATUS = ["planned", "driver on the way", "guest met", "dropped off", "cancelled"];
const STAY_STATUS = ["to assign", "room held", "checked in", "checked out"];
const KINDS = [
  { value: "pickup", label: "Pick-up" },
  { value: "dropoff", label: "Drop-off" },
  { value: "transfer", label: "Transfer" },
];

const emailReasons: Record<string, string> = {
  no_email: "no email address on file",
  nothing_to_send: "nothing assigned to them yet",
  guest_not_found: "guest not found",
  forbidden: "hosts only",
  email_turned_off: "email sending is switched off",
  lovable_domain_not_set_up: "your sender domain isn't set up yet",
  from_address_missing: "no from address saved",
  api_key_missing: "the email service key is missing",
  email_not_configured: "email sending isn't set up yet",
  network_error: "the email service couldn't be reached",
  send_failed: "please try again",
};


const timeLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "time to follow";

/** Cars and drivers for arrivals and departures, plus hotel rooms and check-in. */
export function HostArrivals() {
  const queryClient = useQueryClient();
  const { inviteId: selectedEvent } = useSelectedEvent();
  const sendEmail = useServerFn(sendArrivalDetails);
  const [sending, setSending] = useState<string | null>(null);
  const [ride, setRide] = useState({
    household: "",
    guest_name: "",
    kind: "pickup",
    vendor_id: "",
    driver_name: "",
    driver_phone: "",
    vehicle: "",
    from_place: "Airport",
    to_place: "",
    scheduled_at: "",
    flight: "",
    notes: "",
  });
  const [stay, setStay] = useState({
    household: "",
    guest_name: "",
    hotel_name: "",
    hotel_address: "",
    room_number: "",
    room_type: "",
    checkin_date: "",
    checkout_date: "",
    host_contact: "",
    notes: "",
  });

  const guests = useQuery({
    queryKey: ["arrivals-guests", selectedEvent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, household, email, invite_id")
        .order("guest_name");
      if (error) throw error;
      return (data ?? []).filter((g) => !selectedEvent || !g.invite_id || g.invite_id === selectedEvent);
    },
  });

  const vendors = useQuery({
    queryKey: ["arrivals-vendors", selectedEvent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, category, invite_id")
        .order("name");
      if (error) throw error;
      return (data ?? []).filter((v) => !selectedEvent || !v.invite_id || v.invite_id === selectedEvent);
    },
  });

  const rides = useQuery({
    queryKey: ["guest-transport", selectedEvent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_transport")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((r) => !selectedEvent || !r.invite_id || r.invite_id === selectedEvent);
    },
  });

  const stays = useQuery({
    queryKey: ["guest-stays", selectedEvent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_stays")
        .select("*")
        .order("checkin_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((s) => !selectedEvent || !s.invite_id || s.invite_id === selectedEvent);
    },
  });

  /** Each family's reply, worked out from the events they've said yes or no to. */
  const replies = useQuery({
    queryKey: ["household-rsvp-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("household_rsvp_summary");
      if (error) throw error;
      const map = new Map<string, { status: string; yes: number; answered: number }>();
      for (const row of (data ?? []) as {
        household: string;
        status: string;
        events_yes: number;
        events_answered: number;
      }[]) {
        map.set(row.household, {
          status: row.status,
          yes: row.events_yes,
          answered: row.events_answered,
        });
      }
      return map;
    },
  });

  const replyOf = (household: string) => replies.data?.get(household);

  const replyLabel = (household: string) => {
    const r = replyOf(household);
    if (!r) return "no answer yet";
    if (r.status === "no") return "can't come";
    return `coming to ${r.yes} of ${r.answered}`;
  };

  /** Families on this celebration, so a car or a room is always tied to one. */
  const households = useMemo(() => {
    const set = new Set<string>();
    for (const g of guests.data ?? []) if (g.household) set.add(g.household);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [guests.data]);


  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["guest-transport"] });
    await queryClient.invalidateQueries({ queryKey: ["guest-stays"] });
    await queryClient.invalidateQueries({ queryKey: ["household-rsvp-summary"] });
  };

  const addRide = async () => {
    if (!ride.household) {
      toast.error("Choose which family this car is for");
      return;
    }
    const { error } = await supabase.from("guest_transport").insert({
      invite_id: selectedEvent || null,
      household: ride.household,
      guest_name: ride.guest_name.trim() || null,
      kind: ride.kind,
      vendor_id: ride.vendor_id || null,
      driver_name: ride.driver_name.trim() || null,
      driver_phone: ride.driver_phone.trim() || null,
      vehicle: ride.vehicle.trim() || null,
      from_place: ride.from_place.trim() || null,
      to_place: ride.to_place.trim() || null,
      scheduled_at: ride.scheduled_at ? new Date(ride.scheduled_at).toISOString() : null,
      flight: ride.flight.trim() || null,
      notes: ride.notes.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Car added");
    setRide({ ...ride, guest_name: "", driver_name: "", driver_phone: "", vehicle: "", to_place: "", scheduled_at: "", flight: "", notes: "" });
    await refresh();
  };

  const addStay = async () => {
    if (!stay.household) {
      toast.error("Choose which family this room is for");
      return;
    }
    const { error } = await supabase.from("guest_stays").insert({
      invite_id: selectedEvent || null,
      household: stay.household,
      guest_name: stay.guest_name.trim() || null,
      hotel_name: stay.hotel_name.trim() || null,
      hotel_address: stay.hotel_address.trim() || null,
      room_number: stay.room_number.trim() || null,
      room_type: stay.room_type.trim() || null,
      checkin_date: stay.checkin_date || null,
      checkout_date: stay.checkout_date || null,
      host_contact: stay.host_contact.trim() || null,
      notes: stay.notes.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Room added");
    setStay({ ...stay, guest_name: "", room_number: "", notes: "" });
    await refresh();
  };

  const setRideStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("guest_transport").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const setStayStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("guest_stays").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const removeRow = async (table: "guest_transport" | "guest_stays", id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const emailDetails = async (household: string) => {
    const people = (guests.data ?? []).filter((g) => g.household === household && g.email);
    if (people.length === 0) {
      toast.error("No email address on this family");
      return;
    }
    setSending(household);
    let sent = 0;
    let reason = "";
    for (const p of people) {
      try {
        const res = await sendEmail({ data: { inviteId: p.id } });
        if (res.sent) sent += 1;
        else reason = res.reason ?? "";
      } catch {
        reason = "send_failed";
      }
    }
    setSending(null);
    if (sent > 0) toast.success(`Details sent to ${sent} ${sent === 1 ? "guest" : "guests"}`);
    else
      toast.error(
        `Nothing sent — ${
          emailReasons[reason] ??
          (reason.startsWith("provider_error") ? "the email service refused it" : "please try again")
        }`,
      );
  };

  const vendorName = (id: string | null) =>
    id ? ((vendors.data ?? []).find((v) => v.id === id)?.name ?? null) : null;

  return (
    <div className="space-y-6">
      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Car className="size-4 text-primary" /> Cars and drivers
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign a car for each arrival and departure, then move it along as the driver sets off,
          meets the guest and drops them off. Each family shows their reply, so you only arrange
          cars for guests who are coming.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Family</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={ride.household}
              onChange={(e) => setRide({ ...ride, household: e.target.value })}
            >
              <option value="">Choose a family…</option>
              {households.map((h) => (
                <option key={h} value={h}>
                  {h} — {replyLabel(h)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Person (optional)</Label>
            <Input
              className="mt-1"
              maxLength={80}
              value={ride.guest_name}
              onChange={(e) => setRide({ ...ride, guest_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Pick-up or drop-off</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={ride.kind}
              onChange={(e) => setRide({ ...ride, kind: e.target.value })}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Transport vendor</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={ride.vendor_id}
              onChange={(e) => setRide({ ...ride, vendor_id: e.target.value })}
            >
              <option value="">No vendor</option>
              {(vendors.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Driver</Label>
            <Input
              className="mt-1"
              maxLength={80}
              value={ride.driver_name}
              onChange={(e) => setRide({ ...ride, driver_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Driver's phone</Label>
            <Input
              className="mt-1"
              maxLength={40}
              value={ride.driver_phone}
              onChange={(e) => setRide({ ...ride, driver_phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Car</Label>
            <Input
              className="mt-1"
              maxLength={60}
              placeholder="Innova · DXB 1234"
              value={ride.vehicle}
              onChange={(e) => setRide({ ...ride, vehicle: e.target.value })}
            />
          </div>
          <div>
            <Label>From</Label>
            <Input
              className="mt-1"
              maxLength={80}
              value={ride.from_place}
              onChange={(e) => setRide({ ...ride, from_place: e.target.value })}
            />
          </div>
          <div>
            <Label>To</Label>
            <Input
              className="mt-1"
              maxLength={80}
              placeholder="Hotel"
              value={ride.to_place}
              onChange={(e) => setRide({ ...ride, to_place: e.target.value })}
            />
          </div>
          <div>
            <Label>When</Label>
            <Input
              className="mt-1"
              type="datetime-local"
              value={ride.scheduled_at}
              onChange={(e) => setRide({ ...ride, scheduled_at: e.target.value })}
            />
          </div>
          <div>
            <Label>Flight</Label>
            <Input
              className="mt-1"
              maxLength={40}
              value={ride.flight}
              onChange={(e) => setRide({ ...ride, flight: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label>Notes</Label>
            <Textarea
              className="mt-1"
              maxLength={300}
              value={ride.notes}
              onChange={(e) => setRide({ ...ride, notes: e.target.value })}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={addRide}>
          <Plus className="size-4" /> Add car
        </Button>

        <ul className="mt-6 space-y-3">
          {(rides.data ?? []).map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm">{r.household}</p>
                {r.guest_name ? (
                  <span className="text-xs text-muted-foreground">{r.guest_name}</span>
                ) : null}
                <Badge variant="outline">{KINDS.find((k) => k.value === r.kind)?.label ?? r.kind}</Badge>
                <Badge>{r.status}</Badge>
                <Badge variant={replyOf(r.household)?.status === "no" ? "destructive" : "secondary"}>
                  {replyLabel(r.household)}
                </Badge>
                <span className="text-xs text-muted-foreground">{timeLabel(r.scheduled_at)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label="Remove this car"
                  onClick={() => removeRow("guest_transport", r.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[r.from_place, r.to_place].filter(Boolean).join(" → ")}
                {r.flight ? ` · flight ${r.flight}` : ""}
                {r.driver_name ? ` · ${r.driver_name}` : ""}
                {r.driver_phone ? ` · ${r.driver_phone}` : ""}
                {r.vehicle ? ` · ${r.vehicle}` : ""}
                {vendorName(r.vendor_id) ? ` · ${vendorName(r.vendor_id)}` : ""}
              </p>
              {r.notes ? <p className="mt-1 text-xs">{r.notes}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {RIDE_STATUS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRideStatus(r.id, s)}
                    aria-pressed={r.status === s}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      r.status === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </li>
          ))}
          {(rides.data ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">No cars assigned yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <BedDouble className="size-4 text-primary" /> Rooms and check-in
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The hospitality team gives each family a room, then marks them checked in and checked out.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Family</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={stay.household}
              onChange={(e) => setStay({ ...stay, household: e.target.value })}
            >
              <option value="">Choose a family…</option>
              {households.map((h) => (
                <option key={h} value={h}>
                  {h} — {replyLabel(h)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Person (optional)</Label>
            <Input
              className="mt-1"
              maxLength={80}
              value={stay.guest_name}
              onChange={(e) => setStay({ ...stay, guest_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Hotel</Label>
            <Input
              className="mt-1"
              maxLength={80}
              value={stay.hotel_name}
              onChange={(e) => setStay({ ...stay, hotel_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Room</Label>
            <Input
              className="mt-1"
              maxLength={20}
              value={stay.room_number}
              onChange={(e) => setStay({ ...stay, room_number: e.target.value })}
            />
          </div>
          <div>
            <Label>Room type</Label>
            <Input
              className="mt-1"
              maxLength={40}
              value={stay.room_type}
              onChange={(e) => setStay({ ...stay, room_type: e.target.value })}
            />
          </div>
          <div>
            <Label>Hospitality contact</Label>
            <Input
              className="mt-1"
              maxLength={80}
              value={stay.host_contact}
              onChange={(e) => setStay({ ...stay, host_contact: e.target.value })}
            />
          </div>
          <div>
            <Label>Check in</Label>
            <Input
              className="mt-1"
              type="date"
              value={stay.checkin_date}
              onChange={(e) => setStay({ ...stay, checkin_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Check out</Label>
            <Input
              className="mt-1"
              type="date"
              value={stay.checkout_date}
              onChange={(e) => setStay({ ...stay, checkout_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Hotel address</Label>
            <Input
              className="mt-1"
              maxLength={160}
              value={stay.hotel_address}
              onChange={(e) => setStay({ ...stay, hotel_address: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label>Notes</Label>
            <Textarea
              className="mt-1"
              maxLength={300}
              value={stay.notes}
              onChange={(e) => setStay({ ...stay, notes: e.target.value })}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={addStay}>
          <Plus className="size-4" /> Add room
        </Button>

        <ul className="mt-6 space-y-3">
          {(stays.data ?? []).map((s) => (
            <li key={s.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm">{s.household}</p>
                {s.guest_name ? (
                  <span className="text-xs text-muted-foreground">{s.guest_name}</span>
                ) : null}
                <Badge>{s.status}</Badge>
                <Badge variant={replyOf(s.household)?.status === "no" ? "destructive" : "secondary"}>
                  {replyLabel(s.household)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label="Remove this room"
                  onClick={() => removeRow("guest_stays", s.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[s.hotel_name, s.room_number ? `room ${s.room_number}` : null, s.room_type]
                  .filter(Boolean)
                  .join(" · ")}
                {s.checkin_date ? ` · in ${s.checkin_date}` : ""}
                {s.checkout_date ? ` · out ${s.checkout_date}` : ""}
                {s.host_contact ? ` · ${s.host_contact}` : ""}
              </p>
              {s.notes ? <p className="mt-1 text-xs">{s.notes}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {STAY_STATUS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStayStatus(s.id, v)}
                    aria-pressed={s.status === v}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      s.status === v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </li>
          ))}
          {(stays.data ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">No rooms given out yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Mail className="size-4 text-primary" /> Send guests their details
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Emails each person in the family their car, driver, hotel and room.
        </p>
        <ul className="mt-4 space-y-2">
          {households
            .filter(
              (h) =>
                (rides.data ?? []).some((r) => r.household === h) ||
                (stays.data ?? []).some((s) => s.household === h),
            )
            .map((h) => (
              <li key={h} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="min-w-0 flex-1 truncate text-sm">{h}</span>
                <Badge variant={replyOf(h)?.status === "no" ? "destructive" : "secondary"}>
                  {replyLabel(h)}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sending === h}
                  onClick={() => emailDetails(h)}
                >
                  {sending === h ? "Sending…" : "Email details"}
                </Button>
              </li>
            ))}
          {households.every(
            (h) =>
              !(rides.data ?? []).some((r) => r.household === h) &&
              !(stays.data ?? []).some((s) => s.household === h),
          ) ? (
            <li className="text-sm text-muted-foreground">
              Assign a car or a room first, then you can send the details.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
