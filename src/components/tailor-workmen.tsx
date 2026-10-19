import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type Workman = { id: string; name: string; phone: string; vendor_id: string };

export function useWorkmen(inviteId: string, enabled = true) {
  return useQuery({
    queryKey: ["tailor-workmen", inviteId],
    enabled: Boolean(inviteId) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("tailor_workmen").select("id, name, phone, vendor_id").eq("invite_id", inviteId).eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Workman[];
    },
  });
}

/** Workman dropdown for one tailor, with add / edit / remove and the tailor's standing notes. */
export function TailorWorkmenPicker({ inviteId, vendorId, value, legacyName, onChange }: {
  inviteId: string; vendorId: string; value: string; legacyName: string; onChange: (id: string) => void;
}) {
  const qc = useQueryClient();
  const workmen = useWorkmen(inviteId);
  const list = (workmen.data ?? []).filter((w) => w.vendor_id === vendorId);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [editing, setEditing] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const notes = useQuery({
    queryKey: ["tailor-notes", vendorId],
    enabled: Boolean(vendorId),
    queryFn: async () => { const { data, error } = await supabase.from("vendors").select("tailor_notes").eq("id", vendorId).maybeSingle(); if (error) throw error; return data?.tailor_notes ?? ""; },
  });
  const [tailorNotes, setTailorNotes] = useState("");
  useEffect(() => { setTailorNotes(notes.data ?? ""); }, [notes.data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["tailor-workmen", inviteId] });

  async function saveWorkman() {
    const n = name.trim(); if (!n) return;
    const r = editing
      ? await supabase.from("tailor_workmen").update({ name: n, phone: phone.trim() }).eq("id", editing).select("id").single()
      : await supabase.from("tailor_workmen").insert({ invite_id: inviteId, vendor_id: vendorId, name: n, phone: phone.trim() }).select("id").single();
    if (r.error) { toast.error(r.error.message); return; }
    if (!editing) onChange(r.data.id);
    setName(""); setPhone(""); setEditing(null); await refresh();
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this workman from the list? Outfits they worked on keep their record.")) return;
    const r = await supabase.from("tailor_workmen").update({ active: false }).eq("id", id);
    if (r.error) { toast.error(r.error.message); return; }
    if (value === id) onChange("");
    await refresh();
  }
  async function saveNotes() {
    const r = await supabase.from("vendors").update({ tailor_notes: tailorNotes }).eq("id", vendorId);
    if (r.error) toast.error(r.error.message); else { toast.success("Tailor notes saved"); qc.invalidateQueries({ queryKey: ["tailor-notes", vendorId] }); }
  }

  if (!vendorId) return <p className="text-xs text-muted-foreground">Choose a tailor to pick who worked on this outfit.</p>;
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <label className="text-sm">Worked on by
          <select className="field-select w-full" value={value} onChange={(e) => e.target.value === "__new" ? setManage(true) : onChange(e.target.value)}>
            <option value="">{legacyName ? `${legacyName} (typed earlier)` : "Not assigned"}</option>
            {list.map((w) => <option key={w.id} value={w.id}>{w.name}{w.phone ? ` · ${w.phone}` : ""}</option>)}
            <option value="__new">Add new workman…</option>
          </select>
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => setManage((v) => !v)}>{manage ? "Done" : "Manage"}</Button>
      </div>
      {manage ? (
        <div className="space-y-2">
          {list.map((w) => (
            <div key={w.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{w.name}{w.phone ? ` · ${w.phone}` : ""}</span>
              <Button type="button" size="icon" variant="ghost" title="Edit workman" onClick={() => { setEditing(w.id); setName(w.name); setPhone(w.phone); }}><Pencil className="size-4" /></Button>
              <Button type="button" size="icon" variant="ghost" title="Remove workman" onClick={() => void remove(w.id)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <Input placeholder="Workman name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Mobile (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="button" variant="outline" disabled={!name.trim()} onClick={() => void saveWorkman()}>{editing ? "Save" : "Add"}</Button>
          </div>
        </div>
      ) : null}
      <label className="block text-sm">Tailor's general comments (apply to all their work)
        <Textarea rows={2} value={tailorNotes} onChange={(e) => setTailorNotes(e.target.value)} placeholder="Turnaround time, how they like measurements given…" />
      </label>
      {tailorNotes !== (notes.data ?? "") ? <Button type="button" size="sm" variant="outline" onClick={() => void saveNotes()}>Save tailor comments</Button> : null}
    </div>
  );
}
