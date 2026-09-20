import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CreditCard, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { featureLabel } from "@/lib/features";
import { formatMoney } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({
    meta: [
      { title: "Your Package — Choose What Your Celebration Includes" },
      {
        name: "description",
        content:
          "Compare packages and add-ons for your celebration, see what you have today and ask for more whenever you need it.",
      },
      { property: "og:title", content: "Your Package — Choose What Your Celebration Includes" },
      {
        property: "og:description",
        content: "Compare packages and add-ons and pick what your celebration needs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UpgradePage,
});

type FeeRow = { label: string; currency: string; base_amount: number; per_guest_amount: number };

function UpgradePage() {
  const qc = useQueryClient();
  const [chosenPlan, setChosenPlan] = useState<string | null>(null);
  const [chosenAddons, setChosenAddons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const me = useQuery({
    queryKey: ["upgrade-me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      return auth.user?.id ?? null;
    },
  });

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, blurb, features, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
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
      return data ?? [];
    },
  });

  const mine = useQuery({
    queryKey: ["upgrade-mine", me.data],
    enabled: !!me.data,
    queryFn: async () => {
      const [sub, own, request] = await Promise.all([
        supabase
          .from("host_subscriptions")
          .select("plan_id, status")
          .eq("user_id", me.data as string)
          .maybeSingle(),
        supabase.from("host_addons").select("addon_id").eq("user_id", me.data as string),
        supabase
          .from("plan_requests")
          .select("id, plan_id, addon_ids, status, note, created_at")
          .eq("user_id", me.data as string)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return {
        planId: sub.data?.plan_id ?? null,
        status: sub.data?.status ?? null,
        addons: (own.data ?? []).map((a) => a.addon_id),
        requests: request.data ?? [],
      };
    },
  });

  // What the platform charges a host for running an celebration, so the price is visible here too.
  const hostFees = useQuery({
    queryKey: ["upgrade-host-fees"],
    queryFn: async (): Promise<FeeRow[]> => {
      const { data } = await supabase
        .from("event_fees")
        .select("label, currency, base_amount, per_guest_amount")
        .eq("audience", "host")
        .eq("active", true);
      return (data ?? []).map((r) => ({
        label: r.label,
        currency: r.currency,
        base_amount: Number(r.base_amount ?? 0),
        per_guest_amount: Number(r.per_guest_amount ?? 0),
      }));
    },
  });

  const pending = useMemo(
    () => (mine.data?.requests ?? []).find((r) => r.status === "pending") ?? null,
    [mine.data],
  );

  const planName = (id: string | null) =>
    plans.data?.find((p) => p.id === id)?.name ?? (id ? id : "No package yet");

  const toggleAddon = (id: string) =>
    setChosenAddons((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const sendRequest = async () => {
    if (!me.data) return;
    if (!chosenPlan && chosenAddons.length === 0) {
      toast.error("Pick a package or an add-on first.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("plan_requests").insert({
      user_id: me.data,
      plan_id: chosenPlan,
      addon_ids: chosenAddons,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("plan_requests_one_open_per_host")
          ? "You already have a request waiting — we'll come back to you on that one."
          : error.message,
      );
      return;
    }
    setNote("");
    setChosenPlan(null);
    setChosenAddons([]);
    await qc.invalidateQueries({ queryKey: ["upgrade-mine"] });
    toast.success("Sent — we'll switch it on for you shortly.");
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs tracking-[0.2em] text-primary uppercase">Your package</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Choose what your celebration includes</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Every package below lists exactly what it opens up. Pick one, add anything extra, and tell
        us anything we should know — we'll switch it on for your account.
      </p>

      <section className="panel mt-8 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl">You're on {planName(mine.data?.planId ?? null)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mine.data?.status === "paused"
                ? "Paused at the moment — ask us to start it again."
                : "Active."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(mine.data?.addons ?? []).map((id) => (
              <Badge key={id} variant="secondary">
                {addons.data?.find((a) => a.id === id)?.name ?? id}
              </Badge>
            ))}
          </div>
        </div>
        {pending ? (
          <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
            Waiting on us: you asked for{" "}
            <strong>{planName(pending.plan_id)}</strong>
            {Array.isArray(pending.addon_ids) && pending.addon_ids.length > 0
              ? ` plus ${(pending.addon_ids as string[])
                  .map((id) => addons.data?.find((a) => a.id === id)?.name ?? id)
                  .join(", ")}`
              : ""}
            .
          </p>
        ) : null}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {(plans.data ?? []).map((plan) => {
          const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
          const current = mine.data?.planId === plan.id;
          const picked = chosenPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`panel flex flex-col p-4 sm:p-6 ${picked ? "ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl">{plan.name}</h3>
                {current ? <Badge>Yours</Badge> : null}
              </div>
              {plan.blurb ? (
                <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
              ) : null}
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{featureLabel(f)}</span>
                  </li>
                ))}
                {features.length === 0 ? (
                  <li className="text-muted-foreground">Nothing switched on yet.</li>
                ) : null}
              </ul>
              <Button
                className="mt-5"
                variant={picked ? "default" : "outline"}
                disabled={current}
                onClick={() => setChosenPlan(picked ? null : plan.id)}
              >
                {current ? "Already yours" : picked ? "Chosen" : "Choose this package"}
              </Button>
            </div>
          );
        })}
      </section>

      {(addons.data ?? []).length > 0 ? (
        <section className="panel mt-8 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl">
            <Sparkles className="size-5 text-primary" /> Add anything extra
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(addons.data ?? []).map((addon) => {
              const owned = (mine.data?.addons ?? []).includes(addon.id);
              const picked = chosenAddons.includes(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  disabled={owned}
                  onClick={() => toggleAddon(addon.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    owned
                      ? "border-border bg-muted/40 opacity-70"
                      : picked
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/60"
                  }`}
                >
                  <p className="flex items-center gap-2">
                    {addon.name}
                    {owned ? <Badge variant="secondary">Yours</Badge> : null}
                  </p>
                  {addon.blurb ? (
                    <p className="mt-1 text-xs text-muted-foreground">{addon.blurb}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {(Array.isArray(addon.features) ? (addon.features as string[]) : [])
                      .map(featureLabel)
                      .join(" · ")}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {(hostFees.data ?? []).length > 0 ? (
        <section className="panel mt-8 p-4 sm:p-6">
          <h2 className="text-xl">Celebration charges</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(hostFees.data ?? []).map((f, i) => (
              <li key={`${f.label}-${i}`} className="flex flex-wrap justify-between gap-2">
                <span>{f.label}</span>
                <span>
                  {f.base_amount > 0 ? formatMoney(f.base_amount, f.currency) : ""}
                  {f.base_amount > 0 && f.per_guest_amount > 0 ? " + " : ""}
                  {f.per_guest_amount > 0
                    ? `${formatMoney(f.per_guest_amount, f.currency)} per guest`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel mt-8 p-4 sm:p-6">
        <h2 className="text-xl">Send it to us</h2>
        <div className="mt-4 grid gap-2">
          <Label htmlFor="upgrade-note">Anything we should know (optional)</Label>
          <Textarea
            id="upgrade-note"
            rows={3}
            maxLength={600}
            placeholder="How many guests you're expecting, when the wedding is, anything special…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={busy || !me.data} onClick={sendRequest}>
            {busy ? "Sending…" : "Ask for this"}
          </Button>
          <Button variant="outline" disabled>
            <CreditCard className="size-4" /> Pay by card
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Card payment is coming — for now we set your package up by hand as soon as your request
          reaches us, and invoice you separately.
        </p>
      </section>

      {(mine.data?.requests ?? []).length > 0 ? (
        <section className="panel mt-8 p-4 sm:p-6">
          <h2 className="text-xl">What you've asked for</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {(mine.data?.requests ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  {planName(r.plan_id)}
                  {r.note ? (
                    <span className="ml-2 text-xs text-muted-foreground">{r.note}</span>
                  ) : null}
                </span>
                <Badge
                  variant={
                    r.status === "approved"
                      ? "default"
                      : r.status === "declined"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {r.status === "approved"
                    ? "Switched on"
                    : r.status === "declined"
                      ? "Not this time"
                      : "Waiting on us"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
