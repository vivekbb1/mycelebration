import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/measurements")({
  component: Measurements,
});

const FIELDS = [
  { key: "height", label: "Height", tip: "Standing straight, without shoes." },
  {
    key: "bust",
    label: "Bust / chest",
    tip: "Around the fullest part, tape level and snug — not tight.",
  },
  { key: "waist", label: "Waist", tip: "Around the narrowest part of the natural waist." },
  { key: "hip", label: "Hip", tip: "Around the fullest part of the hips, about 20cm below waist." },
  { key: "shoulder", label: "Shoulder width", tip: "Straight across the back, shoulder to shoulder." },
  { key: "sleeve_length", label: "Sleeve length", tip: "From shoulder seam to where you want the sleeve to end." },
  {
    key: "top_length",
    label: "Blouse / kurta length",
    tip: "From the shoulder down to the desired hem.",
  },
  {
    key: "bottom_length",
    label: "Skirt / trouser length",
    tip: "From natural waist to the floor (in the heels you'll wear).",
  },
  { key: "inseam", label: "Inseam", tip: "Inner leg, from crotch to ankle. For churidars and trousers." },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type FormState = Record<FieldKey, string> & { unit: "cm" | "in"; notes: string };

const emptyForm: FormState = {
  unit: "cm",
  height: "",
  bust: "",
  waist: "",
  hip: "",
  shoulder: "",
  sleeve_length: "",
  top_length: "",
  bottom_length: "",
  inseam: "",
  notes: "",
};

const numberSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number(v) > 0 && Number(v) < 500), "Enter a realistic measurement");

function Measurements() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [activePerson, setActivePerson] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, household")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  // Everyone invited under this invitation code, by name.
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
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .eq("guest_id", userData.user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useMemo(() => {
    const named = (household.data ?? []).filter((p) => p.name && p.name !== "Guest");
    if (named.length > 0) return named.map((p) => p.name);
    return [(me.data?.full_name ?? "").trim() || "You"];
  }, [household.data, me.data?.full_name]);

  const activeName =
    (activePerson && people.includes(activePerson) ? activePerson : null) ??
    people.find((n) => n === (me.data?.full_name ?? "").trim()) ??
    people[0] ??
    "You";

  // A single guest keeps their existing row (no name against it); families get one per person.
  const storedName = people.length > 1 ? activeName : "";
  const rowFor = (name: string) => {
    const list = rows.data ?? [];
    const key = people.length > 1 ? name : "";
    return (
      list.find((r) => (r.guest_name ?? "") === key) ??
      (people.length <= 1 ? list[0] : undefined)
    );
  };
  const existing = rowFor(activeName);

  useEffect(() => {
    if (!existing) {
      setForm(emptyForm);
      return;
    }
    setForm({
      unit: (existing.unit as "cm" | "in") ?? "cm",
      height: existing.height?.toString() ?? "",
      bust: existing.bust?.toString() ?? "",
      waist: existing.waist?.toString() ?? "",
      hip: existing.hip?.toString() ?? "",
      shoulder: existing.shoulder?.toString() ?? "",
      sleeve_length: existing.sleeve_length?.toString() ?? "",
      top_length: existing.top_length?.toString() ?? "",
      bottom_length: existing.bottom_length?.toString() ?? "",
      inseam: existing.inseam?.toString() ?? "",
      notes: existing.notes ?? "",
    });
    // Switching person loads that person's numbers.
  }, [existing?.id, activeName]);

  const save = async () => {
    for (const field of FIELDS) {
      const parsed = numberSchema.safeParse(form[field.key]);
      if (!parsed.success) {
        toast.error(`${field.label}: ${parsed.error.issues[0]?.message}`);
        return;
      }
    }
    if (form.notes.length > 1000) {
      toast.error("Please keep notes under 1000 characters");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setBusy(true);
    const num = (key: FieldKey) => {
      const raw = form[key].trim();
      return raw === "" ? null : Number(raw);
    };
    const { error } = await supabase.from("measurements").upsert(
      {
        guest_id: userData.user.id,
        guest_name: storedName,
        unit: form.unit,
        notes: form.notes.trim() || null,
        height: num("height"),
        bust: num("bust"),
        waist: num("waist"),
        hip: num("hip"),
        shoulder: num("shoulder"),
        sleeve_length: num("sleeve_length"),
        top_length: num("top_length"),
        bottom_length: num("bottom_length"),
        inseam: num("inseam"),
      },
      { onConflict: "guest_id,guest_name" },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      people.length > 1
        ? `${activeName}'s measurements saved — thank you!`
        : "Measurements saved — thank you!",
    );
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  const filledCount = (name: string) => {
    const row = rowFor(name);
    if (!row) return 0;
    return FIELDS.filter((f) => row[f.key] !== null && row[f.key] !== undefined).length;
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-eyebrow">For the tailor</p>
      <h1 className="mt-3 text-4xl">Measurements</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Have someone help you and measure over light clothing. Leave anything blank if you're not
        sure — we'll follow up. Only you and the hosts can see these.
      </p>

      <section className="panel mt-6 p-4">
        <p className="text-eyebrow">Whose measurements are these?</p>
        {people.length > 1 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {people.map((name) => {
              const active = name === activeName;
              const done = filledCount(name);
              return (
                <li key={name}>
                  <button
                    onClick={() => setActivePerson(name)}
                    aria-pressed={active}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {name}
                    <span className="ml-2 text-xs opacity-80">
                      {done > 0 ? `${done} filled in` : "not yet"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-lg">
            {activeName}
            <span className="ml-2 text-xs text-muted-foreground">
              {filledCount(activeName) > 0 ? `${filledCount(activeName)} filled in` : "not yet"}
            </span>
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {people.length > 1
            ? "Each person is saved separately — fill one in, save, then choose the next name."
            : "Only one name is on your invitation, so these are saved against you."}
        </p>
      </section>

      <div className="panel mt-6 p-6">
        <h2 className="mb-4 text-xl">{activeName}</h2>
        <div className="flex items-center gap-3">
          <Label className="text-sm">Units</Label>
          <div className="flex gap-2">
            {(["cm", "in"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setForm((f) => ({ ...f, unit: u }))}
                className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                  form.unit === u
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-primary"
                }`}
              >
                {u === "cm" ? "Centimetres" : "Inches"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>
                {field.label} <span className="text-muted-foreground">({form.unit})</span>
              </Label>
              <Input
                id={field.key}
                inputMode="decimal"
                value={form[field.key]}
                maxLength={6}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">{field.tip}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <Label htmlFor="notes">Anything else we should tell the tailor?</Label>
          <Textarea
            id="notes"
            rows={4}
            maxLength={1000}
            value={form.notes}
            placeholder="Sleeve preference, blouse neckline, heel height, allergies to certain fabrics…"
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <Button className="mt-6" onClick={save} disabled={busy}>
          {busy
            ? "Saving…"
            : existing
              ? people.length > 1
                ? `Update ${activeName}'s measurements`
                : "Update measurements"
              : people.length > 1
                ? `Save ${activeName}'s measurements`
                : "Save measurements"}
        </Button>
      </div>
    </main>
  );
}
