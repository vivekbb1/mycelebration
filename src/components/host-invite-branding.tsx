import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BRANDING_DEFAULTS, fontStack, type Branding } from "@/lib/branding";

type Draft = Omit<Branding, "id">;

type Theme = { id: string; name: string; settings: Draft };

type Family = {
  id: string;
  name: string;
  code: string;
  branding_preset_id: string | null;
};

type Member = {
  id: string;
  code: string;
  guest_name: string;
  household: string | null;
  family_id: string | null;
  branding_preset_id: string | null;
};

const MAIN = "__main__";

/** Lets any host put one of the saved themes behind a particular invitation code. */
export function HostInviteBranding() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const themes = useQuery({
    queryKey: ["branding-presets"],
    queryFn: async (): Promise<Theme[]> => {
      const { data, error } = await supabase
        .from("branding_presets")
        .select("id, name, settings")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        settings: { ...BRANDING_DEFAULTS, ...((row.settings ?? {}) as Partial<Draft>) },
      }));
    },
  });

  const families = useQuery({
    queryKey: ["branding-families"],
    queryFn: async (): Promise<Family[]> => {
      const { data, error } = await supabase
        .from("families")
        .select("id, name, code, branding_preset_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Family[];
    },
  });

  const members = useQuery({
    queryKey: ["branding-invites"],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, code, guest_name, household, family_id, branding_preset_id")
        .order("guest_name");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const setFamilyTheme = useMutation({
    mutationFn: async (vars: { id: string; preset: string | null }) => {
      const { error } = await supabase
        .from("families")
        .update({ branding_preset_id: vars.preset })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding-families"] });
      toast.success("Saved — everyone on that invitation sees the new look.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setMemberTheme = useMutation({
    mutationFn: async (vars: { id: string; preset: string | null }) => {
      const { error } = await supabase
        .from("invite_codes")
        .update({ branding_preset_id: vars.preset })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding-invites"] });
      toast.success("Saved for that person's own code.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const themeList = themes.data ?? [];
  const byId = useMemo(
    () => new Map(themeList.map((t) => [t.id, t] as const)),
    [themeList],
  );

  const needle = search.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

  const shownFamilies = (families.data ?? []).filter(
    (f) => matches(f.name) || matches(f.code),
  );
  const loose = (members.data ?? []).filter(
    (m) => !m.family_id && (matches(m.guest_name) || matches(m.code)),
  );

  const Picker = ({
    value,
    onPick,
    label,
  }: {
    value: string | null;
    onPick: (preset: string | null) => void;
    label: string;
  }) => (
    <select
      aria-label={label}
      value={value ?? MAIN}
      onChange={(e) => onPick(e.target.value === MAIN ? null : e.target.value)}
      className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
    >
      <option value={MAIN}>Main saved look</option>
      {themeList.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );

  const Swatches = ({ id }: { id: string | null }) => {
    const theme = id ? byId.get(id) : null;
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
  };

  return (
    <section className="panel p-6">
      <h3 className="flex items-center gap-2 text-lg">
        <Ticket className="size-4 text-primary" /> Looks per invitation
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Each host can dress their own invitations. Pick a saved theme for an invitation code and
        everyone who opens it sees that look — guests on other codes are untouched. Leave it on the
        main saved look to follow the whole site.
      </p>

      {themeList.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Save a theme above first, then you can put it behind an invitation code.
        </p>
      ) : (
        <>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a family or code"
            className="mt-4 max-w-xs"
          />

          {shownFamilies.length === 0 && loose.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No invitations here yet — add families under Guests first.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {shownFamilies.map((f) => {
                const people = (members.data ?? []).filter((m) => m.family_id === f.id);
                return (
                  <div key={f.id} className="rounded-xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0">{f.name}</span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {f.code}
                      </Badge>
                      <Swatches id={f.branding_preset_id} />
                      <span className="ml-auto">
                        <Picker
                          label={`Look for ${f.name}`}
                          value={f.branding_preset_id}
                          onPick={(preset) => setFamilyTheme.mutate({ id: f.id, preset })}
                        />
                      </span>
                    </div>

                    {people.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                        {people.map((m) => (
                          <div key={m.id} className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="text-muted-foreground">{m.guest_name}</span>
                            <Badge variant="outline" className="font-mono text-xs">
                              {m.code}
                            </Badge>
                            <span className="ml-auto">
                              <Picker
                                label={`Look for ${m.guest_name}`}
                                value={m.branding_preset_id}
                                onPick={(preset) => setMemberTheme.mutate({ id: m.id, preset })}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {loose.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 p-4"
                >
                  <span className="min-w-0">{m.guest_name}</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {m.code}
                  </Badge>
                  <Swatches id={m.branding_preset_id} />
                  <span className="ml-auto">
                    <Picker
                      label={`Look for ${m.guest_name}`}
                      value={m.branding_preset_id}
                      onPick={(preset) => setMemberTheme.mutate({ id: m.id, preset })}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
