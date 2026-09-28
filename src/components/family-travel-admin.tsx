import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plane, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TRAVEL_NEED_OPTIONS = [
  { value: "none", label: "No travel help needed" },
  { value: "flights_only", label: "Flights only" },
  { value: "flights_and_hotel", label: "Flights and hotel" },
];

type TravelPlanRow = {
  id: string;
  household: string;
  invite_id: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  arrival_flight: string | null;
  departure_date: string | null;
  departure_time: string | null;
  departure_flight: string | null;
  checkin_date: string | null;
  checkin_time: string | null;
  checkout_date: string | null;
  checkout_time: string | null;
  party_size: number | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
};

const emptyForm = {
  arrival_date: "",
  arrival_time: "",
  arrival_flight: "",
  departure_date: "",
  departure_time: "",
  departure_flight: "",
  checkin_date: "",
  checkin_time: "",
  checkout_date: "",
  checkout_time: "",
  party_size: "",
  notes: "",
};

/** Host-side travel need, travel plan and passport-removal controls for one family. */
export function FamilyTravelAdmin({
  household,
  inviteId,
  familyId,
}: {
  household: string;
  inviteId: string | null;
  familyId: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [updaterIsHost, setUpdaterIsHost] = useState(false);

  const family = useQuery({
    queryKey: ["family-row", familyId],
    enabled: Boolean(familyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("id, travel_need")
        .eq("id", familyId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const invite = useQuery({
    queryKey: ["invite-default-travel", inviteId],
    enabled: Boolean(inviteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("default_travel_need")
        .eq("id", inviteId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const plan = useQuery({
    queryKey: ["family-travel-plan", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_plans")
        .select("*")
        .eq("household", household)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TravelPlanRow | null;
    },
  });

  const passports = useQuery({
    queryKey: ["guest-passports", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_passports")
        .select("id, doc_path")
        .eq("household", household);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const p = plan.data;
    if (!p) {
      setForm(emptyForm);
      return;
    }
    setForm({
      arrival_date: p.arrival_date ?? "",
      arrival_time: p.arrival_time ?? "",
      arrival_flight: p.arrival_flight ?? "",
      departure_date: p.departure_date ?? "",
      departure_time: p.departure_time ?? "",
      departure_flight: p.departure_flight ?? "",
      checkin_date: p.checkin_date ?? "",
      checkin_time: p.checkin_time ?? "",
      checkout_date: p.checkout_date ?? "",
      checkout_time: p.checkout_time ?? "",
      party_size: p.party_size != null ? String(p.party_size) : "",
      notes: p.notes ?? "",
    });
  }, [plan.data]);

  useEffect(() => {
    const updatedBy = plan.data?.updated_by;
    if (!updatedBy) {
      setUpdaterIsHost(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("celebration_hosts")
      .select("id")
      .eq("user_id", updatedBy)
      .eq("invite_id", inviteId ?? "")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setUpdaterIsHost(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [plan.data?.updated_by, inviteId]);

  const effectiveNeed = family.data?.travel_need ?? invite.data?.default_travel_need ?? "none";

  const setTravelNeed = async (value: string) => {
    if (!familyId) {
      toast.error("This family isn't linked to a family record yet.");
      return;
    }
    const { error } = await supabase
      .from("families")
      .update({ travel_need: value === "default" ? null : value })
      .eq("id", familyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Travel need updated");
    await qc.invalidateQueries({ queryKey: ["family-row", familyId] });
  };

  const saveTravelPlan = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const patch = {
      household,
      invite_id: inviteId,
      arrival_date: form.arrival_date || null,
      arrival_time: form.arrival_time || null,
      arrival_flight: form.arrival_flight.trim() || null,
      departure_date: form.departure_date || null,
      departure_time: form.departure_time || null,
      departure_flight: form.departure_flight.trim() || null,
      checkin_date: form.checkin_date || null,
      checkin_time: form.checkin_time || null,
      checkout_date: form.checkout_date || null,
      checkout_time: form.checkout_time || null,
      party_size: form.party_size ? Number(form.party_size) : null,
      notes: form.notes.trim() || null,
      updated_by: userData.user?.id ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = plan.data
      ? await supabase.from("travel_plans").update(patch).eq("id", plan.data.id)
      : await supabase.from("travel_plans").insert(patch);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Travel details saved");
    await qc.invalidateQueries({ queryKey: ["family-travel-plan", household] });
    await qc.invalidateQueries({ queryKey: ["family-travel", household] });
  };

  const removeTravelDetails = async () => {
    if (!plan.data) return;
    const { error } = await supabase.from("travel_plans").delete().eq("id", plan.data.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Travel details removed");
    setForm(emptyForm);
    await qc.invalidateQueries({ queryKey: ["family-travel-plan", household] });
    await qc.invalidateQueries({ queryKey: ["family-travel", household] });
  };

  const removePassportDetails = async () => {
    const rows = passports.data ?? [];
    const paths = rows.map((r) => r.doc_path).filter(Boolean) as string[];
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from("passports").remove(paths);
      if (storageError) {
        toast.error(storageError.message);
        return;
      }
    }
    const { error } = await supabase.from("guest_passports").delete().eq("household", household);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Passport details removed");
    await qc.invalidateQueries({ queryKey: ["guest-passports", household] });
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <Plane className="size-4 text-primary" /> Travel details
      </h2>

      <div className="mt-4 max-w-sm">
        <Label className="text-xs">Travel need for this family</Label>
        <Select value={family.data?.travel_need ?? "default"} onValueChange={setTravelNeed}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">
              Use default {invite.data?.default_travel_need ? `(${invite.data.default_travel_need})` : ""}
            </SelectItem>
            {TRAVEL_NEED_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">Currently effective: {effectiveNeed}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Arrival date</Label>
          <Input type="date" {...field("arrival_date")} />
        </div>
        <div>
          <Label className="text-xs">Arrival time</Label>
          <Input type="time" {...field("arrival_time")} />
        </div>
        <div>
          <Label className="text-xs">Arrival flight</Label>
          <Input maxLength={40} {...field("arrival_flight")} />
        </div>
        <div>
          <Label className="text-xs">Departure date</Label>
          <Input type="date" {...field("departure_date")} />
        </div>
        <div>
          <Label className="text-xs">Departure time</Label>
          <Input type="time" {...field("departure_time")} />
        </div>
        <div>
          <Label className="text-xs">Departure flight</Label>
          <Input maxLength={40} {...field("departure_flight")} />
        </div>
        <div>
          <Label className="text-xs">Check-in date</Label>
          <Input type="date" {...field("checkin_date")} />
        </div>
        <div>
          <Label className="text-xs">Check-in time</Label>
          <Input type="time" {...field("checkin_time")} />
        </div>
        <div>
          <Label className="text-xs">Check-out date</Label>
          <Input type="date" {...field("checkout_date")} />
        </div>
        <div>
          <Label className="text-xs">Check-out time</Label>
          <Input type="time" {...field("checkout_time")} />
        </div>
        <div>
          <Label className="text-xs">Party size</Label>
          <Input type="number" min={0} {...field("party_size")} />
        </div>
      </div>
      <div className="mt-3">
        <Label className="text-xs">Notes</Label>
        <Textarea maxLength={2000} {...field("notes")} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">
          {plan.data
            ? `${updaterIsHost ? "Updated by host" : "Updated by family"} · ${new Date(plan.data.updated_at).toLocaleString("en-GB")}`
            : "No travel details saved yet."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={saveTravelPlan} disabled={saving}>
          Save travel details
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={!plan.data}>
              <Trash2 className="mr-2 size-4" /> Remove travel details
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove travel details?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the flight, check-in and check-out details saved for this family. This
                can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={removeTravelDetails}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={(passports.data ?? []).length === 0}>
              <Trash2 className="mr-2 size-4" /> Remove passport details
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove passport details?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes every passport record and uploaded passport page for this family. This
                can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={removePassportDetails}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
