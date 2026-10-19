import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { regroupFamily } from "@/lib/family-regroup.functions";

export function FamilyRegroupDialog({ inviteId, household, members }: {
  inviteId: string; household: string; members: Array<{ id: string; guest_name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("new");
  const [name, setName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const move = useServerFn(regroupFamily);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const families = useQuery({
    queryKey: ["regroup-families", inviteId], enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("id, name").eq("invite_id", inviteId).neq("name", household).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  async function save() {
    setBusy(true);
    try {
      const result = await move({ data: { inviteId, source: household, memberIds: selected, ...(target === "new" ? { newName: name } : { targetId: target }) } });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Family members regrouped. Review their event replies and travel settings.");
      setOpen(false);
      await qc.invalidateQueries();
      await navigate({ to: "/family/$household", params: { household: result.household } });
    } catch { toast.error("Couldn't regroup this family just now."); }
    finally { setBusy(false); }
  }
  return <>
    <Button size="sm" variant="outline" onClick={() => { setSelected(members.map((m) => m.id)); setAcknowledged(false); setOpen(true); }}><Users className="size-4" /> Merge / split family</Button>
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Merge or split family members</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">{members.map((m) => <Label key={m.id} className="flex items-center gap-2"><Checkbox checked={selected.includes(m.id)} onCheckedChange={(v) => setSelected((s) => v ? [...s, m.id] : s.filter((id) => id !== m.id))} />{m.guest_name}</Label>)}</div>
          <div className="space-y-2"><Label>Destination family</Label><Select value={target} onValueChange={setTarget}><SelectTrigger aria-label="Destination family"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">New family</SelectItem>{(families.data ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
          {target === "new" ? <div className="space-y-2"><Label htmlFor="split-family-name">New family name</Label><Input id="split-family-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div> : null}
          <p className="text-sm text-muted-foreground">Room assignments and individual details move with these members. Existing destination travel settings and prepaid dates are kept; a new family inherits the source settings. Review event replies afterwards. Shared travel batches must be separated first.</p>
          <Label className="flex items-start gap-2"><Checkbox className="mt-0.5" checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} /><span className="text-sm">I understand members in the destination family will share access to family outfits, measurements, travel and passport details.</span></Label>
        </div>
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !acknowledged || !selected.length || (target === "new" && name.trim().length < 2)} onClick={() => void save()}>{busy ? "Moving…" : `Move ${selected.length} member${selected.length === 1 ? "" : "s"}`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}