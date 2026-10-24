import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { importPerniaLooks, type PerniaLook } from "@/lib/pernia.functions";
import type { InvoiceMember, InvoiceEvent } from "@/lib/invoice-wearers";
import type { InvoiceLine } from "@/lib/vendor-invoice";
import type { OrderItem } from "@/lib/shop-order";

export function InvoiceAssignLook({ inviteId, member, event, line, fetched, onAssigned }: { inviteId: string; member: InvoiceMember; event: InvoiceEvent; line: InvoiceLine; fetched: PerniaLook | undefined; onAssigned: (item: OrderItem) => void }) {
  const [busy, setBusy] = useState(false);
  const importLooks = useServerFn(importPerniaLooks);
  const qc = useQueryClient();
  async function assign() {
    setBusy(true);
    try {
      const find = () => supabase.from("outfits").select("id,title,source_sku,designer,image_url,boutique_url,price_inr").eq("invite_id", inviteId).eq("event_id", event.id).eq("source_sku", line.sku).is("retired_at", null);
      let result = await find();
      if (result.error) throw result.error;
      if (!result.data.length) {
        if (!fetched) throw new Error("Fetch this model's Pernia product link first so it can be added to the event wardrobe.");
        const imported = await importLooks({ data: { inviteId, eventId: event.id, slugs: [fetched.slug] } });
        if (imported.failed) throw new Error("Could not add this outfit to Wardrobe");
        result = await find();
        if (result.error) throw result.error;
      }
      if (result.data.length !== 1) throw new Error("This model is missing or ambiguous in this event's wardrobe. Check Wardrobe before assigning.");
      const outfit = result.data[0];
      if (!outfit) return;
      const reservation = await supabase.rpc("host_choose_outfit", { _member: member.id, _outfit: outfit.id, _size: line.orderedSize });
      if (reservation.error) throw reservation.error;
      if (!reservation.data) throw new Error("Assignment was not saved");
      onAssigned({ reservationId: reservation.data, wearer: member.guest_name, family: member.household ?? "", event: event.name, title: outfit.title, sku: outfit.source_sku ?? line.sku, designer: outfit.designer ?? "", image: outfit.image_url ?? "", shop: outfit.boutique_url ?? "", size: line.orderedSize, orderedSize: line.orderedSize, originalPrice: outfit.price_inr, price: line.price, discount: line.discount, measurements: null, notes: "Host assigned from vendor invoice" });
      await qc.invalidateQueries();
      toast.success(`Outfit confirmed for ${member.guest_name} · ${event.name}`);
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Could not assign outfit"); }
    finally { setBusy(false); }
  }
  return <Button variant="outline" size="sm" disabled={busy} onClick={() => void assign()}>{busy ? "Assigning…" : `Assign invoice outfit to ${member.guest_name}`}</Button>;
}