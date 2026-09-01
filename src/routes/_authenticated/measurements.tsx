import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

  const existing = useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("measurements")
        .select("*")
        .eq("guest_id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const row = existing.data;
    if (!row) return;
    setForm({
      unit: (row.unit as "cm" | "in") ?? "cm",
      height: row.height?.toString() ?? "",
      bust: row.bust?.toString() ?? "",
      waist: row.waist?.toString() ?? "",
      hip: row.hip?.toString() ?? "",
      shoulder: row.shoulder?.toString() ?? "",
      sleeve_length: row.sleeve_length?.toString() ?? "",
      top_length: row.top_length?.toString() ?? "",
      bottom_length: row.bottom_length?.toString() ?? "",
      inseam: row.inseam?.toString() ?? "",
      notes: row.notes ?? "",
    });
  }, [existing.data]);

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
    const payload: Record<string, unknown> = {
      guest_id: userData.user.id,
      unit: form.unit,
      notes: form.notes.trim() || null,
    };
    for (const field of FIELDS) {
      const raw = form[field.key].trim();
      payload[field.key] = raw === "" ? null : Number(raw);
    }
    const { error } = await supabase
      .from("measurements")
      .upsert(payload, { onConflict: "guest_id" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Measurements saved — thank you!");
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-eyebrow">For the tailor</p>
      <h1 className="mt-3 text-4xl">Your measurements</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Have someone help you and measure over light clothing. Leave anything blank if you're not
        sure — we'll follow up. Only you and the hosts can see these.
      </p>

      <div className="panel mt-8 p-6">
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
          {busy ? "Saving…" : existing.data ? "Update measurements" : "Save measurements"}
        </Button>
      </div>
    </main>
  );
}
