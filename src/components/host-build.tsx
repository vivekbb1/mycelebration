import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Hammer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Custom"];
const FABRICS = ["Silk", "Raw silk", "Georgette", "Chiffon", "Organza", "Velvet", "Cotton"];

/** Build a look for one guest: pick the garment, the size and the fabric, and it becomes their pick. */
export function HostBuild() {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [outfitId, setOutfitId] = useState("");
  const [size, setSize] = useState("");
  const [fabric, setFabric] = useState("");
  const [busy, setBusy] = useState(false);

  const events = useQuery({
    queryKey: ["build-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, outfit_selection, outfit_ready_by")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const guests = useQuery({
    queryKey: ["build-guests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, household, gender, claimed_by")
        .order("household");
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["build-outfits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("id, title, garment_type, gender, event_id, is_available")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const reservations = useQuery({
    queryKey: ["build-reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, outfit_id, guest_id, guest_name, build_size, build_fabric, build_garment");
      if (error) throw error;
      return data;
    },
  });

  const claimed = (guests.data ?? []).filter((g) => g.claimed_by);
  const guest = claimed.find((g) => g.id === guestId) ?? null;

  const garments = useMemo(
    () =>
      (outfits.data ?? []).filter((o) => {
        if (eventId && o.event_id && o.event_id !== eventId) return false;
        if (guest?.gender && o.gender && o.gender !== guest.gender) return false;
        return true;
      }),
    [outfits.data, eventId, guest?.gender],
  );

  const current = useMemo(() => {
    if (!guest?.claimed_by) return null;
    const outfitById = new Map((outfits.data ?? []).map((o) => [o.id, o]));
    return (
      (reservations.data ?? []).find((r) => {
        if (r.guest_id !== guest.claimed_by) return false;
        if ((r.guest_name ?? "") !== (guest.guest_name ?? "")) return false;
        const outfit = outfitById.get(r.outfit_id);
        return eventId ? outfit?.event_id === eventId : true;
      }) ?? null
    );
  }, [reservations.data, outfits.data, guest, eventId]);

  const save = async () => {
    if (!guest?.claimed_by) {
      toast.error("Pick a guest who has signed in — a look is saved against their account.");
      return;
    }
    if (!outfitId) {
      toast.error("Pick the garment first.");
      return;
    }
    setBusy(true);
    try {
      if (current && current.outfit_id !== outfitId) {
        const { error } = await supabase.from("reservations").delete().eq("id", current.id);
        if (error) throw error;
      }
      const patch = {
        build_garment: garments.find((o) => o.id === outfitId)?.garment_type ?? null,
        build_size: size || null,
        build_fabric: fabric || null,
      };
      if (current && current.outfit_id === outfitId) {
        const { error } = await supabase
          .from("reservations")
          .update(patch)
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reservations").insert({
          outfit_id: outfitId,
          guest_id: guest.claimed_by,
          guest_name: guest.guest_name ?? null,
          ...patch,
        });
        if (error) throw error;
      }
      toast.success(`Look saved for ${guest.guest_name ?? "this guest"}.`);
      setSize("");
      setFabric("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["build-reservations"] }),
        queryClient.invalidateQueries({ queryKey: ["host-picks-reservations"] }),
        queryClient.invalidateQueries({ queryKey: ["reservations"] }),
        queryClient.invalidateQueries({ queryKey: ["overview-reservations"] }),
      ]);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message.includes("23505")
            ? "Someone already has that look — pick another."
            : e.message
          : "Could not save the look.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <Hammer className="size-4 text-primary" /> Build a look
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose the function, the guest, then the garment, size and fabric. It becomes that guest's
        outfit for the event straight away.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="b-event">Event</Label>
          <select
            id="b-event"
            className="field-select"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setOutfitId("");
            }}
          >
            <option value="">Any event</option>
            {(events.data ?? [])
              .filter((e) => e.outfit_selection !== false)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.event_date ? ` — ${e.event_date}` : ""}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="b-guest">Guest</Label>
          <select
            id="b-guest"
            className="field-select"
            value={guestId}
            onChange={(e) => {
              setGuestId(e.target.value);
              setOutfitId("");
            }}
          >
            <option value="">Choose a guest</option>
            {claimed.map((g) => (
              <option key={g.id} value={g.id}>
                {g.guest_name}
                {g.household ? ` — ${g.household}` : ""}
              </option>
            ))}
          </select>
          {claimed.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No guest has signed in yet, so there's nobody to build for.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="b-garment">Garment</Label>
          <select
            id="b-garment"
            className="field-select"
            value={outfitId}
            onChange={(e) => setOutfitId(e.target.value)}
          >
            <option value="">Choose a garment</option>
            {garments.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
                {o.garment_type ? ` — ${o.garment_type}` : ""}
                {o.is_available ? "" : " (held)"}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="b-size">Size</Label>
          <Input
            id="b-size"
            list="build-sizes"
            maxLength={40}
            placeholder="M"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
          <datalist id="build-sizes">
            {SIZES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="b-fabric">Fabric</Label>
          <Input
            id="b-fabric"
            list="build-fabrics"
            maxLength={80}
            placeholder="Raw silk"
            value={fabric}
            onChange={(e) => setFabric(e.target.value)}
          />
          <datalist id="build-fabrics">
            {FABRICS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      </div>

      {current ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Right now {guest?.guest_name} has{" "}
          {(outfits.data ?? []).find((o) => o.id === current.outfit_id)?.title ?? "a look"}
          {current.build_size ? ` · size ${current.build_size}` : ""}
          {current.build_fabric ? ` · ${current.build_fabric}` : ""}. Saving replaces it.
        </p>
      ) : null}

      <Button onClick={save} disabled={busy} className="mt-4">
        {busy ? "Saving…" : "Save this look"}
      </Button>
    </section>
  );
}
