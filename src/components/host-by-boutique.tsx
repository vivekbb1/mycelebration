import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Eye, Store } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUSES, orderStatusLabel, orderStatusVariant } from "@/lib/order-status";
import { useSelectedEvent } from "@/lib/selected-event";


/**
 * Host view of every look grouped by the boutique / tailor supplying it, with the
 * guest who reserved it and whether their measurements are in.
 */
export function HostByBoutique() {
  const queryClient = useQueryClient();

  const { inviteId } = useSelectedEvent();
  const scope = inviteId ? { invite_id: inviteId } : {};
  const boutiques = useQuery({
    queryKey: ["boutiques", inviteId],
    queryFn: async () => {
      let q = supabase.from("boutiques").select("*").order("name");
      if (inviteId) {
        const links = await supabase.from("boutique_celebrations").select("boutique_id").eq("invite_id", inviteId);
        if (links.error) throw links.error;
        q = q.in("id", (links.data ?? []).map((l) => l.boutique_id));
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["outfits", "by-boutique", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("*")
        .match(scope)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events", "by-boutique", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name")
        .match(scope)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const reservations = useQuery({
    queryKey: ["reservations", "by-boutique", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, outfit_id, guest_id, guest_name, created_at, order_status")
        .match(scope);
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ order_status: status, order_status_updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      toast.success(`Order marked ${orderStatusLabel(vars.status).toLowerCase()}.`);
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: () => toast.error("That status couldn't be saved. Please try again."),
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
              guest:
                res?.guest_name && profile?.full_name && res.guest_name.trim().toLowerCase() !== profile.full_name.trim().toLowerCase()
                  ? `${res.guest_name} (by ${profile.full_name})`
                  : res?.guest_name || profile?.full_name || null,
              reservationId: res?.id ?? null,
              orderStatus: (res?.order_status as string | null) ?? "pending",
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
      <p className="panel p-4 sm:p-6 text-sm text-muted-foreground">
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
        const orders = g.looks.filter((l) => l.reservationId);
        return (
          <section key={g.id ?? "unassigned"} className="panel p-4 sm:p-6">
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

            {orders.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {ORDER_STATUSES.map((s) => {
                  const count = orders.filter((l) => l.orderStatus === s.value).length;
                  return count > 0 ? (
                    <Badge key={s.value} variant={orderStatusVariant(s.value)}>
                      {count} {s.label.toLowerCase()}
                    </Badge>
                  ) : null;
                })}
              </div>
            ) : null}


            <ul className="mt-5 divide-y divide-border/70">
              {g.looks.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-4 py-3">
                  {l.image ? (
                    <img
                      src={l.image}
                      referrerPolicy="no-referrer"
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
                        {l.reservationId ? (
                          <Select
                            value={l.orderStatus}
                            onValueChange={(value) =>
                              setStatus.mutate({ id: l.reservationId as string, status: value })
                            }
                          >
                            <SelectTrigger
                              className="h-11 w-full sm:h-9 sm:w-40"
                              aria-label={`Order status for ${l.title}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
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
