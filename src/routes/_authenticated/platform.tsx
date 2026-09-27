import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FEATURES, useFeatures } from "@/lib/features";
import { HostContent } from "@/components/host-content";
import { HostBranding } from "@/components/host-branding";
import { HostFees } from "@/components/host-fees";
import { PlanRequests } from "@/components/plan-requests";
import { SITE_CONTENT_KEY, useSiteContent } from "@/lib/site-content";
import { guardedUpdate } from "@/lib/save-guard";

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

type Plan = {
  id: string;
  name: string;
  blurb: string | null;
  features: string[];
  sort_order: number;
  price_amount: number | null;
  price_currency: string;
  price_period: string;
};

type Addon = {
  id: string;
  name: string;
  blurb: string | null;
  features: string[];
  sort_order: number;
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

function PlatformAdmin() {
  const qc = useQueryClient();
  const { isPlatformAdmin, ready } = useFeatures();
  const [search, setSearch] = useState("");
  const [newPlan, setNewPlan] = useState({ name: "", blurb: "" });
  const [newAddon, setNewAddon] = useState({ name: "", blurb: "" });

  const refresh = async (keys: string[]) => {
    await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
  };

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, blurb, features, sort_order, price_amount, price_currency, price_period")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
      })) as Plan[];
    },
  });

  const addons = useQuery({
    queryKey: ["addons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addons")
        .select("id, name, blurb, features, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((a) => ({
        ...a,
        features: Array.isArray(a.features) ? (a.features as string[]) : [],
      })) as Addon[];
    },
  });

  const hosts = useQuery({
    queryKey: ["platform-hosts"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      // One row per celebration: packages belong to a celebration, not a person.
      const celebrations = await supabase.from("invites").select("id, name").order("created_at");
      if (celebrations.error) throw celebrations.error;
      const ids = (celebrations.data ?? []).map((c) => c.id);
      if (ids.length === 0) return [];
      const [owners, subs, hostAddons] = await Promise.all([
        supabase.from("celebration_hosts").select("invite_id, user_id, role").in("invite_id", ids),
        supabase
          .from("celebration_subscriptions")
          .select("invite_id, plan_id, features_extra, status")
          .in("invite_id", ids),
        supabase.from("celebration_addons").select("invite_id, addon_id").in("invite_id", ids),
      ]);
      if (owners.error) throw owners.error;
      if (subs.error) throw subs.error;
      if (hostAddons.error) throw hostAddons.error;
      const ownerIds = [...new Set((owners.data ?? []).filter((o) => o.role === "owner").map((o) => o.user_id))];
      const profiles = ownerIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
        : { data: [] as { id: string; full_name: string; email: string | null }[] };
      return (celebrations.data ?? []).map((c) => {
        const id = c.id;
        const sub = subs.data?.find((s) => s.invite_id === id);
        const ownerEmails = (owners.data ?? [])
          .filter((o) => o.invite_id === id && o.role === "owner")
          .map((o) => profiles.data?.find((p) => p.id === o.user_id))
          .map((p) => p?.email || p?.full_name)
          .filter(Boolean);
        return {
          id,
          name: c.name || "Celebration",
          email: ownerEmails.join(", "),
          plan_id: sub?.plan_id ?? "free",
          status: sub?.status ?? "active",
          extras: Array.isArray(sub?.features_extra) ? (sub?.features_extra as string[]) : [],
          addons: (hostAddons.data ?? []).filter((a) => a.invite_id === id).map((a) => a.addon_id),
        };
      });
    },
  });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = hosts.data ?? [];
    return q ? list.filter((h) => `${h.name} ${h.email}`.toLowerCase().includes(q)) : list;
  }, [hosts.data, search]);

  /** Everything a host gets once their package and their add-ons are put together. */
  const featuresFor = (planId: string, addonIds: string[], extras: string[]) => {
    const fromPlan = plans.data?.find((p) => p.id === planId)?.features ?? [];
    const fromAddons = (addons.data ?? [])
      .filter((a) => addonIds.includes(a.id))
      .flatMap((a) => a.features);
    return { fromPlan, fromAddons, extras };
  };

  const savePlanFeature = async (plan: Plan, key: string) => {
    const next = plan.features.includes(key)
      ? plan.features.filter((f) => f !== key)
      : [...plan.features, key];
    const { error } = await supabase.from("plans").update({ features: next }).eq("id", plan.id);
    if (error) return void toast.error(error.message);
    await refresh(["plans", "my-features"]);
  };

  const patchPlan = async (
    id: string,
    patch: {
      name?: string;
      blurb?: string | null;
      price_amount?: number | null;
      price_currency?: string;
      price_period?: string;
    },
  ) => {
    const { error } = await supabase.from("plans").update(patch).eq("id", id);
    if (error) return void toast.error(error.message);
    await refresh(["plans"]);
  };

  const createPlan = async () => {
    const name = newPlan.name.trim();
    if (!name) return void toast.error("Give the package a name.");
    const id = slug(name);
    if (!id) return void toast.error("Use letters or numbers in the name.");
    const { error } = await supabase.from("plans").insert({
      id,
      name,
      blurb: newPlan.blurb.trim() || null,
      features: [],
      sort_order: (plans.data?.length ?? 0) + 1,
    });
    if (error)
      return void toast.error(
        error.code === "23505" ? "A package with that name already exists." : error.message,
      );
    setNewPlan({ name: "", blurb: "" });
    toast.success("Package added — now tick what it includes.");
    await refresh(["plans"]);
  };

  const removePlan = async (plan: Plan) => {
    if (!window.confirm(`Remove the “${plan.name}” package? Hosts on it drop to the free one.`))
      return;
    const { error } = await supabase.from("plans").delete().eq("id", plan.id);
    if (error) return void toast.error(error.message);
    toast.success("Package removed.");
    await refresh(["plans", "platform-hosts", "my-features"]);
  };

  const saveAddonFeature = async (addon: Addon, key: string) => {
    const next = addon.features.includes(key)
      ? addon.features.filter((f) => f !== key)
      : [...addon.features, key];
    const { error } = await supabase.from("addons").update({ features: next }).eq("id", addon.id);
    if (error) return void toast.error(error.message);
    await refresh(["addons", "my-features"]);
  };

  const patchAddon = async (id: string, patch: { name?: string; blurb?: string | null }) => {
    const { error } = await supabase.from("addons").update(patch).eq("id", id);
    if (error) return void toast.error(error.message);
    await refresh(["addons"]);
  };

  const createAddon = async () => {
    const name = newAddon.name.trim();
    if (!name) return void toast.error("Give the add-on a name.");
    const id = slug(name);
    if (!id) return void toast.error("Use letters or numbers in the name.");
    const { error } = await supabase.from("addons").insert({
      id,
      name,
      blurb: newAddon.blurb.trim() || null,
      features: [],
      sort_order: (addons.data?.length ?? 0) + 1,
    });
    if (error)
      return void toast.error(
        error.code === "23505" ? "An add-on with that name already exists." : error.message,
      );
    setNewAddon({ name: "", blurb: "" });
    toast.success("Add-on created — now tick what it includes.");
    await refresh(["addons"]);
  };

  const removeAddon = async (addon: Addon) => {
    if (!window.confirm(`Remove the “${addon.name}” add-on from every host?`)) return;
    const { error } = await supabase.from("addons").delete().eq("id", addon.id);
    if (error) return void toast.error(error.message);
    toast.success("Add-on removed.");
    await refresh(["addons", "platform-hosts", "my-features"]);
  };

  const toggleHostAddon = async (userId: string, addonId: string, on: boolean) => {
    const { error } = on
      ? await supabase.from("celebration_addons").delete().eq("invite_id", userId).eq("addon_id", addonId)
      : await supabase.from("celebration_addons").insert({ invite_id: userId, addon_id: addonId });
    if (error) return void toast.error(error.message);
    await refresh(["platform-hosts", "my-features"]);
  };

  const setHostPlan = async (userId: string, planId: string) => {
    const { error } = await supabase
      .from("celebration_subscriptions")
      .upsert({ invite_id: userId, plan_id: planId }, { onConflict: "invite_id" });
    if (error) return void toast.error(error.message);
    toast.success("Package changed.");
    await refresh(["platform-hosts", "my-features"]);
  };

  const toggleExtra = async (userId: string, extras: string[], key: string) => {
    const next = extras.includes(key) ? extras.filter((f) => f !== key) : [...extras, key];
    const { error } = await supabase
      .from("celebration_subscriptions")
      .upsert({ invite_id: userId, features_extra: next }, { onConflict: "invite_id" });
    if (error) return void toast.error(error.message);
    await refresh(["platform-hosts", "my-features"]);
  };

  const setStatus = async (userId: string, status: string) => {
    const { error } = await supabase
      .from("celebration_subscriptions")
      .upsert({ invite_id: userId, status }, { onConflict: "invite_id" });
    if (error) return void toast.error(error.message);
    toast.success(status === "active" ? "Subscription switched on." : "Subscription paused.");
    await refresh(["platform-hosts", "my-features"]);
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
            <Link to="/host">Back to your celebration</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <p className="text-eyebrow">Platform admin</p>
      <h1 className="mt-3 flex items-center gap-2 text-3xl sm:text-4xl">
        <ShieldCheck className="size-6 text-primary" /> Packages &amp; add-ons
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Build the packages you sell, keep a few add-ons for the extras, then put every celebration
        on a package and switch on the add-ons they've paid for. Prices below are what hosts see on
        their own package page.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/upgrade">Upgrade to Premium</Link>
        </Button>
      </div>

      <section className="panel mt-8 p-4 sm:p-6">
        <h2 className="text-xl">Add a package</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={newPlan.name}
            onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
            placeholder="Package name, e.g. Signature"
            className="sm:w-56"
          />
          <Input
            value={newPlan.blurb}
            onChange={(e) => setNewPlan({ ...newPlan, blurb: e.target.value })}
            placeholder="One line about it (optional)"
            className="sm:flex-1"
          />
          <Button type="button" onClick={() => void createPlan()}>
            <Plus className="mr-1 size-4" /> Add package
          </Button>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        {(plans.data ?? []).map((plan) => (
          <div key={plan.id} className="panel p-4 sm:p-6">
            <div className="flex items-start gap-2">
              <Input
                defaultValue={plan.name}
                aria-label={`Name of the ${plan.name} package`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== plan.name) void patchPlan(plan.id, { name: v });
                }}
                className="text-base"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove the ${plan.name} package`}
                onClick={() => void removePlan(plan)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Input
              defaultValue={plan.blurb ?? ""}
              aria-label={`One line about the ${plan.name} package`}
              placeholder="One line about it"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (plan.blurb ?? "")) void patchPlan(plan.id, { blurb: v || null });
              }}
              className="mt-2 text-xs"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                defaultValue={plan.price_currency}
                aria-label={`Currency for the ${plan.name} package`}
                onBlur={(e) => {
                  const v = e.target.value.trim().toUpperCase().slice(0, 3);
                  if (v && v !== plan.price_currency)
                    void patchPlan(plan.id, { price_currency: v });
                }}
                className="w-20 text-xs"
              />
              <Input
                type="number"
                min={0}
                step="1"
                defaultValue={plan.price_amount ?? ""}
                aria-label={`Price of the ${plan.name} package`}
                placeholder="Price"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const v = raw === "" ? null : Number(raw);
                  if (v !== plan.price_amount) void patchPlan(plan.id, { price_amount: v });
                }}
                className="w-28 text-xs"
              />
              <select
                defaultValue={plan.price_period}
                aria-label={`How often the ${plan.name} package is charged`}
                onChange={(e) => void patchPlan(plan.id, { price_period: e.target.value })}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="one_off">one-off</option>
                <option value="month">per month</option>
                <option value="year">per year</option>
              </select>
            </div>
            <ul className="mt-4 space-y-2">
              {FEATURES.map((f) => (
                <li key={f.key}>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={plan.features.includes(f.key)}
                      onChange={() => void savePlanFeature(plan, f.key)}
                      className="mt-1 size-4 accent-primary"
                    />
                    <span>
                      {f.label}
                      <span className="block text-xs text-muted-foreground">{f.blurb}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="panel mt-8 p-4 sm:p-6">
        <h2 className="text-xl">Add-ons</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Extras a host can buy on top of any package. Switch them on per host further down.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={newAddon.name}
            onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
            placeholder="Add-on name, e.g. Wardrobe"
            className="sm:w-56"
          />
          <Input
            value={newAddon.blurb}
            onChange={(e) => setNewAddon({ ...newAddon, blurb: e.target.value })}
            placeholder="One line about it (optional)"
            className="sm:flex-1"
          />
          <Button type="button" variant="secondary" onClick={() => void createAddon()}>
            <Plus className="mr-1 size-4" /> Add add-on
          </Button>
        </div>

        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {(addons.data ?? []).map((addon) => (
            <li key={addon.id} className="rounded-lg border border-border p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <Input
                  defaultValue={addon.name}
                  aria-label={`Name of the ${addon.name} add-on`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== addon.name) void patchAddon(addon.id, { name: v });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove the ${addon.name} add-on`}
                  onClick={() => void removeAddon(addon)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Input
                defaultValue={addon.blurb ?? ""}
                aria-label={`One line about the ${addon.name} add-on`}
                placeholder="One line about it"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (addon.blurb ?? "")) void patchAddon(addon.id, { blurb: v || null });
                }}
                className="mt-2 text-xs"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {FEATURES.map((f) => {
                  const on = addon.features.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => void saveAddonFeature(addon, f.key)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {on ? <Check className="mr-1 inline size-3" /> : null}
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
          {(addons.data ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">No add-ons yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="panel mt-8 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Celebrations ({shown.length})</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a host…"
            className="w-full sm:w-56"
          />
        </div>

        <ul className="mt-4 divide-y divide-border">
          {shown.map((h) => {
            const { fromPlan, fromAddons } = featuresFor(h.plan_id, h.addons, h.extras);
            return (
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
                      onClick={() =>
                        void setStatus(h.id, h.status === "active" ? "paused" : "active")
                      }
                    >
                      {h.status === "active" ? "Active" : "Paused"}
                    </Button>
                  </div>
                </div>

                {(addons.data ?? []).length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">Add-ons</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(addons.data ?? []).map((a) => {
                        const on = h.addons.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => void toggleHostAddon(h.id, a.id, on)}
                            className={`rounded-full border px-3 py-1 text-xs ${
                              on
                                ? "border-sky-600 bg-sky-600/10 text-sky-700"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {on ? <Check className="mr-1 inline size-3" /> : null}
                            {a.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )  : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {FEATURES.map((f) => {
                    const inPlan = fromPlan.includes(f.key);
                    const inAddon = !inPlan && fromAddons.includes(f.key);
                    const extra = h.extras.includes(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        disabled={inPlan || inAddon}
                        onClick={() => void toggleExtra(h.id, h.extras, f.key)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          inPlan
                            ? "cursor-default border-primary bg-primary/10 text-primary"
                            : inAddon
                              ? "cursor-default border-sky-600 bg-sky-600/10 text-sky-700"
                              : extra
                                ? "border-emerald-600 bg-emerald-600/10 text-emerald-700"
                                : "border-border text-muted-foreground"
                        }`}
                      >
                        {inPlan || inAddon || extra ? (
                          <Check className="mr-1 inline size-3" />
                        ) : null}
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Gold comes with their package, blue with an add-on, green is an extra you've given
                  them by hand.
                </p>
              </li>
            );
          })}
          {shown.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">No celebrations yet.</li>
          ) : null}
        </ul>
      </section>

      <PlanRequests />

      <h2 className="mt-12 text-2xl">Celebration fees</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        What a host owes you for running a celebration — a flat fee, an amount per guest, or both. Hosts
        set their own guest fees under Setup → Celebration fees.
      </p>
      <div className="mt-6">
        <HostFees audience="host" />
      </div>

      <h2 className="mt-12 text-2xl">The portal itself</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The portal name, the welcome page wording and the look of the whole site. Hosts can't change
        these — they only reword their own celebration pages.
      </p>

      <PortalName />

      <div className="mt-8">
        <HostContent
          only={["Welcome page", "Site-wide"]}
          heading="Welcome page & portal wording"
          intro="Every line on the welcome page and the wording shown across the portal."
        />
      </div>

      <div className="mt-8">
        <HostBranding />
      </div>

      <TenancyCheck />

      <div className="mt-6">
        <Badge variant="outline">You see everything as the platform owner</Badge>
      </div>
    </main>
  );
}

/** One-line rename for the portal, shown on the welcome page and in emails. */
/** Shows, per list, how many saved rows aren't tied to any celebration (those only you can see). */
function TenancyCheck() {
  const report = useQuery({
    queryKey: ["tenancy-report"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenancy_report");
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = report.data ?? [];
  const loose = rows.filter((r) => Number(r.unlinked) > 0);
  return (
    <section className="panel mt-8 p-4 sm:p-6">
      <h2 className="text-xl">Celebration separation check</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every saved item should belong to one celebration so hosts never see each other's guests.
      </p>
      {report.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Checking…</p>
      ) : report.isError ? (
        <p className="mt-4 text-sm text-destructive">Couldn't run the check.</p>
      ) : loose.length === 0 ? (
        <p className="mt-4 text-sm">
          <Check className="mr-1 inline size-4 text-primary" />
          All {rows.length} lists are fully tied to a celebration.
        </p>
      ) : (
        <ul className="mt-4 space-y-1 text-sm">
          {loose.map((r) => (
            <li key={r.table_name} className="flex justify-between gap-4">
              <span>{r.table_name.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">
                {String(r.unlinked)} of {String(r.total)} not linked (hidden from hosts)
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PortalName() {
  const queryClient = useQueryClient();
  const { rows } = useSiteContent();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const keys = ["landing.brand", "landing.body", "nav.brand"];
  const editable = rows.filter((r) => keys.includes(r.key));

  const save = async () => {
    setBusy(true);
    try {
      for (const row of editable) {
        const value = (draft[row.key] ?? row.value).trim();
        if (value === row.value) continue;
        if (!value) {
          toast.error(`“${row.label}” can't be empty.`);
          return;
        }
        await guardedUpdate({
          table: "site_content",
          idColumn: "key",
          id: row.key,
          expectedUpdatedAt: row.updated_at,
          patch: { value },
          label: `“${row.label}”`,
        });
      }
      toast.success("Saved — the new name shows everywhere straight away.");
      await queryClient.invalidateQueries({ queryKey: SITE_CONTENT_KEY });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel mt-6 p-4 sm:p-6">
      <h3 className="text-xl">Rename the portal</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        The name guests see at the top of the welcome page and in the menu.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {editable.map((row) => (
          <div key={row.key} className={row.kind === "multiline" ? "sm:col-span-2" : ""}>
            <Label htmlFor={`portal-${row.key}`}>{row.label}</Label>
            {row.kind === "multiline" ? (
              <Textarea
                id={`portal-${row.key}`}
                rows={3}
                maxLength={1200}
                value={draft[row.key] ?? row.value}
                onChange={(e) => setDraft((p) => ({ ...p, [row.key]: e.target.value }))}
              />
            ) : (
              <Input
                id={`portal-${row.key}`}
                maxLength={200}
                value={draft[row.key] ?? row.value}
                onChange={(e) => setDraft((p) => ({ ...p, [row.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
        {editable.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : null}
      </div>
      <Button className="mt-4" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save the portal name"}
      </Button>
    </section>
  );
}
