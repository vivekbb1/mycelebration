import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, Trash2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/host")({
  component: HostPage,
});

const outfitSchema = z.object({
  title: z.string().trim().min(2, "Give the outfit a name").max(120),
  designer: z.string().trim().max(120).optional(),
  boutique_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//.test(v), "Link must start with http:// or https://")
    .optional(),
  image_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//.test(v), "Image link must start with http(s)://")
    .optional(),
  color_family: z.string().trim().max(60).optional(),
  garment_type: z.string().trim().max(60).optional(),
  size_note: z.string().trim().max(60).optional(),
  price_note: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(600).optional(),
});

const inviteSchema = z.object({
  guest_name: z.string().trim().min(2, "Enter the guest's name").max(100),
  email: z.string().trim().max(255).optional(),
});

const emptyOutfit = {
  title: "",
  designer: "",
  boutique_url: "",
  image_url: "",
  color_family: "",
  garment_type: "",
  size_note: "",
  price_note: "",
  notes: "",
  gender: "women",
  event_id: "",
};

function makeCode(name: string) {
  const base =
    name
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .slice(0, 8) || "GUEST";
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function HostPage() {
  const queryClient = useQueryClient();

  const role = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return Boolean(data);
    },
  });

  if (role.isLoading) {
    return <p className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!role.data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="mt-4 text-2xl">Host access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is for the hosting family. If you're the host and no one has claimed host
            access yet, you can claim it now.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={async () => {
              const { data, error } = await supabase.rpc("claim_host_access");
              if (error) {
                toast.error(error.message);
                return;
              }
              const result = data as { ok: boolean; error?: string } | null;
              if (!result?.ok) {
                toast.error(result?.error ?? "Host access is already claimed");
                return;
              }
              toast.success("You're the host now.");
              await queryClient.invalidateQueries({ queryKey: ["is-admin"] });
            }}
          >
            Claim host access
          </Button>
        </div>
      </main>
    );
  }

  return <HostDashboard />;
}

