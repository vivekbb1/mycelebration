import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Pencil, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSelectedEvent } from "@/lib/selected-event";
import { removeRegisteredGuest, updateRegisteredGuest } from "@/lib/family-signup.functions";

type Row = { id: string; name: string; email: string; phone: string; gender: string; household: string; claimedAt: string | null };

/** Every guest who has signed in to this celebration, so hosts can clear out test accounts. */
export function HostRegistered() {
  const { inviteId } = useSelectedEvent();
  const qc = useQueryClient();
  const remove = useServerFn(removeRegisteredGuest);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const update = useServerFn(updateRegisteredGuest);
  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", gender: "", familyName: "" });
  const openEdit = (r: Row) => {
    setEdit(r);
    setForm({ name: r.name, email: r.email, phone: r.phone, gender: r.gender, familyName: r.household });
  };
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const r = await update({ data: { codeId: edit.id, ...form, gender: form.gender as "men" } });
      if (!r.ok) throw new Error(r.error);
      toast.success("Details saved.");
      setEdit(null);
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save those details.");
    } finally {
      setBusy(false);
    }
  };

  const list = useQuery({
    queryKey: ["registered-guests", inviteId],
    enabled: Boolean(inviteId),
    queryFn: async (): Promise<Row[]> => {
      const codes = await supabase
        .from("invite_codes")
        .select("id, guest_name, email, phone, gender, household, claimed_by, claimed_at")
        .eq("invite_id", inviteId as string)
        .not("claimed_by", "is", null)
        .order("claimed_at", { ascending: false });
      if (codes.error) throw codes.error;
      const ids = [...new Set((codes.data ?? []).map((c) => c.claimed_by as string))];
      const profiles = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as { id: string; full_name: string; email: string | null }[] };
      return (codes.data ?? []).map((c) => {
        const p = profiles.data?.find((x) => x.id === c.claimed_by);
        return {
          id: c.id,
          name: c.guest_name || p?.full_name || "Guest",
          email: p?.email || c.email || "",
          phone: c.phone ?? "",
          gender: c.gender ?? "",
          household: c.household ?? "",
          claimedAt: c.claimed_at,
        };
      });
    },
  });

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = list.data ?? [];
    return s ? rows.filter((r) => `${r.name} ${r.email} ${r.household}`.toLowerCase().includes(s)) : rows;
  }, [list.data, q]);

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await remove({ data: { codeId: target.id } });
      if (!r.ok) throw new Error(r.error);
      toast.success(r.accountDeleted ? `${target.name} and their account were deleted.` : `${target.name} was removed.`);
      setTarget(null);
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove that guest.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Registered guests ({shown.length})</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who has signed in to this celebration. Remove test accounts here.
          </p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="w-full sm:w-56" />
      </div>
      <ul className="mt-4 divide-y divide-border">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[r.email, r.household, r.claimedAt ? `joined ${new Date(r.claimedAt).toLocaleDateString()}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Send ${r.name} a password reset link`}
              title="Send password reset link"
              disabled={!r.email}
              onClick={async () => {
                if (!window.confirm(`Email a password reset link to ${r.email}?`)) return;
                const { error } = await supabase.auth.resetPasswordForEmail(r.email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success(`Reset link sent to ${r.email}`);
              }}
            >
              <KeyRound className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Remove ${r.name}`} onClick={() => setTarget(r)}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {!list.isLoading && shown.length === 0 ? (
          <li className="py-4 text-sm text-muted-foreground">No registered guests yet.</li>
        ) : null}
      </ul>

      <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit guest details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rg-name">Full name</Label>
              <Input id="rg-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="rg-email">Email</Label>
                <Input id="rg-email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rg-phone">Mobile</Label>
                <Input id="rg-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Wardrobe</Label>
              <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="men">Man</SelectItem>
                  <SelectItem value="women">Woman</SelectItem>
                  <SelectItem value="boy">Boy</SelectItem>
                  <SelectItem value="girl">Girl</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rg-family">Family name</Label>
              <Input id="rg-family" value={form.familyName} onChange={(e) => setForm((f) => ({ ...f, familyName: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Changing this renames the whole family, for every member.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy || form.name.trim().length < 2}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {target?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their place in this celebration, chosen looks and measurements are deleted. If the account
              isn't used anywhere else, it's deleted too, so the email can sign up again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void confirm(); }}>
              {busy ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
