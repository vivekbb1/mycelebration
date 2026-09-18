import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BRANDING_DEFAULTS, fontStack, type Branding } from "@/lib/branding";

type Draft = Omit<Branding, "id">;

export type Invite = {
  id: string;
  name: string;
  note: string | null;
  branding_preset_id: string | null;
  created_at: string;
};

type Theme = { id: string; name: string; settings: Draft };

const MAIN = "__main__";

export function useInvites() {
  return useQuery({
    queryKey: ["invite-sets"],
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from("invites")
        .select("id, name, note, branding_preset_id, created_at")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });
}

function useThemes() {
  return useQuery({
    queryKey: ["branding-presets"],
    queryFn: async (): Promise<Theme[]> => {
      const { data, error } = await supabase
        .from("branding_presets")
        .select("id, name, settings")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        settings: { ...BRANDING_DEFAULTS, ...((row.settings ?? {}) as Partial<Draft>) },
      }));
    },
  });
}

function useSetTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; preset: string | null }) => {
      const { error } = await supabase
        .from("invites")
        .update({ branding_preset_id: vars.preset, updated_at: new Date().toISOString() })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invite-sets"] });
      toast.success("Saved — everyone on that invitation sees the new look.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function ThemePicker({
  value,
  label,
  themes,
  onPick,
}: {
  value: string | null;
  label: string;
  themes: Theme[];
  onPick: (preset: string | null) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? MAIN}
      onChange={(e) => onPick(e.target.value === MAIN ? null : e.target.value)}
      className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
    >
      <option value={MAIN}>Main saved look</option>
      {themes.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

function Swatches({ theme }: { theme: Theme | undefined }) {
  if (!theme) return null;
  return (
    <span className="flex items-center gap-1.5">
      {[
        theme.settings.color_background,
        theme.settings.color_surface,
        theme.settings.color_primary,
        theme.settings.color_foreground,
      ].map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="size-4 rounded border border-border"
          style={{ background: c }}
        />
      ))}
      <span
        className="text-xs text-muted-foreground"
        style={{ fontFamily: fontStack(theme.settings.heading_font, true) }}
      >
        {theme.settings.heading_font}
      </span>
    </span>
  );
}

/** Create an invitation (a celebration of its own), see what hangs off it, set its look. */
export function HostInvites() {
  const qc = useQueryClient();
  const invites = useInvites();
  const themes = useThemes();
  const setTheme = useSetTheme();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const counts = useQuery({
    queryKey: ["invite-counts"],
    queryFn: async () => {
      const [events, families, people] = await Promise.all([
        supabase.from("events").select("id, invite_id"),
        supabase.from("families").select("id, invite_id"),
        supabase.from("invite_codes").select("id, invite_id, family_id"),
      ]);
      if (events.error) throw events.error;
      if (families.error) throw families.error;
      if (people.error) throw people.error;
      return {
        events: events.data ?? [],
        families: families.data ?? [],
        people: people.data ?? [],
      };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const clean = name.trim();
      if (clean.length < 2) throw new Error("Give the invitation a name first.");
      const { error } = await supabase
        .from("invites")
        .insert({ name: clean, note: note.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["invite-sets"] });
      toast.success("Invitation created — now add its functions and guests.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (invite: Invite) => {
      const { error } = await supabase.from("invites").delete().eq("id", invite.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invite-sets"] });
      qc.invalidateQueries({ queryKey: ["invite-counts"] });
      toast.success("Invitation removed — its functions and guests stay, unattached.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const themeList = themes.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="panel h-fit p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Mail className="size-4 text-primary" /> Add an invitation
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One invitation is one celebration — its own functions, its own guest list and its own look.
          Run as many side by side as you like.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block text-sm">
            Name
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kush & Khyati"
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            A note for your team (optional)
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bride's side, November"
              className="mt-1"
            />
          </label>
          <Button type="button" disabled={create.isPending} onClick={() => create.mutate()}>
            Create invitation
          </Button>
        </div>
      </div>

      <div className="panel h-fit p-6">
        <h2 className="text-xl">Your invitations ({invites.data?.length ?? 0})</h2>
        {(invites.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            None yet — create your first invitation on the left.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(invites.data ?? []).map((v) => {
              const evs = (counts.data?.events ?? []).filter((e) => e.invite_id === v.id).length;
              const fams = (counts.data?.families ?? []).filter((f) => f.invite_id === v.id).length;
              const pax = (counts.data?.people ?? []).filter((p) => p.invite_id === v.id).length;
              const theme = themeList.find((t) => t.id === v.branding_preset_id);
              return (
                <li key={v.id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0">{v.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {evs} function{evs === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {fams} famil{fams === 1 ? "y" : "ies"} · {pax} guest{pax === 1 ? "" : "s"}
                    </Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${v.name}`}
                      className="ml-auto text-destructive"
                      onClick={() => remove.mutate(v)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {v.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{v.note}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
                    <Palette className="size-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Look</span>
                    <Swatches theme={theme} />
                    <span className="ml-auto">
                      <ThemePicker
                        label={`Look for ${v.name}`}
                        value={v.branding_preset_id}
                        themes={themeList}
                        onPick={(preset) => setTheme.mutate({ id: v.id, preset })}
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Compact list on the Branding page: which invitation wears which saved theme. */
export function InviteThemes() {
  const invites = useInvites();
  const themes = useThemes();
  const setTheme = useSetTheme();
  const themeList = themes.data ?? [];

  return (
    <section className="panel p-6">
      <h3 className="flex items-center gap-2 text-lg">
        <Mail className="size-4 text-primary" /> The look for each invitation
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        A saved theme belongs to an invitation, so each celebration can look entirely its own.
        Guests on an invitation with no theme of its own see the main saved look above.
      </p>

      {themeList.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Save a theme above first, then you can give it to an invitation.
        </p>
      ) : (invites.data ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No invitations yet — create one under the Invitations tab.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {(invites.data ?? []).map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 p-4"
            >
              <span className="min-w-0">{v.name}</span>
              <Swatches theme={themeList.find((t) => t.id === v.branding_preset_id)} />
              <span className="ml-auto">
                <ThemePicker
                  label={`Look for ${v.name}`}
                  value={v.branding_preset_id}
                  themes={themeList}
                  onPick={(preset) => setTheme.mutate({ id: v.id, preset })}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
