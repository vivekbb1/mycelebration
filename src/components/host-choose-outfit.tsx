import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function HostChooseOutfit({ member, event, inviteId, onClose, onAssigned }: {
  member: { id: string; guest_name: string; gender: string | null };
  event: { id: string; name: string }; inviteId: string; onClose: () => void; onAssigned?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [size, setSize] = useState("");
  const [saving, setSaving] = useState(false);
  const looks = useQuery({
    queryKey: ["host-choose-outfit", member.id, event.id],
    queryFn: async () => {
      const result = await supabase.from("outfits").select("id, title, source_sku, designer, image_url, price_inr, gender, sizes")
        .eq("invite_id", inviteId).eq("event_id", event.id).eq("is_available", true).is("retired_at", null).order("title");
      if (result.error) throw result.error;
      const allowed = await supabase.rpc("guest_outfit_ids", { _member: member.id });
      if (allowed.error) throw allowed.error;
      const ids = new Set(allowed.data ?? []);
      return (result.data ?? []).filter((o) => ids.has(o.id) && (!member.gender || member.gender === o.gender));
    },
  });
  const chosen = looks.data?.find((o) => o.id === picked);
  const save = async () => {
    if (!chosen) return;
    setSaving(true);
    const { error, data } = await supabase.rpc("host_choose_outfit", { _member: member.id, _outfit: chosen.id, ...(size.trim() ? { _size: size.trim() } : {}) });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    if (data) onAssigned?.(data);
    toast.success(`Outfit confirmed for ${member.guest_name}`);
    onClose();
  };
  const q = search.trim().toLowerCase();
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Choose for {member.guest_name}</DialogTitle><DialogDescription>{event.name}</DialogDescription></DialogHeader>
      <Input aria-label="Search available outfits" placeholder="Outfit, model number or designer" value={search} onChange={(e) => setSearch(e.target.value)} />
      {looks.isError ? <p className="text-sm text-destructive">Could not load outfits.</p> : looks.isLoading ? <p>Loading…</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {looks.data?.filter((o) => !q || [o.title, o.source_sku, o.designer].some((v) => v?.toLowerCase().includes(q))).map((o) => <Button
          key={o.id} variant="outline" aria-pressed={picked === o.id} onClick={() => { setPicked(o.id); setSize(""); }}
          className={`h-auto min-w-0 flex-col items-start justify-start overflow-hidden whitespace-normal p-2 sm:h-auto ${picked === o.id ? "border-primary bg-accent" : ""}`}>
          {o.image_url ? <img src={o.image_url} alt={o.title} className="aspect-[3/4] w-full rounded object-cover" loading="lazy" /> : null}
          <span className="line-clamp-2 text-left text-xs">{o.title}</span><span className="text-xs text-muted-foreground">{o.source_sku}</span>
          <span className="text-xs">{o.price_inr == null ? "Price not recorded" : `₹${o.price_inr.toLocaleString("en-IN")}`}</span>
        </Button>)}
      </div>}
      {chosen ? <div className="sticky bottom-0 space-y-3 border-t border-border bg-background pt-3">
        <p className="text-sm">{chosen.title}</p>
        <Input aria-label="Size to confirm" placeholder="Size (optional)" value={size} onChange={(e) => setSize(e.target.value)} maxLength={80} />
        <Button className="w-full" disabled={saving} onClick={() => void save()}>{saving ? "Confirming…" : "Choose and confirm outfit"}</Button>
      </div> : null}
    </DialogContent>
  </Dialog>;
}