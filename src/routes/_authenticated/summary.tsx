import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Shirt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useGuestEvent } from "@/lib/guest-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orderStatusLabel, orderStatusVariant } from "@/lib/order-status";
import { GuestArrivals } from "@/components/guest-arrivals";


export const Route = createFileRoute("/_authenticated/summary")({
  head: () => ({
    meta: [
      { title: "Confirm Your Look — Lehenga, Designer & Size" },
      {
        name: "description",
        content:
          "Check the look set aside for you, confirm the garment, designer and size, and follow its tailoring status.",
      },
      { property: "og:title", content: "Confirm Your Look — Lehenga, Designer & Size" },
      {
        property: "og:description",
        content: "Confirm the garment, designer and size of the outfit chosen for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfirmPage,
});

const GARMENTS = ["Lehenga", "Saree", "Anarkali", "Gown", "Sherwani", "Kurta set", "Suit"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Made to measure"];

type Row = {
  id: string;
  outfit_id: string;
  guest_name: string | null;
  build_garment: string | null;
  build_size: string | null;
  build_fabric: string | null;
  order_status: string | null;
  outfits: {
    title: string;
    designer: string | null;
    garment_type: string | null;
    size_note: string | null;
    image_url: string | null;
    event_id: string | null;
  } | null;
};

/** One page where a guest confirms the garment, designer and size of the look set aside for them. */
function ConfirmPage() {
  const qc = useQueryClient();

  const outfitsCovered = useQuery({
    queryKey: ["pay-outfits-covered"],
    queryFn: async () => {
      const { data } = await supabase.rpc("my_outfits_paid_by_host");
      return (data as boolean | null) ?? true;
    },
  });

  const me = useQuery({
    queryKey: ["summary-me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("household")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data ?? null;
    },
  });
  const household = (me.data?.household ?? "").trim();


  const looks = useQuery({
    queryKey: ["confirm-looks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, outfit_id, guest_name, build_garment, build_size, build_fabric, order_status, outfits(title, designer, garment_type, size_note, image_url, event_id)",
        )
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const [draft, setDraft] = useState<
    Record<string, { garment: string; size: string; fabric: string }>
  >({});

  const guestEvent = useGuestEvent();

  useEffect(() => {
    const rows = (looks.data ?? []).filter((r) =>
      guestEvent.allows(r.outfits?.event_id ?? null),
    );
    if (rows.length === 0) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.id]) continue;
        next[r.id] = {
          garment: r.build_garment ?? r.outfits?.garment_type ?? "",
          size: r.build_size ?? "",
          fabric: r.build_fabric ?? "",
        };
      }
      return next;
    });
  }, [looks.data]);

  const confirming = useMutation({
    mutationFn: async (row: Row) => {
      const d = draft[row.id];
      if (!d?.garment || !d.size) throw new Error("missing");
      const { error } = await supabase
        .from("reservations")
        .update({
          build_garment: d.garment,
          build_size: d.size,
          build_fabric: d.fabric.trim() || null,
          status: "confirmed",
          order_status_updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Confirmed — the hosts and the atelier can see it now.");
      qc.invalidateQueries({ queryKey: ["confirm-looks"] });
      qc.invalidateQueries({ queryKey: ["plan-looks"] });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error && err.message === "missing"
          ? "Pick the garment and the size first."
          : "Couldn't save that — try again.",
      ),
  });

  const garmentOptions = useMemo(() => GARMENTS, []);
  const rows = (looks.data ?? []).filter((r) =>
    guestEvent.allows(r.outfits?.event_id ?? null),
  );

  return (
    <main className="bg-zari">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <p className="text-center text-eyebrow">Your look</p>
        <h1 className="mt-3 text-center text-3xl sm:text-4xl">Confirm what you'll wear</h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          Check the piece set aside for you, tell us the garment, the size and any fabric preference,
          then confirm. You'll see its tailoring status here as it moves along.
        </p>

        {outfitsCovered.data !== false ? (
          <p className="mx-auto mt-4 max-w-xl rounded-md bg-secondary/60 p-3 text-center text-sm">
            Your hosts are covering these outfits — nothing to pay.
          </p>
        ) : null}

        {looks.isLoading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Fetching your looks…</p>
        ) : rows.length === 0 ? (
          <div className="panel mt-10 p-5 text-center sm:p-6">
            <p className="text-sm text-muted-foreground">
              No look is set aside for you yet — choose one and it will appear here to confirm.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link to="/outfits">Choose a look</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-10 space-y-5">
            {rows.map((row) => {
              const d = draft[row.id] ?? { garment: "", size: "", fabric: "" };
              const set = (patch: Partial<typeof d>) =>
                setDraft((prev) => ({ ...prev, [row.id]: { ...d, ...patch } }));
              const done = Boolean(row.build_garment && row.build_size);
              return (
                <li key={row.id} className="panel p-5 sm:p-6">
                  <div className="flex flex-wrap items-start gap-4">
                    {row.outfits?.image_url ? (
                      <img
                        src={row.outfits.image_url}
                        alt=""
                        loading="lazy"
                        className="size-24 shrink-0 rounded-md object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl">{row.outfits?.title ?? "Look"}</h2>
                        <Badge variant={orderStatusVariant(row.order_status)}>
                          {orderStatusLabel(row.order_status)}
                        </Badge>
                        {done ? (
                          <Badge variant="outline" className="gap-1">
                            <BadgeCheck className="size-3" /> Confirmed
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.outfits?.designer
                          ? `Designer: ${row.outfits.designer}`
                          : "Designer to be confirmed"}
                        {row.guest_name ? ` · for ${row.guest_name}` : ""}
                      </p>
                      {row.outfits?.size_note ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Boutique note: {row.outfits.size_note}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`g-${row.id}`}>Garment</Label>
                      <select
                        id={`g-${row.id}`}
                        className="field-select w-full rounded-md border border-border bg-background px-3 text-sm"
                        value={d.garment}
                        onChange={(e) => set({ garment: e.target.value })}
                      >
                        <option value="">Choose…</option>
                        {[
                          ...new Set(
                            [row.outfits?.garment_type, ...garmentOptions].filter(
                              (v): v is string => Boolean(v),
                            ),
                          ),
                        ].map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`s-${row.id}`}>Size</Label>
                      <select
                        id={`s-${row.id}`}
                        className="field-select w-full rounded-md border border-border bg-background px-3 text-sm"
                        value={d.size}
                        onChange={(e) => set({ size: e.target.value })}
                      >
                        <option value="">Choose…</option>
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`f-${row.id}`}>Fabric (optional)</Label>
                      <Input
                        id={`f-${row.id}`}
                        value={d.fabric}
                        placeholder="Silk, georgette…"
                        onChange={(e) => set({ fabric: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => confirming.mutate(row)}
                      disabled={confirming.isPending}
                      className="gap-2"
                    >
                      <Shirt className="size-4" />
                      {done ? "Update my confirmation" : "Confirm this look"}
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/measurements">Send measurements</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {household ? (
          <div className="mt-8">
            <GuestArrivals household={household} />
          </div>
        ) : null}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Something not right? Message the hosts from your invitation page.
        </p>

      </div>
    </main>
  );
}
