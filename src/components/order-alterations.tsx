import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Json } from "@/integrations/supabase/types";

const STD_KEYS = ["unit", "height", "chest", "bust", "under_bust", "waist", "hip", "shoulder", "armhole", "neck", "sleeve_length", "top_length", "bottom_length", "inseam"];

export function OrderAlterations({ inviteId, reservationId, wearer, measurements, label, onSaved }: { inviteId: string; reservationId: string; wearer: string; measurements: Record<string, string | number> | null; label?: string; onSaved?: () => void }) {
  const qc = useQueryClient(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [vendor, setVendor] = useState(""); const [newVendor, setNewVendor] = useState(""); const [contact, setContact] = useState("");
  const [notes, setNotes] = useState(""); const [extraKey, setExtraKey] = useState(""); const [photoNotes, setPhotoNotes] = useState<Record<string, string>>({}); const [workman, setWorkman] = useState(""); const [workmanPhone, setWorkmanPhone] = useState(""); const [extraVal, setExtraVal] = useState(""); const [status, setStatus] = useState("needed");
  const [values, setValues] = useState<Record<string, string | number>>({}); const [photos, setPhotos] = useState<string[]>([]); const [signed, setSigned] = useState<Record<string, string>>({});
  const vendors = useQuery({ queryKey: ["alteration-vendors", inviteId], enabled: open, queryFn: async () => { const { data, error } = await supabase.from("vendors").select("id, name").eq("invite_id", inviteId).order("name"); if (error) throw error; return data ?? []; } });
  async function start() {
    setBusy(true);
    try {
      const { data, error } = await supabase.from("wardrobe_alterations").select("*").eq("invite_id", inviteId).eq("reservation_id", reservationId).maybeSingle(); if (error) throw error;
      setVendor(data?.vendor_id ?? ""); setPhotoNotes((data?.photo_notes as Record<string, string> | undefined) ?? {}); setWorkman(data?.workman ?? ""); setWorkmanPhone(data?.workman_phone ?? ""); setNotes(data?.notes ?? ""); setStatus(data?.status ?? "needed"); setValues(data ? data.measurements as Record<string, string | number> : measurements ?? {}); setPhotos(data ? data.photos as string[] : []); setSigned({}); setOpen(true);
      for (const path of data ? data.photos as string[] : []) { const r = await supabase.storage.from("alteration-photos").createSignedUrl(path, 3600); if (r.data) setSigned((s) => ({ ...s, [path]: r.data.signedUrl })); }
    } catch { toast.error("Couldn't load alteration details"); } finally { setBusy(false); }
  }
  async function save() { setBusy(true); try {
    const { error } = await supabase.from("wardrobe_alterations").upsert({ invite_id: inviteId, reservation_id: reservationId, vendor_id: vendor || null, status, notes, measurements: values as Json, photos, photo_notes: photoNotes as Json, workman: workman.trim(), workman_phone: workmanPhone.trim() }, { onConflict: "invite_id,reservation_id" }); if (error) throw error;
    toast.success("Alterations saved"); setOpen(false); onSaved?.(); qc.invalidateQueries({ queryKey: ["alterations-list"] });
  } catch(e) { toast.error(e instanceof Error ? e.message : "Couldn't save alterations"); } finally { setBusy(false); } }
  async function upload(files: FileList | null) { if (!files) return; setBusy(true); try {
    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Choose JPG, PNG or WebP images up to 10 MB");
      const path = `${inviteId}/${reservationId}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const { error } = await supabase.storage.from("alteration-photos").upload(path, file); if (error) throw error;
      // Persist each upload immediately so closing the dialog never loses its photo.
      const next = [...photos, path];
      const result = await supabase.from("wardrobe_alterations").upsert({ invite_id: inviteId, reservation_id: reservationId, vendor_id: vendor || null, status, notes, measurements: values as Json, photos: next }, { onConflict: "invite_id,reservation_id" });
      if (result.error) { await supabase.storage.from("alteration-photos").remove([path]); throw result.error; }
      photos.push(path); setPhotos([...photos]); const r = await supabase.storage.from("alteration-photos").createSignedUrl(path, 3600); if(r.data) setSigned((s) => ({ ...s, [path]: r.data.signedUrl }));
    }
  } catch(e) { toast.error(e instanceof Error ? e.message : "Couldn't upload photo"); } finally { setBusy(false); } }
  return <><Button size="sm" variant="outline" disabled={busy} onClick={() => void start()}><Scissors className="size-4" /> {label ?? "Local alterations"}</Button><Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Alterations · {wearer}</DialogTitle></DialogHeader>
    <label className="text-sm">Alteration vendor<select className="field-select w-full" value={vendor} onChange={(e) => setVendor(e.target.value)}><option value="">Not assigned</option>{(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
    <div className="grid gap-2 sm:grid-cols-3"><Input placeholder="New vendor name" value={newVendor} onChange={(e) => setNewVendor(e.target.value)} /><Input placeholder="Contact phone" value={contact} onChange={(e) => setContact(e.target.value)} /><Button variant="outline" disabled={busy || !newVendor.trim()} onClick={async () => { setBusy(true); try { const r = await supabase.from("vendors").insert({ invite_id: inviteId, name: newVendor.trim(), category: "alterations", contact_phone: contact || null }).select("id").single(); if(r.error) throw r.error; setVendor(r.data.id); setNewVendor(""); await qc.invalidateQueries({ queryKey: ["alteration-vendors"] }); } catch { toast.error("Couldn't add vendor"); } finally { setBusy(false); } }}>Add vendor</Button></div>
    <label className="text-sm">Status<select className="field-select w-full" value={status} onChange={(e) => setStatus(e.target.value)}>{["needed", "with vendor", "complete"].map((s) => <option key={s}>{s}</option>)}</select></label>
    <div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Worked on by (tailor's workman)<Input placeholder="Name" value={workman} onChange={(e) => setWorkman(e.target.value)} /></label><label className="text-sm">Workman mobile<Input placeholder="Optional" value={workmanPhone} onChange={(e) => setWorkmanPhone(e.target.value)} /></label></div>
    <h3 className="font-medium">Required measurements</h3><div className="grid gap-3 sm:grid-cols-3">{["unit", "height", "chest", "bust", "under_bust", "waist", "hip", "shoulder", "armhole", "neck", "sleeve_length", "top_length", "bottom_length", "inseam"].map((k) => <label key={k} className="text-xs">{k.replaceAll("_", " ")}<Input value={values[k] ?? ""} onChange={(e) => setValues((a) => ({ ...a, [k]: e.target.value }))} /></label>)}</div>
    <div className="space-y-2"><h3 className="font-medium">Extra measurements</h3>
      {Object.keys(values).filter((k) => !STD_KEYS.includes(k) && k !== "notes" && k !== "usual_size").map((k) => <div key={k} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{k.replaceAll("_", " ")}</span><Input className="w-28" value={String(values[k] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} /><Button size="icon" variant="ghost" title="Remove measurement" onClick={() => setValues((v) => { const n = { ...v }; delete n[k]; return n; })}><Trash2 className="size-4" /></Button></div>)}
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-2"><Input placeholder="e.g. bicep, thigh, kurta flare" value={extraKey} onChange={(e) => setExtraKey(e.target.value)} /><Input placeholder="Value" value={extraVal} onChange={(e) => setExtraVal(e.target.value)} /><Button variant="outline" disabled={!extraKey.trim()} onClick={() => { const k = extraKey.trim().toLowerCase().replace(/\s+/g, "_"); setValues((v) => ({ ...v, [k]: extraVal })); setExtraKey(""); setExtraVal(""); }}>Add</Button></div>
      {measurements ? <p className="text-xs text-muted-foreground">Guest's original measurements: {Object.entries(measurements).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ")}</p> : null}
    </div>
    <label className="text-sm">Alteration instructions / fitting notes<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    <label className="text-sm">Fitting photos<Input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(e) => void upload(e.target.files)} /></label>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((path) => <div key={path} className="min-w-0 space-y-1">{signed[path] ? <a href={signed[path]} target="_blank" rel="noreferrer"><img src={signed[path]} alt={`Alteration fitting for ${wearer}`} className="aspect-square w-full object-cover" /></a> : null}<Button size="sm" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { const next = photos.filter((p) => p !== path); const r = await supabase.from("wardrobe_alterations").update({ photos: next }).eq("invite_id", inviteId).eq("reservation_id", reservationId); if(r.error) throw r.error; await supabase.storage.from("alteration-photos").remove([path]); setPhotos(next); setPhotoNotes((n) => { const c = { ...n }; delete c[path]; return c; }); } catch { toast.error("Couldn't remove photo"); } finally { setBusy(false); } }}><Trash2 className="size-3" /> Remove</Button><Textarea rows={2} className="text-xs" placeholder="Note for the tailor about this photo" value={photoNotes[path] ?? ""} onChange={(e) => setPhotoNotes((n) => ({ ...n, [path]: e.target.value }))} /></div>)}</div>
    <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save alterations"}</Button>
  </DialogContent></Dialog></>;
}