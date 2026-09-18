import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  Copy,
  Eye,
  Palette,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { findContrastIssues } from "@/lib/contrast";
import { InviteThemes } from "@/components/host-invites";

type Draft = Omit<Branding, "id">;

type Preset = {
  id: string;
  name: string;
  settings: Draft;
  created_at: string;
};

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
  const [presetName, setPresetName] = useState("");
  const [confirmSave, setConfirmSave] = useState(false);

  const presets = useQuery({
    queryKey: ["branding-presets"],
    queryFn: async (): Promise<Preset[]> => {
      const { data, error } = await supabase
        .from("branding_presets")
        .select("id, name, settings, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        settings: { ...BRANDING_DEFAULTS, ...((row.settings ?? {}) as Partial<Draft>) },
      }));
    },
  });

  useEffect(() => {
    if (!loaded && query.data) {
      const { id: _id, updated_at: _u, ...rest } = query.data;
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
      await guardedUpdate({
        table: "branding",
        idColumn: "id",
        id: "default",
        expectedUpdatedAt: query.data?.updated_at,
        patch: { ...draft },
        label: "the branding",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] });
      toast.success("Branding saved — guests see it straight away.");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePreset = useMutation({
    mutationFn: async (vars: { name: string; settings: Draft }) => {
      const name = vars.name.trim();
      if (!name) throw new Error("Give the theme a name first.");
      const { error } = await supabase.from("branding_presets").insert({
        name,
        settings: JSON.parse(JSON.stringify(vars.settings)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPresetName("");
      qc.invalidateQueries({ queryKey: ["branding-presets"] });
      toast.success("Theme saved — switch to it any time.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePreset = useMutation({
    mutationFn: async (preset: Preset) => {
      const { error } = await supabase
        .from("branding_presets")
        .update({
          settings: JSON.parse(JSON.stringify(draft)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", preset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding-presets"] });
      toast.success("Theme updated with what's on screen.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branding_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding-presets"] });
      toast.success("Theme removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issues = useMemo(() => findContrastIssues(draft), [draft]);

  const fixAll = () => {
    setDraft((d) => {
      let next = { ...d };
      // Re-check as we go: fixing one colour can settle the pair beside it.
      for (let round = 0; round < 3; round += 1) {
        const found = findContrastIssues(next);
        if (found.length === 0) break;
        for (const issue of found) {
          next = { ...next, [issue.key]: issue.suggestion } as Draft;
        }
      }
      return next;
    });
    toast.success("Colours nudged until every pairing reads clearly.");
  };

  const attemptSave = () => {
    if (issues.length > 0 && !confirmSave) {
      setConfirmSave(true);
      toast.warning(
        `${issues.length} colour pairing${issues.length === 1 ? "" : "s"} will be hard to read. Fix them, or press Save again to keep them anyway.`,
      );
      return;
    }
    setConfirmSave(false);
    save.mutate();
  };

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
          <Button type="button" size="sm" disabled={save.isPending} onClick={attemptSave}>
            {confirmSave && issues.length > 0 ? "Save anyway" : "Save branding"}
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
        <h3 className="flex items-center gap-2 text-lg">
          <AlertTriangle className="size-4 text-primary" /> Easy to read
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We check every pairing of your colours the way guests' eyes see them — pale gold on cream
          looks lovely on your screen and disappears on a phone in daylight.
        </p>

        {issues.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm">
            <Check className="size-4 text-emerald" /> Every colour pairing reads clearly.
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {issues.map((issue) => (
                <div
                  key={`${String(issue.key)}-${issue.onLabel}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
                >
                  <Badge variant="destructive">{issue.ratio.toFixed(1)}:1</Badge>
                  <span className="min-w-0">
                    <strong className="font-normal">{issue.label}</strong> on {issue.onLabel} is too
                    faint — needs {issue.target}:1{issue.large ? " for large text" : ""}.
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-6 rounded-md border border-border"
                      style={{ background: issue.suggestion }}
                    />
                    <code className="text-xs text-muted-foreground">{issue.suggestion}</code>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => set(issue.key, issue.suggestion as Draft[typeof issue.key])}
                  >
                    Use this shade
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" className="mt-4" onClick={fixAll}>
              Fix them all for me
            </Button>
          </>
        )}
      </section>

      <section className="panel p-6">
        <h3 className="flex items-center gap-2 text-lg">
          <BookmarkPlus className="size-4 text-primary" /> Saved themes
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep a look for each celebration — one for the mehendi, another for the reception — and
          switch between them in a tap. Switching only changes what's on screen; press Save branding
          to put it in front of your guests.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Name this look
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Mehendi morning"
              className="mt-1 w-56"
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={savePreset.isPending}
            onClick={() => savePreset.mutate({ name: presetName, settings: draft })}
          >
            Save as a theme
          </Button>
        </div>

        {(presets.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No saved themes yet — set the colours and lettering you like, then save them here.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(presets.data ?? []).map((preset) => (
              <div key={preset.id} className="rounded-xl border border-border/60 p-4">
                <p style={{ fontFamily: fontStack(preset.settings.heading_font, true) }}>
                  {preset.name}
                </p>
                <div className="mt-3 flex gap-1.5">
                  {[
                    preset.settings.color_background,
                    preset.settings.color_surface,
                    preset.settings.color_primary,
                    preset.settings.color_accent,
                    preset.settings.color_foreground,
                  ].map((c, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className="size-6 rounded-md border border-border"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {preset.settings.heading_font} &amp; {preset.settings.body_font}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraft({ ...preset.settings });
                      setConfirmSave(false);
                      toast.message(`${preset.name} is on screen — press Save branding to keep it.`);
                    }}
                  >
                    <Eye className="mr-2 size-4" /> Try it
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      savePreset.mutate({
                        name: `${preset.name} copy`,
                        settings: preset.settings,
                      })
                    }
                  >
                    <Copy className="mr-2 size-4" /> Duplicate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => updatePreset.mutate(preset)}
                  >
                    Update
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${preset.name}`}
                    className="text-destructive"
                    onClick={() => removePreset.mutate(preset.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <InviteThemes />

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
