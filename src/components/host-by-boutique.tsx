import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Eye, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Host view of every look grouped by the boutique / tailor supplying it, with the
 * guest who reserved it and whether their measurements are in.
 */
export function HostByBoutique() {
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
      const { data, error } = await supabase
        .from("outfits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name")
        .order("sort_order");
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

  const profiles = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, rsvp_status");
      if (error) throw error;
      return data;
    },
  });

  const measurements = useQuery({
    queryKey: ["all-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("measurements").select("guest_id, unit");
      if (error) throw error;
      return data;
    },
  });

  const groups = useMemo(() => {
    const list = (boutiques.data ?? []).map((b) => ({
      id: b.id as string | null,
      name: b.name as string,
      contact: [b.contact_name, b.contact_email, b.contact_phone, b.city]
        .filter(Boolean)
        .join(" · "),
      code: b.access_code as string,
    }));
    list.push({ id: null, name: "Not assigned to a boutique yet", contact: "", code: "" });

    return list
      .map((b) => {
        const looks = (outfits.data ?? [])
          .filter((o) => (o.boutique_id ?? null) === b.id)
          .map((o) => {
            const res = (reservations.data ?? []).find((r) => r.outfit_id === o.id);
            const profile = res
              ? (profiles.data ?? []).find((p) => p.id === res.guest_id)
              : undefined;
            const measured = res
              ? Boolean((measurements.data ?? []).some((m) => m.guest_id === res.guest_id))
              : false;
            return {
              id: o.id as string,
              title: o.title as string,
              designer: (o.designer as string | null) ?? null,
              image: (o.image_url as string | null) ?? null,
              functionName:
                (events.data ?? []).find((e) => e.id === o.event_id)?.name ?? null,
              guestId: res?.guest_id ?? null,
              guest: profile?.full_name || res?.guest_name || null,
              measured,
            };
          });
        return { ...b, looks };
      })
      .filter((g) => g.looks.length > 0);
  }, [
    boutiques.data,
    outfits.data,
    events.data,
    reservations.data,
    profiles.data,
    measurements.data,
  ]);

  if (groups.length === 0) {
    return (
      <p className="panel p-6 text-sm text-muted-foreground">
        Add looks in the Outfits tab and assign each one to a boutique — they'll appear here grouped
        by atelier, with the guest who reserved them.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const reserved = g.looks.filter((l) => l.guest).length;
        const measured = g.looks.filter((l) => l.measured).length;
        return (
          <section key={g.id ?? "unassigned"} className="panel p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary">
                  <Store className="mr-1 inline size-3" /> Atelier
                </p>
                <h3 className="mt-1 text-2xl">{g.name}</h3>
                {g.contact ? (
                  <p className="text-sm text-muted-foreground">{g.contact}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{g.looks.length} looks</Badge>
                <Badge variant="secondary">{reserved} reserved</Badge>
                <Badge variant={measured === reserved && reserved > 0 ? "default" : "secondary"}>
                  {measured} measured
                </Badge>
                {g.code ? <Badge variant="outline">Code {g.code}</Badge> : null}
              </div>
            </div>

            <ul className="mt-5 divide-y divide-border/70">
              {g.looks.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-4 py-3">
                  {l.image ? (
                    <img
                      src={l.image}
                      alt={l.title}
                      loading="lazy"
                      className="size-14 rounded-md object-cover"
                    />
                  ) : (
                    <div className="size-14 rounded-md bg-muted" />
                  )}
                  <div className="min-w-40 flex-1">
                    <p className="text-base">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[l.designer, l.functionName].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {l.guest ? (
                      <>
                        <Badge variant="default">{l.guest}</Badge>
                        <Badge variant={l.measured ? "outline" : "secondary"}>
                          {l.measured ? "Measurements in" : "Awaiting measurements"}
                        </Badge>
                        {l.guestId ? (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            aria-label={`View ${l.guest}'s portal`}
                          >
                            <Link to="/guest/$guestId" params={{ guestId: l.guestId }}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <Badge variant="secondary">Still available</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
