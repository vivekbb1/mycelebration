import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Celebration-wide delivery defaults used to hide looks from guests that
 *  can't be made and couriered before their event. */
export function DeliverySettingsCard({ inviteId }: { inviteId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["delivery-settings", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("default_courier_days, delivery_buffer_days")
        .eq("id", inviteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [courier, setCourier] = useState("");
  const [buffer, setBuffer] = useState("0");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    setCourier(q.data.default_courier_days != null ? String(q.data.default_courier_days) : "");
    setBuffer(String(q.data.delivery_buffer_days ?? 0));
  }, [q.data]);

  const save = async () => {
    const c = courier.trim() ? Math.round(Number(courier)) : null;
    const b = Math.round(Number(buffer || 0));
    if ((c != null && !(c >= 0 && c <= 120)) || !(b >= 0 && b <= 120)) {
      toast.error("Use whole days between 0 and 120.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("invites")
      .update({ default_courier_days: c, delivery_buffer_days: b })
      .eq("id", inviteId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Delivery times saved.");
    qc.invalidateQueries({ queryKey: ["delivery-settings"] });
  };

  return (
    <div className="panel-wrap min-w-0 p-4 sm:p-5">
      <h2 className="font-display text-xl">Delivery time</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Guests only see looks that can arrive before their event: today + production days + courier days + buffer.
        Looks with no delivery time stay visible.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="d-courier">Default courier days</Label>
          <Input id="d-courier" type="number" min={0} max={120} inputMode="numeric" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. 7" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d-buffer">Buffer before event (fittings)</Label>
          <Input id="d-buffer" type="number" min={0} max={120} inputMode="numeric" value={buffer} onChange={(e) => setBuffer(e.target.value)} />
        </div>
        <Button onClick={save} disabled={busy}>Save</Button>
      </div>
    </div>
  );
}
