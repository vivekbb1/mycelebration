import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hostAddMember, removeRegisteredGuest, updateRegisteredGuest } from "@/lib/family-signup.functions";

type Person = { id: string; guest_name: string; email: string | null; phone: string | null; gender: string | null; claimed_by: string | null };
type Form = { name: string; email: string; phone: string; gender: string };
const blank: Form = { name: "", email: "", phone: "", gender: "" };

function useRefresh() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries();
}

function MemberDialog({ open, title, initial, busy, onClose, onSave }: {
  open: boolean; title: string; initial: Form; busy: boolean; onClose: () => void; onSave: (f: Form) => void;
}) {
  const [f, setF] = useState(initial);
  const [key, setKey] = useState(open);
  if (open !== key) { setKey(open); if (open) setF(initial); }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="fm-name">Full name</Label>
            <Input id="fm-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Looks</Label>
            <Select value={f.gender} onValueChange={(v) => setF({ ...f, gender: v })}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="men">Man</SelectItem>
                <SelectItem value="women">Woman</SelectItem>
                <SelectItem value="boy">Boy</SelectItem>
                <SelectItem value="girl">Girl</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="fm-email">Email (optional)</Label>
              <Input id="fm-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fm-phone">Mobile (optional)</Label>
              <Input id="fm-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => onSave(f)} disabled={busy || f.name.trim().length < 2 || !f.gender}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Host button to add a person to this family. */
export function AddFamilyMemberButton({ inviteId, household }: { inviteId: string; household: string }) {
  const add = useServerFn(hostAddMember);
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (f: Form) => {
    setBusy(true);
    try {
      const r = await add({ data: { inviteId, household, name: f.name, gender: f.gender as "men", email: f.email.trim(), phone: f.phone.trim() } });
      if (!r.ok) throw new Error(r.error);
      toast.success(`${f.name} added to the family.`);
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add that person.");
    } finally { setBusy(false); }
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 size-4" /> Add member
      </Button>
      <MemberDialog open={open} title="Add a family member" initial={blank} busy={busy} onClose={() => setOpen(false)} onSave={(f) => void save(f)} />
    </>
  );
}

/** Edit / remove buttons for one family member. */
export function FamilyMemberActions({ person }: { person: Person }) {
  const update = useServerFn(updateRegisteredGuest);
  const remove = useServerFn(removeRegisteredGuest);
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (f: Form) => {
    setBusy(true);
    try {
      const r = await update({ data: { codeId: person.id, name: f.name, email: f.email.trim(), phone: f.phone.trim(), gender: f.gender as "men", familyName: "" } });
      if (!r.ok) throw new Error(r.error);
      toast.success("Details saved.");
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save those details.");
    } finally { setBusy(false); }
  };
  const del = async () => {
    if (!window.confirm(`Remove ${person.guest_name} from this family?`)) return;
    const r = await remove({ data: { codeId: person.id } });
    if (!r.ok) toast.error(r.error ?? "Couldn't remove that person.");
    else { toast.success(`${person.guest_name} was removed.`); refresh(); }
  };
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={`Edit ${person.guest_name}`} onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
      </Button>
      {!person.claimed_by ? (
        <Button variant="ghost" size="icon" aria-label={`Remove ${person.guest_name}`} onClick={() => void del()}>
          <Trash2 className="size-4" />
        </Button>
      ) : null}
      <MemberDialog
        open={open}
        title="Edit family member"
        initial={{ name: person.guest_name, email: person.email ?? "", phone: person.phone ?? "", gender: person.gender ?? "" }}
        busy={busy}
        onClose={() => setOpen(false)}
        onSave={(f) => void save(f)}
      />
    </>
  );
}
