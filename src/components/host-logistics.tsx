import { useSelectedEvent } from "@/lib/selected-event";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { guardedUpdate } from "@/lib/save-guard";
import { parseTimeline, type TimelineStep } from "@/lib/logistics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Fields = {
  intro: string;
  hotel_name: string;
  hotel_address: string;
  checkin_note: string;
  measurements_deadline: string;
  team_name: string;
  team_whatsapp: string;
  team_email: string;
};

const emptyFields: Fields = {
  intro: "",
  hotel_name: "",
  hotel_address: "",
  checkin_note: "",
  measurements_deadline: "",
  team_name: "",
  team_whatsapp: "",
  team_email: "",
};

export function HostLogistics() {
  const { inviteId } = useSelectedEvent();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<Fields>({ ...emptyFields });
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const plan = useQuery({
    queryKey: ["logistics", inviteId],
    enabled: Boolean(inviteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics")
        .select("*")
        .eq("invite_id", inviteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const row = plan.data;
    if (!row) {
      setFields({ ...emptyFields });
      setEnabled(true);
      setTimeline([]);
      return;
    }
    setFields({
      intro: row.intro ?? "",
      hotel_name: row.hotel_name ?? "",
      hotel_address: row.hotel_address ?? "",
      checkin_note: row.checkin_note ?? "",
      measurements_deadline: row.measurements_deadline ?? "",
      team_name: row.team_name ?? "",
      team_whatsapp: row.team_whatsapp ?? "",
      team_email: row.team_email ?? "",
    });
    setEnabled(row.enabled ?? true);
    setTimeline(parseTimeline(row.timeline));
  }, [plan.data]);

  const set = (key: keyof Fields) => (value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (enabled && fields.intro.trim().length < 10) {
      toast.error("Write a short intro so guests know what to expect.");
      return;
    }
    setBusy(true);
    const payload = {
      enabled,
      intro: fields.intro.trim(),
      hotel_name: fields.hotel_name.trim() || null,
      hotel_address: fields.hotel_address.trim() || null,
      checkin_note: fields.checkin_note.trim() || null,
      measurements_deadline: fields.measurements_deadline.trim() || null,
      team_name: fields.team_name.trim() || null,
      team_whatsapp: fields.team_whatsapp.trim() || null,
      team_email: fields.team_email.trim() || null,
      timeline: timeline
        .map((s) => ({ date: s.date.trim(), title: s.title.trim(), body: s.body.trim() }))
        .filter((s) => s.title || s.date || s.body),
    };
    const existing = plan.data?.id;
    try {
      if (existing) {
        await guardedUpdate({
          table: "logistics",
          idColumn: "id",
          id: existing,
          expectedUpdatedAt: plan.data?.updated_at,
          patch: payload,
          label: "the delivery plan",
        });
      } else {
        const { error } = await supabase
          .from("logistics")
          .insert({ ...payload, singleton: true, invite_id: inviteId });
        if (error) throw error;
      }
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not save.");
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
      return;
    }
    setBusy(false);
    toast.success(
      enabled
        ? "Delivery plan updated — guests see it right away."
        : "Delivery plan switched off — guests no longer see it.",
    );
    await queryClient.invalidateQueries({ queryKey: ["logistics"] });
    await queryClient.invalidateQueries({ queryKey: ["logistics-enabled"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="panel h-fit p-4 sm:p-6">
        <h2 className="text-xl">Delivery &amp; arrival</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This is exactly what guests read on their delivery plan page.
        </p>
        <div className="mt-4 flex items-start justify-between gap-4 rounded-md border border-border bg-surface p-3">
          <div>
            <Label htmlFor="l-enabled">Show the delivery plan to guests</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {enabled
                ? "Guests can open it from their invitation and their outfit page."
                : "Switched off — the links are hidden and the page tells guests you'll be in touch."}
            </p>
          </div>
          <Switch id="l-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
        {!enabled ? null : (
        <div className="mt-5 space-y-4">
          <Field
            id="l-intro"
            label="Intro for guests"
            textarea
            rows={3}
            max={600}
            value={fields.intro}
            onChange={set("intro")}
            placeholder="Reserve a look, send your measurements once, and your outfit will be waiting in your room."
          />
          <Field
            id="l-hotel"
            label="Hotel"
            max={160}
            value={fields.hotel_name}
            onChange={set("hotel_name")}
            placeholder="Devi Ratn, Jaipur"
          />
          <Field
            id="l-hotel-address"
            label="Hotel address"
            textarea
            rows={2}
            max={300}
            value={fields.hotel_address}
            onChange={set("hotel_address")}
            placeholder="Jaipur–Kukas Road, Jaipur, Rajasthan"
          />
          <Field
            id="l-checkin"
            label="What happens at check-in"
            textarea
            rows={3}
            max={600}
            value={fields.checkin_note}
            onChange={set("checkin_note")}
            placeholder="Your outfits are pressed, labelled and placed in your room before you arrive."
          />
          <Field
            id="l-deadline"
            label="Measurements deadline note"
            max={200}
            value={fields.measurements_deadline}
            onChange={set("measurements_deadline")}
            placeholder="Please send measurements by 20 December."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="l-team"
              label="Events team"
              max={120}
              value={fields.team_name}
              onChange={set("team_name")}
              placeholder="Saffron Events — Priya"
            />
            <Field
              id="l-whatsapp"
              label="WhatsApp"
              max={40}
              value={fields.team_whatsapp}
              onChange={set("team_whatsapp")}
              placeholder="+91 98290 11223"
            />
          </div>
          <Field
            id="l-email"
            label="Team email"
            max={160}
            value={fields.team_email}
            onChange={set("team_email")}
            placeholder="wardrobe@saffronevents.com"
          />
          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? "Saving…" : "Save delivery plan"}
          </Button>
        </div>
        )}
      </div>

      {!enabled ? null : (
      <div className="panel h-fit p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl">Timeline steps</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTimeline((t) => [...t, { date: "", title: "", body: "" }])}
          >
            <Plus className="size-4" /> Add step
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Milestones guests see in order — measurements due, orders placed, tailoring, room delivery.
        </p>
        <div className="mt-5 space-y-4">
          {timeline.map((step, i) => (
            <div key={i} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-eyebrow">Step {i + 1}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove step ${i + 1}`}
                  onClick={() => setTimeline((t) => t.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                <Input
                  maxLength={80}
                  value={step.date}
                  placeholder="20 December 2026"
                  aria-label={`Step ${i + 1} date`}
                  onChange={(e) =>
                    setTimeline((t) =>
                      t.map((s, idx) => (idx === i ? { ...s, date: e.target.value } : s)),
                    )
                  }
                />
                <Input
                  maxLength={120}
                  value={step.title}
                  placeholder="Measurements due"
                  aria-label={`Step ${i + 1} title`}
                  onChange={(e) =>
                    setTimeline((t) =>
                      t.map((s, idx) => (idx === i ? { ...s, title: e.target.value } : s)),
                    )
                  }
                />
                <Textarea
                  rows={2}
                  maxLength={500}
                  value={step.body}
                  placeholder="Submit your measurements in the portal — that's all we need from you."
                  aria-label={`Step ${i + 1} description`}
                  onChange={(e) =>
                    setTimeline((t) =>
                      t.map((s, idx) => (idx === i ? { ...s, body: e.target.value } : s)),
                    )
                  }
                />
              </div>
            </div>
          ))}
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No steps yet. Add a few so guests know when to send measurements and when outfits
              arrive.
            </p>
          ) : null}
          {timeline.length ? (
            <Button onClick={save} disabled={busy} variant="outline" className="w-full">
              {busy ? "Saving…" : "Save timeline"}
            </Button>
          ) : null}
        </div>
      </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  max,
  textarea,
  rows,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  max: number;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {textarea ? (
        <Textarea
          id={id}
          rows={rows ?? 3}
          maxLength={max}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          maxLength={max}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
