import { PUBLIC_ORIGIN } from "@/lib/public-url";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type BoutiqueForm = {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  notes: string;
};

const empty: BoutiqueForm = {
  name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  city: "",
  notes: "",
};

function makeCode(name: string) {
  const stem =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "ATELIER";
  const tail = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return `${stem}-${tail}`;
}

export function HostBoutiques() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BoutiqueForm>({ ...empty });
  const [editingId, setEditingId] = useState<string | null>(null);

  const boutiques = useQuery({
    queryKey: ["boutiques"],
    queryFn: async () => {
      const { data, error } = await supabase.from("boutiques").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["outfits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("outfits").select("id, boutique_id");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error("Give the boutique or designer a name.");
      const payload = {
        name,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
      };
      const { error } = editingId
        ? await supabase.from("boutiques").update(payload).eq("id", editingId)
        : await supabase
            .from("boutiques")
            .insert({ ...payload, access_code: makeCode(name) });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success(editingId ? "Boutique updated." : "Boutique added.");
      setForm({ ...empty });
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["boutiques"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("boutiques").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Boutique removed.");
    if (editingId === id) {
      setEditingId(null);
      setForm({ ...empty });
    }
    await queryClient.invalidateQueries({ queryKey: ["boutiques"] });
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  const copyAccess = async (name: string, code: string) => {
    const url = `${PUBLIC_ORIGIN}/atelier`;
    const message =
      `Hello from the wedding team — you can now see the looks our guests have reserved from ${name}, ` +
      `along with their measurements for tailoring.\n\n` +
      `1. Open ${url}\n2. Create an account with this email address\n3. Enter your atelier code: ${code}\n\n` +
      `You'll only see your own orders. Thank you!`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Message copied — send it to the boutique.");
    } catch {
      toast.error("Couldn't copy. Select the code manually.");
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="panel p-4 sm:p-6">
        <h2 className="text-xl">{editingId ? "Edit boutique" : "Add a designer or boutique"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each one gets a private code. Their stylist signs in, enters the code, and sees only the
          looks reserved from them plus those guests' measurements.
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="b-name">Boutique / designer *</Label>
            <Input
              id="b-name"
              value={form.name}
              placeholder="e.g. Anita Dongre — Pernia's Pop-Up Shop"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-contact">Stylist / contact</Label>
              <Input
                id="b-contact"
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-city">City</Label>
              <Input
                id="b-city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-email">Email</Label>
              <Input
                id="b-email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-phone">Phone / WhatsApp</Label>
              <Input
                id="b-phone"
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-notes">Notes for your team</Label>
            <Textarea
              id="b-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editingId ? "Save changes" : "Add boutique"}
            </Button>
            {editingId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...empty });
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel p-4 sm:p-6">
        <h2 className="text-xl">Ateliers</h2>
        <ul className="mt-4 divide-y divide-border/70">
          {(boutiques.data ?? []).map((b) => {
            const looks = (outfits.data ?? []).filter((o) => o.boutique_id === b.id).length;
            return (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div>
                  <p className="text-base">{b.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[b.contact_name, b.city, b.contact_email, b.contact_phone]
                      .filter(Boolean)
                      .join(" · ") || "No contact details yet"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Code {b.access_code}</Badge>
                    <Badge variant="outline">
                      {looks} {looks === 1 ? "look" : "looks"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Copy access message for ${b.name}`}
                    onClick={() => copyAccess(b.name, b.access_code)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(b.id);
                      setForm({
                        name: b.name,
                        contact_name: b.contact_name ?? "",
                        contact_email: b.contact_email ?? "",
                        contact_phone: b.contact_phone ?? "",
                        city: b.city ?? "",
                        notes: b.notes ?? "",
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${b.name}`}
                    onClick={() => remove(b.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
          {(boutiques.data ?? []).length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">
              No boutiques yet. Add the designers you're sourcing looks from.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
