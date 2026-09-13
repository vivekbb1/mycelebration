import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Scissors, Ruler, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { claimBoutiqueAccess } from "@/lib/boutique-access.functions";
import { ORDER_STATUSES, orderStatusLabel, orderStatusVariant } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export const Route = createFileRoute("/_authenticated/atelier")({
  head: () => ({
    meta: [
      { title: "Atelier Orders — The Wedding Wardrobe" },
      {
        name: "description",
        content:
          "Boutique and tailor view: the looks reserved from your atelier, with each guest's measurements and the function they're for.",
      },
      { property: "og:title", content: "Atelier Orders — The Wedding Wardrobe" },
      {
        property: "og:description",
        content: "Your boutique's orders for the wedding, with guest measurements for tailoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AtelierPage,
});

const MEASURE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "height", label: "Height" },
  { key: "bust", label: "Bust / chest" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hip" },
  { key: "shoulder", label: "Shoulder" },
  { key: "sleeve_length", label: "Sleeve" },
  { key: "top_length", label: "Blouse / kurta length" },
  { key: "bottom_length", label: "Skirt / trouser length" },
  { key: "inseam", label: "Inseam" },
];

function AtelierPage() {
  const queryClient = useQueryClient();
  const joinBoutique = useServerFn(claimBoutiqueAccess);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const boutiques = useQuery({
    queryKey: ["my-boutiques"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boutiques")
        .select("id, name, city, contact_name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const isStylist = (boutiques.data ?? []).length > 0;

  const outfits = useQuery({
    queryKey: ["atelier-outfits"],
    enabled: isStylist,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("id, title, designer, image_url, garment_type, size_note, event_id, boutique_id")
        .not("boutique_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events"],
    enabled: isStylist,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // RLS returns only reservations for this boutique's own outfits.
  const orders = useQuery({
    queryKey: ["atelier-orders"],
    enabled: isStylist,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, outfit_id, guest_id, guest_name, created_at")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // RLS returns only measurements of guests who reserved this boutique's outfits.
  const measurements = useQuery({
    queryKey: ["atelier-measurements"],
    enabled: isStylist,
    queryFn: async () => {
      const { data, error } = await supabase.from("measurements").select("*");
      if (error) throw error;
      return data;
    },
  });

  const boutiqueIds = useMemo(
    () => new Set((boutiques.data ?? []).map((b) => b.id)),
    [boutiques.data],
  );

  const rows = useMemo(() => {
    return (orders.data ?? [])
      .map((o) => {
        const outfit = outfits.data?.find((x) => x.id === o.outfit_id);
        if (!outfit || !outfit.boutique_id || !boutiqueIds.has(outfit.boutique_id)) return null;
        const ev = outfit.event_id ? events.data?.find((e) => e.id === outfit.event_id) : undefined;
        const m = measurements.data?.find((x) => x.guest_id === o.guest_id);
        return {
          id: o.id,
          guest: o.guest_name || "Guest",
          placed: o.created_at,
          outfit,
          functionName: ev?.name ?? null,
          functionDate: ev?.event_date ?? null,
          boutique: boutiques.data?.find((b) => b.id === outfit.boutique_id)?.name ?? "",
          measurements: m ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [orders.data, outfits.data, events.data, measurements.data, boutiques.data, boutiqueIds]);

  const join = async () => {
    if (!code.trim()) {
      toast.error("Enter the code the hosts sent you.");
      return;
    }
    setBusy(true);
    let result;
    try {
      result = await joinBoutique({ data: { code: code.trim() } });
    } catch {
      setBusy(false);
      toast.error("We couldn't check that code. Please try again.");
      return;
    }
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "That code was not recognised.");
      return;
    }
    toast.success(`Welcome, ${result.boutiqueName}.`);
    setCode("");
    await queryClient.invalidateQueries({ queryKey: ["my-boutiques"] });
  };

  if (boutiques.isLoading) {
    return <p className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!isStylist) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6">
          <Scissors className="size-5 text-primary" />
          <h1 className="mt-4 text-2xl">Atelier access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            For designers, boutiques and tailors working on this wedding. Enter the private code the
            hosts sent you to see the looks reserved from your atelier and the guests' measurements.
          </p>
          <div className="mt-5 space-y-3">
            <Label htmlFor="boutique-code">Boutique code</Label>
            <Input
              id="boutique-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ATELIER-3F9K"
              autoComplete="off"
            />
            <Button className="w-full" disabled={busy} onClick={join}>
              Open my orders
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const pending = rows.filter((r) => !r.measurements).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.18em] text-primary">Atelier</p>
      <h1 className="mt-2 text-3xl">
        {(boutiques.data ?? []).map((b) => b.name).join(" · ")}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        These are the looks guests have reserved from your atelier, with their measurements for
        tailoring. You only ever see your own orders.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat icon={Store} label="Orders" value={String(rows.length)} />
        <Stat
          icon={Ruler}
          label="Measurements in"
          value={String(rows.length - pending)}
        />
        <Stat icon={Scissors} label="Awaiting measurements" value={String(pending)} />
      </div>

      <div className="gold-rule my-8" />

      {orders.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your orders…</p>
      ) : rows.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          No looks from your atelier have been reserved yet. This page fills up as guests choose
          their outfits.
        </p>
      ) : (
        <div className="space-y-6">
          {rows.map((r) => {
            const unit = r.measurements?.unit ?? "cm";
            return (
              <article key={r.id} className="panel overflow-hidden md:flex">
                {r.outfit.image_url ? (
                  <img
                    src={r.outfit.image_url}
                    alt={r.outfit.title}
                    loading="lazy"
                    className="h-56 w-full object-cover md:h-auto md:w-56"
                  />
                ) : null}
                <div className="flex-1 p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      {r.functionName ? (
                        <p className="text-xs uppercase tracking-[0.18em] text-primary">
                          {r.functionName}
                          {r.functionDate ? ` · ${r.functionDate}` : ""}
                        </p>
                      ) : null}
                      <h2 className="mt-1 text-2xl">{r.outfit.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {[r.outfit.designer, r.outfit.garment_type].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Badge variant={r.measurements ? "default" : "secondary"}>
                      {r.measurements ? "Ready to tailor" : "Awaiting measurements"}
                    </Badge>
                  </div>

                  <p className="mt-4 text-sm">
                    <span className="text-muted-foreground">Guest: </span>
                    {r.guest}
                    {r.outfit.size_note ? (
                      <>
                        <span className="text-muted-foreground"> · Size noted: </span>
                        {r.outfit.size_note}
                      </>
                    ) : null}
                  </p>

                  {r.measurements ? (
                    <>
                      <p className="mt-5 text-xs uppercase tracking-[0.18em] text-primary">
                        Measurements in {unit === "in" ? "inches" : "centimetres"}
                      </p>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {MEASURE_FIELDS.map((f) => {
                          const value = (r.measurements as Record<string, unknown>)[f.key];
                          return (
                            <div key={f.key} className="flex items-baseline justify-between gap-3">
                              <dt className="text-muted-foreground">{f.label}</dt>
                              <dd>
                                {value === null || value === undefined
                                  ? "—"
                                  : `${String(value)} ${unit}`}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                      {r.measurements.notes ? (
                        <p className="mt-4 text-sm text-muted-foreground">
                          Note from the guest: {r.measurements.notes}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-5 text-sm text-muted-foreground">
                      The guest hasn't sent measurements yet. The hosts are chasing them.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="panel p-5">
      <Icon className="size-4 text-primary" />
      <p className="mt-3 text-2xl">{value}</p>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
  );
}
