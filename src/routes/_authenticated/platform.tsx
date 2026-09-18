import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FEATURES, useFeatures } from "@/lib/features";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({
    meta: [
      { title: "Platform admin — Packages & features" },
      {
        name: "description",
        content:
          "Decide which packages exist and which features every host account can use across the platform.",
      },
      { property: "og:title", content: "Platform admin — Packages & features" },
      {
        property: "og:description",
        content: "Set the packages hosts can be on and tick the features each account may use.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformAdmin,
});

type Plan = { id: string; name: string; blurb: string | null; features: string[]; sort_order: number };

function PlatformAdmin() {
  const qc = useQueryClient();
  const { isPlatformAdmin, ready } = useFeatures();
  const [search, setSearch] = useState("");

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, blurb, features, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
      })) as Plan[];
    },
  });

  const hosts = useQuery({
    queryKey: ["platform-hosts"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const roles = await supabase.from("user_roles").select("user_id, role").eq("role", "admin");
      if (roles.error) throw roles.error;
      const ids = (roles.data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const [profiles, subs] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", ids),
        supabase
          .from("host_subscriptions")
          .select("user_id, plan_id, features_extra, status")
          .in("user_id", ids),
      ]);
      if (profiles.error) throw profiles.error;
      if (subs.error) throw subs.error;
      return ids.map((id) => {
        const sub = subs.data?.find((s) => s.user_id === id);
        const profile = profiles.data?.find((p) => p.id === id);
        return {
          id,
          name: profile?.full_name || "Host",
          email: profile?.email ?? "",
          plan_id: sub?.plan_id ?? "free",
          status: sub?.status ?? "active",
          extras: Array.isArray(sub?.features_extra) ? (sub?.features_extra as string[]) : [],
        };
      });
    },
  });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = hosts.data ?? [];
    return q
      ? list.filter((h) => `${h.name} ${h.email}`.toLowerCase().includes(q))
      : list;
  }, [hosts.data, search]);

  const savePlanFeature = async (plan: Plan, key: string) => {
    const next = plan.features.includes(key)
      ? plan.features.filter((f) => f !== key)
      : [...plan.features, key];
    const { error } = await supabase.from("plans").update({ features: next }).eq("id", plan.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["plans"] });
    await qc.invalidateQueries({ queryKey: ["my-features"] });
  };

  const setHostPlan = async (userId: string, planId: string) => {
    const { error } = await supabase
      .from("host_subscriptions")
      .upsert({ user_id: userId, plan_id: planId }, { onConflict: "user_id" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Package changed.");
    await qc.invalidateQueries({ queryKey: ["platform-hosts"] });
    await qc.invalidateQueries({ queryKey: ["my-features"] });
  };

  const toggleExtra = async (userId: string, extras: string[], key: string) => {
    const next = extras.includes(key) ? extras.filter((f) => f !== key) : [...extras, key];
    const { error } = await supabase
      .from("host_subscriptions")
      .upsert({ user_id: userId, features_extra: next }, { onConflict: "user_id" });
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["platform-hosts"] });
    await qc.invalidateQueries({ queryKey: ["my-features"] });
  };

  const setStatus = async (userId: string, status: string) => {
    const { error } = await supabase
      .from("host_subscriptions")
      .upsert({ user_id: userId, status }, { onConflict: "user_id" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "active" ? "Subscription switched on." : "Subscription paused.");
    await qc.invalidateQueries({ queryKey: ["platform-hosts"] });
    await qc.invalidateQueries({ queryKey: ["my-features"] });
  };

  if (ready && !isPlatformAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="panel p-4 sm:p-6">
          <h1 className="text-2xl">This page isn't for you</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only the platform owner can change packages and features.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/host">Back to your event</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-eyebrow">Platform admin</p>
      <h1 className="mt-2 flex items-center gap-2 text-2xl sm:text-4xl">
        <ShieldCheck className="size-6 text-primary" /> Packages &amp; features
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Tick what each package includes, then put every host account on a package. Anything not
        ticked is hidden from them.
      </p>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {(plans.data ?? []).map((plan) => (
          <div key={plan.id} className="panel p-4 sm:p-6">
            <h2 className="text-xl">{plan.name}</h2>
            {plan.blurb ? (
              <p className="mt-1 text-xs text-muted-foreground">{plan.blurb}</p>
            ) : null}
            <ul className="mt-4 space-y-2">
              {FEATURES.map((f) => {
                const on = plan.features.includes(f.key);
                return (
                  <li key={f.key}>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => void savePlanFeature(plan, f.key)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <span>
                        {f.label}
                        <span className="block text-xs text-muted-foreground">{f.blurb}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <section className="panel mt-8 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Host accounts ({shown.length})</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a host…"
            className="w-full sm:w-56"
          />
        </div>

        <ul className="mt-4 divide-y divide-border">
          {shown.map((h) => (
            <li key={h.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{h.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{h.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="field-select w-full text-xs sm:w-44"
                    aria-label={`Package for ${h.name}`}
                    value={h.plan_id}
                    onChange={(e) => void setHostPlan(h.id, e.target.value)}
                  >
                    {(plans.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant={h.status === "active" ? "outline" : "secondary"}
                    onClick={() => void setStatus(h.id, h.status === "active" ? "paused" : "active")}
                  >
                    {h.status === "active" ? "Active" : "Paused"}
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {FEATURES.map((f) => {
                  const fromPlan = (plans.data ?? [])
                    .find((p) => p.id === h.plan_id)
                    ?.features.includes(f.key);
                  const extra = h.extras.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      disabled={fromPlan}
                      onClick={() => void toggleExtra(h.id, h.extras, f.key)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        fromPlan
                          ? "cursor-default border-primary bg-primary/10 text-primary"
                          : extra
                            ? "border-emerald-600 bg-emerald-600/10 text-emerald-700"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {fromPlan || extra ? <Check className="mr-1 inline size-3" /> : null}
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Gold comes with their package; green is an extra you've given them.
              </p>
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">No host accounts yet.</li>
          ) : null}
        </ul>
      </section>

      <div className="mt-6">
        <Badge variant="outline">You see everything as the platform owner</Badge>
      </div>
    </main>
  );
}
