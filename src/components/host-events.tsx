import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Pencil, Trash2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useInvites } from "@/components/host-invites";

const eventSchema = z.object({
  name: z.string().trim().min(2, "Name the function (e.g. Mehndi)").max(80),
  event_date: z.string().trim().max(20),
  start_time: z.string().trim().max(40),
  venue: z.string().trim().max(160),
  venue_address: z.string().trim().max(300),
  dress_code: z.string().trim().max(200),
  note: z.string().trim().max(600),
  rsvp_by: z.string().trim().max(20),
  background_image_url: z.string().trim().max(500),
});

type EventForm = z.infer<typeof eventSchema> & {
  sort_order: string;
  outfit_selection: boolean;
  invite_id: string;
};

const emptyEvent: EventForm = {
  name: "",
  event_date: "",
  start_time: "",
  venue: "",
  venue_address: "",
  dress_code: "",
  note: "",
  rsvp_by: "",
  background_image_url: "",
  sort_order: "",
  outfit_selection: true,
  invite_id: "",
};

export function HostEvents() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EventForm>({ ...emptyEvent });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const invites = useInvites();
  const inviteList = invites.data ?? [];
  const chosenInvite = form.invite_id || inviteList[0]?.id || "";

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("event-images").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const signed = await supabase.storage
        .from("event-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed.error || !signed.data?.signedUrl) {
        throw new Error(signed.error?.message ?? "Could not make a link for the picture.");
      }
      setForm((f) => ({ ...f, background_image_url: signed.data.signedUrl }));
      toast.success("Picture uploaded — remember to save the function.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The picture could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }


  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const reset = () => {
    setForm({ ...emptyEvent });
    setEditingId(null);
  };

  const save = async () => {
    const parsed = eventSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const order = Number.parseInt(form.sort_order, 10);
    const payload = {
      name: parsed.data.name,
      event_date: parsed.data.event_date || null,
      start_time: parsed.data.start_time || null,
      venue: parsed.data.venue || null,
      venue_address: parsed.data.venue_address || null,
      dress_code: parsed.data.dress_code || null,
      note: parsed.data.note || null,
      rsvp_by: parsed.data.rsvp_by || null,
      background_image_url: parsed.data.background_image_url || null,
      sort_order: Number.isFinite(order) ? order : (events.data?.length ?? 0) + 1,
      outfit_selection: form.outfit_selection,
      invite_id: chosenInvite || null,
    };
    try {
      if (editingId) {
        await guardedUpdate({
          table: "events",
          idColumn: "id",
          id: editingId,
          expectedUpdatedAt: events.data?.find((e) => e.id === editingId)?.updated_at,
          patch: payload,
          label: `“${parsed.data.name}”`,
        });
      } else {
        const { error } = await supabase.from("events").insert(payload);
        if (error) throw error;
      }
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not save.");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      return;
    }
    setBusy(false);
    toast.success(editingId ? "Function updated." : "Function added — guests can see it now.");
    reset();
    await queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const startEdit = (id: string) => {
    const ev = events.data?.find((e) => e.id === id);
    if (!ev) return;
    setEditingId(id);
    setForm({
      name: ev.name ?? "",
      event_date: ev.event_date ?? "",
      start_time: ev.start_time ?? "",
      venue: ev.venue ?? "",
      venue_address: ev.venue_address ?? "",
      dress_code: ev.dress_code ?? "",
      note: ev.note ?? "",
      rsvp_by: ev.rsvp_by ?? "",
      background_image_url: ev.background_image_url ?? "",
      sort_order: String(ev.sort_order ?? ""),
      outfit_selection: ev.outfit_selection ?? true,
      invite_id: ev.invite_id ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove “${name}”? Outfits tied to it stay in the lookbook.`)) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (editingId === id) reset();
    toast.success("Function removed.");
    await queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="panel h-fit p-6">
        <h2 className="text-xl">{editingId ? "Edit function" : "Add a function"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Everything you enter here appears on the guests' event page and in their RSVP.
        </p>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e-invite">Part of which invitation</Label>
            <select
              id="e-invite"
              value={chosenInvite}
              onChange={(e) => setForm((f) => ({ ...f, invite_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
            >
              {inviteList.length === 0 ? <option value="">No invitations yet</option> : null}
              {inviteList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Only the guests on this invitation will see this function.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-name">Function name</Label>
            <Input
              id="e-name"
              maxLength={80}
              value={form.name}
              placeholder="Mehndi"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-date">Date</Label>
              <Input
                id="e-date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-time">Start time</Label>
              <Input
                id="e-time"
                maxLength={40}
                value={form.start_time}
                placeholder="4:00 pm onwards"
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-venue">Venue</Label>
            <Input
              id="e-venue"
              maxLength={160}
              value={form.venue}
              placeholder="Devi Ratn, Jaipur"
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-address">Venue address</Label>
            <Textarea
              id="e-address"
              rows={2}
              maxLength={300}
              value={form.venue_address}
              placeholder="Jaipur–Kukas Road, Jaipur, Rajasthan"
              onChange={(e) => setForm((f) => ({ ...f, venue_address: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-dress">Dress code</Label>
            <Input
              id="e-dress"
              maxLength={200}
              value={form.dress_code}
              placeholder="Bright florals — please avoid red and ivory"
              onChange={(e) => setForm((f) => ({ ...f, dress_code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-note">Note for guests</Label>
            <Textarea
              id="e-note"
              rows={3}
              maxLength={600}
              value={form.note}
              placeholder="Coaches leave the hotel lobby 30 minutes before."
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-rsvp">RSVP by</Label>
              <Input
                id="e-rsvp"
                type="date"
                value={form.rsvp_by}
                onChange={(e) => setForm((f) => ({ ...f, rsvp_by: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-order">Order in the schedule</Label>
              <Input
                id="e-order"
                inputMode="numeric"
                maxLength={3}
                value={form.sort_order}
                placeholder="1"
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-bg">Card background image (link)</Label>
            <Input
              id="e-bg"
              maxLength={500}
              value={form.background_image_url}
              placeholder="https://…/mehndi-card.jpg"
              onChange={(e) => setForm((f) => ({ ...f, background_image_url: e.target.value }))}
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadImage(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading…" : "Upload a picture (JPG)"}
              </Button>
              {form.background_image_url.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, background_image_url: "" }))}
                >
                  Remove picture
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a link or upload a JPG from your computer. Best size: 1200 × 1600 px (portrait,
              3:4), at least 900 × 1200 px, under 5 MB. It sits behind the card text with a soft
              wash over it, so a calm, uncluttered picture works best. Leave empty for the plain
              watercolour card.
            </p>
            {form.background_image_url.trim() ? (
              <img
                src={form.background_image_url.trim()}
                alt=""
                className="h-32 w-full rounded-lg border border-border object-cover"
              />
            ) : null}
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-1">
              <Label htmlFor="e-selection">Guests choose an outfit for this function</Label>
              <p className="text-xs text-muted-foreground">
                Turn this off when guests wear their own clothes — the lookbook then hides this
                function entirely.
              </p>
            </div>
            <Switch
              id="e-selection"
              checked={form.outfit_selection}
              onCheckedChange={(v) => setForm((f) => ({ ...f, outfit_selection: v }))}
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={save} disabled={busy} className="flex-1">
              {busy ? "Saving…" : editingId ? "Save changes" : "Add function"}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel h-fit p-6">
        <h2 className="text-xl">The schedule ({events.data?.length ?? 0})</h2>
        <ul className="mt-4 divide-y divide-border">
          {(events.data ?? []).map((ev) => (
            <li key={ev.id} className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate">
                  {ev.name}
                  {ev.outfit_selection ? null : (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      Own outfit
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    inviteList.find((v) => v.id === ev.invite_id)?.name,
                    ev.event_date,
                    ev.start_time,
                    ev.venue,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No date or venue yet"}
                </p>
                {ev.dress_code ? (
                  <p className="mt-1 truncate text-xs text-primary">{ev.dress_code}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${ev.name}`}
                onClick={() => startEdit(ev.id)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${ev.name}`}
                onClick={() => remove(ev.id, ev.name)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
          {(events.data ?? []).length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">
              No functions yet — add your first one and guests will see it immediately.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
