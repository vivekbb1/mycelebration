import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, CircleDashed } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MeasureDiagram } from "@/components/measure-diagram";
import { MEASURE_LABEL, SizeGuideDialog } from "@/components/size-guide-dialog";
import { formFor, hasChart, HOW_TO, STANDARD_SIZES, suggestSize, type ChartForm } from "@/lib/size-charts";

export const Route = createFileRoute("/_authenticated/guest/measurements")({
  head: () => ({
    meta: [
      { title: "Your measurements | Wedding wardrobe" },
      { name: "description", content: "Send us your measurements so each outfit is tailored to fit before the celebrations begin." },
      { property: "og:title", content: "Your measurements" },
      { property: "og:description", content: "Share your measurements so your outfit is tailored to fit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Measurements,
});

const KEYS = [
  "height", "bust", "under_bust", "chest", "neck", "waist", "hip", "shoulder",
  "sleeve_length", "armhole", "top_length", "bottom_length", "inseam",
] as const;
type Key = (typeof KEYS)[number];

const FORM_FIELDS: Record<ChartForm, Key[]> = {
  women: ["height", "bust", "under_bust", "waist", "hip", "shoulder", "sleeve_length", "armhole", "top_length", "bottom_length"],
  men: ["height", "chest", "neck", "waist", "hip", "shoulder", "sleeve_length", "top_length", "bottom_length", "inseam"],
};
const LABEL_FOR: Record<ChartForm, Partial<Record<Key, string>>> = {
  women: { top_length: "Blouse length", bottom_length: "Skirt / lehenga length" },
  men: { top_length: "Kurta / sherwani length", bottom_length: "Trouser length" },
};
const CORE: Key[] = ["waist", "hip"];

type Values = Record<Key, string>;
const blank = () => Object.fromEntries(KEYS.map((k) => [k, ""])) as Values;

function Measurements() {
  const queryClient = useQueryClient();
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [unit, setUnit] = useState<"cm" | "in">("in");
  const [values, setValues] = useState<Values>(blank);
  const [usual, setUsual] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [how, setHow] = useState<Key | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("id, full_name, household, gender").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const household = useQuery({
    queryKey: ["household-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("household_members");
      if (error) throw error;
      return (data ?? []) as { name: string; gender: string | null }[];
    },
  });

  const rows = useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase.from("measurements").select("*").eq("guest_id", u.user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useMemo(() => {
    const named = (household.data ?? []).filter((p) => p.name && p.name !== "Guest");
    if (named.length) return named;
    return [{ name: (me.data?.full_name ?? "").trim() || "You", gender: (me.data?.gender as string | null) ?? null }];
  }, [household.data, me.data]);
  const names = people.map((p) => p.name);

  const activeName =
    (activePerson && names.includes(activePerson) ? activePerson : null) ??
    names.find((n) => n === (me.data?.full_name ?? "").trim()) ?? names[0] ?? "You";
  const person = people.find((p) => p.name === activeName);
  const gender = person?.gender ?? null;
  const form = formFor(gender);
  const child = gender === "boy" || gender === "girl";
  const fields = FORM_FIELDS[form];

  const rowFor = (name: string) => {
    const list = rows.data ?? [];
    const key = names.length > 1 ? name : "";
    return list.find((r) => (r.guest_name ?? "") === key) ?? (names.length <= 1 ? list[0] : undefined);
  };
  const existing = rowFor(activeName);

  useEffect(() => {
    const v = blank();
    if (existing) {
      for (const k of KEYS) {
        const raw = (existing as Record<string, unknown>)[k];
        v[k] = raw == null ? "" : String(raw);
      }
      // Older rows only had one "Bust / chest" box.
      if (form === "men" && !v.chest && v.bust) v.chest = v.bust;
    }
    setValues(v);
    setUnit(existing?.unit === "cm" ? "cm" : "in");
    setUsual(existing?.usual_size ?? "");
    setNotes(existing?.notes ?? "");
  }, [existing?.id, activeName, form]);

  const switchUnit = (u: "cm" | "in") => {
    if (u === unit) return;
    const f = u === "cm" ? 2.54 : 1 / 2.54;
    setValues((prev) => {
      const next = { ...prev };
      for (const k of KEYS) {
        const n = Number(prev[k]);
        if (prev[k].trim() && Number.isFinite(n)) next[k] = String(Math.round(n * f * 10) / 10);
      }
      return next;
    });
    setUnit(u);
  };

  const isDone = (name: string) => {
    const r = rowFor(name) as Record<string, unknown> | undefined;
    if (!r) return false;
    return Boolean(r["usual_size"]) || CORE.every((k) => r[k] != null);
  };
  const doneCount = names.filter(isDone).length;

  const num = (k: Key) => {
    const raw = values[k].trim();
    return raw === "" ? null : Number(raw);
  };
  const preview = suggestSize(
    { unit, bust: num("bust"), chest: num("chest"), waist: num("waist"), hip: num("hip"), neck: num("neck") },
    form,
  );

  const save = async () => {
    for (const k of fields) {
      const raw = values[k].trim();
      if (raw === "") continue;
      const n = Number(raw);
      const max = unit === "cm" ? 260 : 100;
      if (!Number.isFinite(n) || n <= 0 || n > max) {
        toast.error(`${LABEL_FOR[form][k] ?? MEASURE_LABEL[k]}: enter a realistic measurement`);
        return;
      }
    }
    if (notes.length > 1000) {
      toast.error("Please keep notes under 1000 characters");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      guest_id: u.user.id,
      guest_name: names.length > 1 ? activeName : "",
      unit,
      form,
      usual_size: usual || null,
      notes: notes.trim() || null,
    };
    // Only send boxes shown on this form, so values saved earlier (e.g. a woman's inseam) are kept.
    for (const k of KEYS) if (fields.includes(k)) payload[k] = num(k);
    // Keep the older single "bust" column filled for men so existing screens still read it.
    if (form === "men") payload["bust"] = num("chest");
    const { error } = await supabase.from("measurements").upsert(payload as never, { onConflict: "guest_id,guest_name" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(names.length > 1 ? `${activeName}'s measurements saved — thank you!` : "Measurements saved — thank you!");
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <p className="text-eyebrow">For the tailor</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">Measurements</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        We ask everyone, even if you pick a ready size — it helps us suggest the best fit. Leave anything blank
        if you're not sure. Only your family and the hosts can see these.
      </p>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-eyebrow">Your family</p>
          <p className="text-sm text-muted-foreground">{doneCount} of {names.length} done</p>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            const active = p.name === activeName;
            const done = isDone(p.name);
            return (
              <li key={p.name}>
                <button
                  onClick={() => setActivePerson(p.name)}
                  aria-pressed={active}
                  className={`panel flex w-full items-center justify-between gap-3 p-3 text-left transition-colors ${active ? "ring-2 ring-primary" : "hover:border-primary"}`}
                >
                  <span>
                    <span className="block font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.gender === "men" ? "Men's form" : p.gender === "boy" ? "Boy · men's form" : p.gender === "girl" ? "Girl · women's form" : "Women's form"}
                    </span>
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${done ? "text-primary" : "text-muted-foreground"}`}>
                    {done ? <Check className="size-4" /> : <CircleDashed className="size-4" />}
                    {done ? "Done" : "Still to fill"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="panel mt-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">{activeName}</h2>
          {hasChart(gender) ? <SizeGuideDialog form={form} suggested={preview?.size ?? usual} /> : null}
        </div>
        {child ? (
          <p className="mt-2 text-sm text-muted-foreground">Please have a parent take these measurements.</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Label className="text-sm">Units</Label>
          {(["in", "cm"] as const).map((u) => (
            <Button key={u} size="sm" variant={unit === u ? "default" : "outline"} onClick={() => switchUnit(u)}>
              {u === "cm" ? "Centimetres" : "Inches"}
            </Button>
          ))}
        </div>

        {hasChart(gender) ? (
          <div className="mt-5 rounded-md bg-secondary p-3">
            <Label htmlFor="usual">I know my usual size</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["", ...STANDARD_SIZES].map((s) => (
                <Button key={s || "none"} size="sm" variant={usual === s ? "default" : "outline"} onClick={() => setUsual(s)}>
                  {s || "Not sure"}
                </Button>
              ))}
            </div>
            {preview ? (
              <p className="mt-2 text-xs text-muted-foreground">
                From the numbers below we'd suggest <span className="font-medium text-foreground">{preview.size}</span>
                {preview.between ? " (between sizes — we picked the larger)" : ""}.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {fields.map((k) => (
            <div key={k} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={k}>
                  {LABEL_FOR[form][k] ?? MEASURE_LABEL[k]} <span className="text-muted-foreground">({unit})</span>
                </Label>
                <button type="button" className="text-xs text-primary underline" onClick={() => setHow(k)}>How?</button>
              </div>
              <Input id={k} inputMode="decimal" maxLength={6} value={values[k]}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <Label htmlFor="notes">Anything else we should tell the tailor?</Label>
          <Textarea id="notes" rows={4} maxLength={1000} value={notes}
            placeholder="Sleeve preference, neckline, heel height, fabric allergies…"
            onChange={(e) => setNotes(e.target.value)} />
        </div>

        <Button className="mt-6 w-full sm:w-auto" onClick={save} disabled={busy}>
          {busy ? "Saving…" : `${existing ? "Update" : "Save"} ${names.length > 1 ? `${activeName}'s ` : ""}measurements`}
        </Button>
      </div>

      <Dialog open={how !== null} onOpenChange={(o) => !o && setHow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>How to measure: {how ? (LABEL_FOR[form][how] ?? MEASURE_LABEL[how]) : ""}</DialogTitle></DialogHeader>
          <MeasureDiagram form={form} highlight={how} />
          <p className="text-sm text-muted-foreground">{how ? HOW_TO[how] : ""}</p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