function HostDashboard() {
  const queryClient = useQueryClient();
  const [outfit, setOutfit] = useState({ ...emptyOutfit });
  const [invite, setInvite] = useState({ guest_name: "", email: "" });
  const [busy, setBusy] = useState(false);

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, dress_code, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["outfits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("id, title, designer, event_id, color_family, image_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const reservations = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, outfit_id, guest_id, guest_name, created_at");
      if (error) throw error;
      return data;
    },
  });

  const invites = useQuery({
    queryKey: ["invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, code, guest_name, email, claimed_by, claimed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const measurements = useQuery({
    queryKey: ["all-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("measurements").select("*");
      if (error) throw error;
      return data;
    },
  });

  const addOutfit = async () => {
    const parsed = outfitSchema.safeParse(outfit);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("outfits").insert({
      title: parsed.data.title,
      designer: parsed.data.designer || null,
      boutique_url: parsed.data.boutique_url || null,
      image_url: parsed.data.image_url || null,
      color_family: parsed.data.color_family || null,
      garment_type: parsed.data.garment_type || null,
      size_note: parsed.data.size_note || null,
      price_note: parsed.data.price_note || null,
      notes: parsed.data.notes || null,
      gender: outfit.gender,
      event_id: outfit.event_id || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Outfit added to the lookbook.");
    setOutfit({ ...emptyOutfit });
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  const removeOutfit = async (id: string) => {
    const { error } = await supabase.from("outfits").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  const addInvite = async () => {
    const parsed = inviteSchema.safeParse(invite);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("invite_codes").insert({
      code: makeCode(parsed.data.guest_name),
      guest_name: parsed.data.guest_name,
      email: parsed.data.email || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInvite({ guest_name: "", email: "" });
    await queryClient.invalidateQueries({ queryKey: ["invites"] });
  };

  const copyInvite = async (code: string, guestName: string) => {
    const link = `${window.location.origin}/auth?code=${encodeURIComponent(code)}`;
    const message = `Hi ${guestName}! As our gift, we've put together a wardrobe of festive Indian outfits for the wedding. Open your invitation, pick your looks and send your measurements: ${link} (your code: ${code})`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Invitation message copied — paste it into WhatsApp or email.");
    } catch {
      toast.error("Couldn't copy. Your invite link is: " + link);
    }
  };

  const outfitTitle = (id: string) => outfits.data?.find((o) => o.id === id)?.title ?? "Outfit";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-eyebrow">Host area</p>
      <h1 className="mt-3 text-4xl">Run the wardrobe</h1>

      <Tabs defaultValue="outfits" className="mt-8">
        <TabsList>
          <TabsTrigger value="outfits">Outfits</TabsTrigger>
          <TabsTrigger value="invites">Invitations</TabsTrigger>
          <TabsTrigger value="guests">Reservations</TabsTrigger>
        </TabsList>

        <TabsContent value="outfits" className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="panel h-fit p-6">
            <h2 className="text-xl">Add an outfit</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Copy the image link and product link from Pernia's Pop-Up Shop (or any boutique) and
              paste them here.
            </p>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="o-title">Outfit name</Label>
                <Input
                  id="o-title"
                  maxLength={120}
                  value={outfit.title}
                  onChange={(e) => setOutfit((o) => ({ ...o, title: e.target.value }))}
                  placeholder="Emerald zardosi lehenga"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="o-designer">Designer / boutique</Label>
                  <Input
                    id="o-designer"
                    maxLength={120}
                    value={outfit.designer}
                    onChange={(e) => setOutfit((o) => ({ ...o, designer: e.target.value }))}
                    placeholder="Pernia's Pop-Up Shop"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Function</Label>
                  <Select
                    value={outfit.event_id || undefined}
                    onValueChange={(v) => setOutfit((o) => ({ ...o, event_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a function" />
                    </SelectTrigger>
                    <SelectContent>
                      {(events.data ?? []).map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-image">Image link</Label>
                <Input
                  id="o-image"
                  maxLength={500}
                  value={outfit.image_url}
                  onChange={(e) => setOutfit((o) => ({ ...o, image_url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-link">Product link</Label>
                <Input
                  id="o-link"
                  maxLength={500}
                  value={outfit.boutique_url}
                  onChange={(e) => setOutfit((o) => ({ ...o, boutique_url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="o-color">Colour family</Label>
                  <Input
                    id="o-color"
                    maxLength={60}
                    value={outfit.color_family}
                    onChange={(e) => setOutfit((o) => ({ ...o, color_family: e.target.value }))}
                    placeholder="Emerald"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-type">Garment type</Label>
                  <Input
                    id="o-type"
                    maxLength={60}
                    value={outfit.garment_type}
                    onChange={(e) => setOutfit((o) => ({ ...o, garment_type: e.target.value }))}
                    placeholder="Lehenga"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="o-size">Size note</Label>
                  <Input
                    id="o-size"
                    maxLength={60}
                    value={outfit.size_note}
                    onChange={(e) => setOutfit((o) => ({ ...o, size_note: e.target.value }))}
                    placeholder="Made to measure"
                  />
                </div>
                <div className="space-y-2">
                  <Label>For</Label>
                  <Select
                    value={outfit.gender}
                    onValueChange={(v) => setOutfit((o) => ({ ...o, gender: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="women">Women</SelectItem>
                      <SelectItem value="men">Men</SelectItem>
                      <SelectItem value="unisex">Anyone</SelectItem>
                      <SelectItem value="kids">Kids</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-notes">Notes for guests</Label>
                <Textarea
                  id="o-notes"
                  rows={3}
                  maxLength={600}
                  value={outfit.notes}
                  onChange={(e) => setOutfit((o) => ({ ...o, notes: e.target.value }))}
                  placeholder="Comes with a stitched blouse and matching dupatta."
                />
              </div>
              <Button onClick={addOutfit} disabled={busy} className="w-full">
                {busy ? "Saving…" : "Add to lookbook"}
              </Button>
            </div>
          </div>

          <div className="panel h-fit p-6">
            <h2 className="text-xl">In the lookbook ({outfits.data?.length ?? 0})</h2>
            <ul className="mt-4 divide-y divide-border">
              {(outfits.data ?? []).map((o) => {
                const res = reservations.data?.find((r) => r.outfit_id === o.id);
                return (
                  <li key={o.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{o.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(events.data ?? []).find((e) => e.id === o.event_id)?.name ??
                          "No function"}
                        {o.designer ? ` · ${o.designer}` : ""}
                      </p>
                    </div>
                    {res ? (
                      <Badge variant="secondary">{res.guest_name ?? "Reserved"}</Badge>
                    ) : (
                      <Badge>Available</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove outfit"
                      onClick={() => removeOutfit(o.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
              {(outfits.data ?? []).length === 0 ? (
                <li className="py-4 text-sm text-muted-foreground">No outfits added yet.</li>
              ) : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="invites" className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="panel h-fit p-6">
            <h2 className="text-xl">Invite a guest</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Each guest gets their own code and link. Copy the ready-made message and send it on
              WhatsApp or email.
            </p>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="i-name">Guest name</Label>
                <Input
                  id="i-name"
                  maxLength={100}
                  value={invite.guest_name}
                  onChange={(e) => setInvite((i) => ({ ...i, guest_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-email">Email (optional)</Label>
                <Input
                  id="i-email"
                  maxLength={255}
                  value={invite.email}
                  onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
                />
              </div>
              <Button onClick={addInvite} disabled={busy} className="w-full">
                {busy ? "Saving…" : "Create invitation"}
              </Button>
            </div>
          </div>

          <div className="panel h-fit p-6">
            <h2 className="text-xl">Invitations ({invites.data?.length ?? 0})</h2>
            <ul className="mt-4 divide-y divide-border">
              {(invites.data ?? []).map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{inv.guest_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.code}
                      {inv.email ? ` · ${inv.email}` : ""}
                    </p>
                  </div>
                  <Badge variant={inv.claimed_by ? "secondary" : "default"}>
                    {inv.claimed_by ? "Registered" : "Not yet"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy invitation message"
                    onClick={() => copyInvite(inv.code, inv.guest_name)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </li>
              ))}
              {(invites.data ?? []).length === 0 ? (
                <li className="py-4 text-sm text-muted-foreground">No invitations yet.</li>
              ) : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="guests" className="mt-6">
          <div className="panel p-6">
            <h2 className="text-xl">Reservations & measurements</h2>
            <ul className="mt-4 space-y-4">
              {(reservations.data ?? []).map((r) => {
                const m = measurements.data?.find((row) => row.guest_id === r.guest_id);
                return (
                  <li key={r.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        <span className="text-primary">{r.guest_name ?? "Guest"}</span> —{" "}
                        {outfitTitle(r.outfit_id)}
                      </p>
                      <Badge variant={m ? "default" : "secondary"}>
                        {m ? "Measurements in" : "Awaiting measurements"}
                      </Badge>
                    </div>
                    {m ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {(
                          [
                            ["Height", m.height],
                            ["Bust", m.bust],
                            ["Waist", m.waist],
                            ["Hip", m.hip],
                            ["Shoulder", m.shoulder],
                            ["Sleeve", m.sleeve_length],
                            ["Top length", m.top_length],
                            ["Bottom length", m.bottom_length],
                            ["Inseam", m.inseam],
                          ] as const
                        )
                          .filter(([, v]) => v != null)
                          .map(([label, v]) => `${label} ${v}${m.unit}`)
                          .join(" · ") || "No values entered yet"}
                        {m.notes ? ` — ${m.notes}` : ""}
                      </p>
                    ) : null}
                  </li>
                );
              })}
              {(reservations.data ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">No reservations yet.</li>
              ) : null}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
