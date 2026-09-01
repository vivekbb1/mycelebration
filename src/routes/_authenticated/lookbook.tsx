import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, ExternalLink, Lock, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimInvite } from "@/routes/auth";

export const Route = createFileRoute("/_authenticated/lookbook")({
  component: Lookbook,
});

type Outfit = {
  id: string;
  event_id: string | null;
  title: string;
  designer: string | null;
  boutique_url: string | null;
  image_url: string | null;
  color_family: string | null;
  gender: string;
  garment_type: string | null;
  size_note: string | null;
  price_note: string | null;
  notes: string | null;
  is_available: boolean;
};

function Lookbook() {
  const queryClient = useQueryClient();
  const [activeEvent, setActiveEvent] = useState<string>("all");
  const [code, setCode] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, invite_claimed")
        .eq("id", user.id)
        .maybeSingle();
      return data ?? { id: user.id, full_name: "", invite_claimed: false };
    },
  });

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
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Outfit[];
    },
  });

  const reservations = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, outfit_id, guest_id, guest_name");
      if (error) throw error;
      return data;
    },
  });

  const takenBy = useMemo(() => {
    const map = new Map<string, { guest_id: string; guest_name: string | null }>();
    for (const r of reservations.data ?? []) {
      map.set(r.outfit_id, { guest_id: r.guest_id, guest_name: r.guest_name });
    }
    return map;
  }, [reservations.data]);

  const visible = (outfits.data ?? []).filter(
    (o) => activeEvent === "all" || o.event_id === activeEvent,
  );

  const reserve = async (outfit: Outfit) => {
    setBusyId(outfit.id);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setBusyId(null);
      return;
    }
    const { error } = await supabase.from("reservations").insert({
      outfit_id: outfit.id,
      guest_id: user.id,
      guest_name: me.data?.full_name || user.email,
    });
    setBusyId(null);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Another guest just claimed this look — please pick a different one."
          : error.message,
      );
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      return;
    }
    toast.success(`${outfit.title} is yours.`);
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  const release = async (outfit: Outfit) => {
    setBusyId(outfit.id);
    const { error } = await supabase.from("reservations").delete().eq("outfit_id", outfit.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reservation released.");
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  if (me.isLoading) {
    return <p className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (me.data && !me.data.invite_claimed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6">
          <Lock className="size-5 text-primary" />
          <h1 className="mt-4 text-2xl">Enter your invitation code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a personal code with your invitation on WhatsApp or email.
          </p>
          <div className="mt-5 space-y-2">
            <Label htmlFor="claim-code">Invitation code</Label>
            <Input
              id="claim-code"
              value={code}
              maxLength={64}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. MEHNDI-4821"
            />
          </div>
          <Button
            className="mt-4 w-full"
            onClick={async () => {
              if (await claimInvite(code)) {
                await queryClient.invalidateQueries({ queryKey: ["me"] });
              }
            }}
          >
            Unlock the wardrobe
          </Button>
        </div>
      </main>
    );
  }

  const myReservations = (reservations.data ?? []).filter((r) => r.guest_id === me.data?.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-eyebrow">The lookbook</p>
      <h1 className="mt-3 text-4xl">Choose your looks</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Each outfit can be claimed by one guest only. Reserve one per function — the outfit and
        tailoring are our gift. Fill in your{" "}
        <span className="text-primary">measurements</span> once you've chosen.
      </p>

      {myReservations.length > 0 ? (
        <p className="mt-4 text-sm text-primary">
          You've reserved {myReservations.length} outfit{myReservations.length > 1 ? "s" : ""}.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <FilterChip active={activeEvent === "all"} onClick={() => setActiveEvent("all")}>
          All functions
        </FilterChip>
        {(events.data ?? []).map((ev) => (
          <FilterChip
            key={ev.id}
            active={activeEvent === ev.id}
            onClick={() => setActiveEvent(ev.id)}
          >
            {ev.name}
          </FilterChip>
        ))}
      </div>

      {activeEvent !== "all"
        ? (() => {
            const ev = (events.data ?? []).find((e) => e.id === activeEvent);
            if (!ev?.dress_code) return null;
            return (
              <div className="panel mt-6 flex items-start gap-3 p-4">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground">{ev.name} dress code: </span>
                  {ev.dress_code}
                </p>
              </div>
            );
          })()
        : null}

      {outfits.isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading the wardrobe…</p>
      ) : visible.length === 0 ? (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-xl">Nothing here yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Outfits are still being curated for this function. Check back shortly.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((outfit) => {
            const taken = takenBy.get(outfit.id);
            const mine = taken?.guest_id === me.data?.id;
            const eventName = (events.data ?? []).find((e) => e.id === outfit.event_id)?.name;
            return (
              <article key={outfit.id} className="panel flex flex-col overflow-hidden">
                <div className="relative aspect-[3/4] bg-secondary">
                  {outfit.image_url ? (
                    <img
                      src={outfit.image_url}
                      alt={outfit.title}
                      loading="lazy"
                      className={`h-full w-full object-cover ${taken && !mine ? "opacity-35 grayscale" : ""}`}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center font-display text-sm text-muted-foreground">
                      {outfit.title}
                    </div>
                  )}
                  {taken ? (
                    <Badge
                      variant={mine ? "default" : "secondary"}
                      className="absolute top-3 left-3"
                    >
                      {mine ? "Yours" : "Reserved"}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  {eventName ? <p className="text-eyebrow">{eventName}</p> : null}
                  <h2 className="mt-2 text-xl leading-snug">{outfit.title}</h2>
                  {outfit.designer ? (
                    <p className="mt-1 text-sm text-muted-foreground">{outfit.designer}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {outfit.color_family ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {outfit.color_family}
                      </span>
                    ) : null}
                    {outfit.garment_type ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {outfit.garment_type}
                      </span>
                    ) : null}
                    {outfit.size_note ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {outfit.size_note}
                      </span>
                    ) : null}
                  </div>
                  {outfit.notes ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {outfit.notes}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center gap-2 pt-1">
                    {mine ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === outfit.id}
                        onClick={() => release(outfit)}
                      >
                        <Check className="size-4" /> Release
                      </Button>
                    ) : taken ? (
                      <Button variant="secondary" size="sm" disabled>
                        Already claimed
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busyId === outfit.id}
                        onClick={() => reserve(outfit)}
                      >
                        Reserve this look
                      </Button>
                    )}
                    {outfit.boutique_url ? (
                      <a
                        href={outfit.boutique_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        View details <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
