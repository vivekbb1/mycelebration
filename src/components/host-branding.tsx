import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BODY_FONTS,
  BRANDING_DEFAULTS,
  HEADING_FONTS,
  applyBranding,
  fontStack,
  useBranding,
  type Branding,
} from "@/lib/branding";

type Draft = Omit<Branding, "id">;

const COLOURS: { key: keyof Draft; label: string; hint: string }[] = [
  { key: "color_background", label: "Page background", hint: "The paper behind everything" },
  { key: "color_surface", label: "Cards", hint: "Invitation cards and panels" },
  { key: "color_foreground", label: "Text", hint: "Headings and paragraphs" },
  { key: "color_primary", label: "Accent", hint: "Buttons, rules and highlights" },
  { key: "color_primary_foreground", label: "Text on accent", hint: "Words inside buttons" },
  { key: "color_accent", label: "Second accent", hint: "Ticks and confirmations" },
  { key: "color_border", label: "Lines", hint: "Card edges and dividers" },
];

/** Fonts, colours, text size and logo for the whole site. */
export function HostBranding() {
  const qc = useQueryClient();
  const { branding, query } = useBranding();
  const [draft, setDraft] = useState<Draft>({ ...BRANDING_DEFAULTS });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded && query.data) {
      const { id: _id, ...rest } = query.data;
      setDraft(rest);
      setLoaded(true);
    }
  }, [loaded, query.data]);

  // Live preview: the page wears the draft while you fiddle with it.
  useEffect(() => {
    if (loaded) applyBranding({ id: "default", ...draft });
  }, [draft, loaded]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("branding")
        .upsert({ id: "default", ...draft, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] });
      toast.success("Branding saved — guests see it straight away.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = () => {
    setDraft({ ...BRANDING_DEFAULTS });
    toast.message("Original look restored — save to keep it.");
  };

  const discard = () => {
    const { id: _id, ...rest } = branding;
    setDraft(rest);
    applyBranding(branding);
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Palette className="size-4 text-primary" /> Branding
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the lettering, colours, text size and logo for every page. Changes show here as you
          pick them; save when you're happy and guests see the same.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            Save branding
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={discard}>
            Discard changes
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={restore}>
            <RotateCcw className="mr-2 size-4" /> Original look
          </Button>
        </div>
      </section>

      <section className="panel p-6">
        <h3 className="text-lg">Lettering</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-sm">Headings</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {HEADING_FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set("heading_font", f)}
                  style={{ fontFamily: fontStack(f, true) }}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    draft.heading_font === f
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm">Body text</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BODY_FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set("body_font", f)}
                  style={{ fontFamily: fontStack(f, false) }}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    draft.body_font === f
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <label className="text-sm">
            Text size
            <span className="ml-2 text-xs text-muted-foreground">{draft.base_font_size}px</span>
            <input
              type="range"
              min={14}
              max={20}
              step={1}
              value={draft.base_font_size}
              onChange={(e) => set("base_font_size", Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
          </label>
          <label className="text-sm">
            Heading size
            <span className="ml-2 text-xs text-muted-foreground">
              {Math.round(draft.heading_scale * 100)}%
            </span>
            <input
              type="range"
              min={0.85}
              max={1.3}
              step={0.05}
              value={draft.heading_scale}
              onChange={(e) => set("heading_scale", Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
          </label>
          <label className="text-sm">
            Corner rounding
            <span className="ml-2 text-xs text-muted-foreground">{draft.radius}rem</span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={draft.radius}
              onChange={(e) => set("radius", Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
          </label>
        </div>
      </section>

      <section className="panel p-6">
        <h3 className="text-lg">Colours</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLOURS.map((c) => {
            const value = String(draft[c.key] ?? "#ffffff");
            return (
              <div key={c.key} className="rounded-xl border border-border/60 p-4">
                <p className="text-sm">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.hint}</p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={c.label}
                    value={value}
                    onChange={(e) => set(c.key, e.target.value as Draft[typeof c.key])}
                    className="size-9 cursor-pointer rounded-md border border-border bg-transparent"
                  />
                  <Input
                    value={value}
                    onChange={(e) => set(c.key, e.target.value as Draft[typeof c.key])}
                    className="h-9"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel p-6">
        <h3 className="text-lg">Logo</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a link to your logo (PNG or SVG with a see-through background works best). Best size
          around 400 × 120 px, under 200 KB. Leave it empty to show your wedding name instead.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Logo link
            <Input
              value={draft.logo_url ?? ""}
              onChange={(e) => set("logo_url", e.target.value.trim() || null)}
              placeholder="https://…/logo.png"
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Logo height
            <span className="ml-2 text-xs text-muted-foreground">{draft.logo_height}px</span>
            <input
              type="range"
              min={24}
              max={80}
              step={2}
              value={draft.logo_height}
              onChange={(e) => set("logo_height", Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Browser tab icon (32 × 32 px)
            <Input
              value={draft.favicon_url ?? ""}
              onChange={(e) => set("favicon_url", e.target.value.trim() || null)}
              placeholder="https://…/icon.png"
              className="mt-1"
            />
          </label>
        </div>
        {draft.logo_url ? (
          <div className="mt-4 rounded-xl border border-border/60 bg-surface p-4">
            <img
              src={draft.logo_url}
              alt="Your logo"
              style={{ height: draft.logo_height }}
              className="w-auto"
            />
          </div>
        ) : null}
      </section>

      <section className="invite-card p-6 sm:p-9">
        <p className="text-eyebrow text-center">How it looks</p>
        <h3 className="mt-3 text-center text-3xl">Your Wedding</h3>
        <div className="gold-rule mx-auto mt-4 w-40" />
        <p className="mx-auto mt-4 max-w-md text-center text-sm text-muted-foreground">
          A sample card in your chosen lettering and colours — this is roughly what your guests see
          on their invitation.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button type="button" size="sm">
            Choose your look
          </Button>
          <Button type="button" size="sm" variant="outline">
            Reply
          </Button>
        </div>
      </section>
    </div>
  );
}
