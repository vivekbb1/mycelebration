import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Globe, Mail, Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BRANDING_DEFAULTS, fontStack, type Branding } from "@/lib/branding";
import { slugProblem, slugify } from "@/lib/celebration-slug";
import { Link } from "@tanstack/react-router";
import { useFeatures } from "@/lib/features";
import { CelebrationQr } from "@/components/celebration-qr";

type Draft = Omit<Branding, "id">;

export type Invite = {
  id: string;
  name: string;
  note: string | null;
  branding_preset_id: string | null;
  created_at: string;
  slug: string | null;
  public_intro: string | null;
  custom_domain: string | null;
};

type Theme = { id: string; name: string; settings: Draft };

const MAIN = "__main__";

export function useInvites() {
  return useQuery({
    queryKey: ["invite-sets"],
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from("invites")
        .select("id, name, note, branding_preset_id, created_at, slug, public_intro, custom_domain")
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
      toast.success("Saved — everyone on that celebration sees the new look.");
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
      className="field-select max-w-full"
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

/** The celebration's own web address and the welcome line visitors read there. */
function WebAddress({ invite }: { invite: Invite }) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState(invite.slug ?? "");
  const [intro, setIntro] = useState(invite.public_intro ?? "");

  useEffect(() => {
    setSlug(invite.slug ?? "");
    setIntro(invite.public_intro ?? "");
  }, [invite.slug, invite.public_intro]);

  // Guests always get the public address, never the preview one.
  const origin = "https://mycelebration.app";
  const suggestion = slugify(invite.name);

  const save = useMutation({
    mutationFn: async (patch: { slug?: string | null; public_intro?: string | null }) => {
      const { error } = await supabase
        .from("invites")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (error) {
        if (error.code === "23505")
          throw new Error("Another celebration already uses that web address.");
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invite-sets"] });
      toast.success("Saved.");
    },
    onError: (e: Error) => {
      setSlug(invite.slug ?? "");
      toast.error(e.message);
    },
  });

  const commitSlug = () => {
    const clean = slugify(slug);
    if (!clean) {
      if (invite.slug) save.mutate({ slug: null });
      setSlug("");
      return;
    }
    const problem = slugProblem(clean);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSlug(clean);
    if (clean !== (invite.slug ?? "")) save.mutate({ slug: clean });
  };

  const link = slugify(slug) ? `${origin}/${slugify(slug)}` : "";

  return (
    <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="size-4 text-primary" />
        <span className="text-sm text-muted-foreground">Web address</span>
        <span className="text-xs text-muted-foreground">mycelebration.app/</span>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onBlur={commitSlug}
          placeholder={suggestion || "kush-khyati"}
          maxLength={60}
          aria-label={`Web address for ${invite.name}`}
          className="h-9 w-44"
        />
        <Button
          type="button"
          size="sm"
          onClick={commitSlug}
          disabled={save.isPending || slugify(slug) === (invite.slug ?? "")}
        >
          {invite.slug ? "Update" : "Save"}
        </Button>
        {!invite.slug && suggestion ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => save.mutate({ slug: suggestion })}>
            Use {suggestion}
          </Button>
        ) : null}
      </div>
      {link ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 break-all text-sm text-primary underline-offset-4 hover:underline"
          >
            {link}
          </a>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              toast.success("Link copied — share it with your guests.");
            }}
          >
            <Copy className="mr-1.5 size-3.5" /> Copy link
          </Button>
          {slugify(slug) !== (invite.slug ?? "") ? (
            <span className="text-xs text-muted-foreground">Not saved yet — tap Update.</span>
          ) : null}
        </div>
      ) : null}
      {link && invite.slug ? <CelebrationQr link={link} name={invite.slug} /> : null}
      <OwnDomain invite={invite} />
      <PageLook inviteId={invite.id} />
      <label className="block text-sm">
        A welcome line for that page (optional)
        <Textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          onBlur={() => {
            const clean = intro.trim();
            if (clean !== (invite.public_intro ?? "")) save.mutate({ public_intro: clean || null });
          }}
          rows={2}
          maxLength={600}
          placeholder="We can't wait to celebrate with you. Sign in with the code we sent you."
          className="mt-1"
        />
      </label>
    </div>
  );
}

/** The celebration's own domain — only for hosts with the "Own web address" add-on. */
function OwnDomain({ invite }: { invite: Invite }) {
  const { has } = useFeatures();
  const qc = useQueryClient();
  const [value, setValue] = useState(invite.custom_domain ?? "");
  useEffect(() => setValue(invite.custom_domain ?? ""), [invite.custom_domain]);

  const save = useMutation({
    mutationFn: async (domain: string | null) => {
      const { error } = await supabase
        .from("invites")
        .update({ custom_domain: domain, updated_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (error) {
        if (error.code === "23505") throw new Error("Another celebration already uses that domain.");
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invite-sets"] });
      toast.success("Domain saved — we'll finish connecting it for you.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!has("custom_domain")) {
    return (
      <p className="text-xs text-muted-foreground">
        Want your own domain, like kushkhyati.com?{" "}
        <Link to="/upgrade" className="text-primary hover:underline">
          Add "Own web address" on Your package
        </Link>
        .
      </p>
    );
  }

  const clean = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  const valid = !clean || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(clean);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="size-4 text-primary" />
        <span className="text-sm text-muted-foreground">Own domain</span>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="kushkhyati.com"
          className="h-9 w-52"
          aria-label={`Own domain for ${invite.name}`}
        />
        <Button
          type="button"
          size="sm"
          disabled={save.isPending || !valid || clean === (invite.custom_domain ?? "")}
          onClick={() => save.mutate(clean || null)}
        >
          {invite.custom_domain ? "Update" : "Save"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {!valid
          ? "That doesn't look like a domain — type it like kushkhyati.com."
          : !invite.slug
            ? "Set the web address above first, so the domain knows which page to open."
            : "Once saved, the platform team connects it; then the domain opens straight onto this celebration's page."}
      </p>
    </div>
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

/** Create a celebration (one wedding of its own), see what hangs off it, set its look. */
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
      if (clean.length < 2) throw new Error("Give the celebration a name first.");
      const { data, error } = await supabase
        .from("invites")
        .insert({ name: clean, note: note.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (newId) => {
      // Switch straight to the new celebration so the next screens work on it.
      if (newId) selected.setInviteId(newId);
      setName("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["invite-sets"] });
      toast.success("Celebration created — now add its events and guests.");
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
      toast.success("Celebration removed — its events and guests stay, unattached.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const themeList = themes.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="panel h-fit p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Mail className="size-4 text-primary" /> Add a celebration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One celebration is a wedding of its own — its own events, its own guest list and its own look.
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
            Create celebration
          </Button>
        </div>
      </div>

      <div className="panel h-fit p-4 sm:p-6">
        <h2 className="text-xl">Your celebrations ({invites.data?.length ?? 0})</h2>
        {(invites.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            None yet — create your first celebration on the left.
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
                      {evs} event{evs === 1 ? "" : "s"}
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
                  <WebAddress invite={v} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Compact list on the Branding page: which celebration wears which saved theme. */
export function InviteThemes() {
  const invites = useInvites();
  const themes = useThemes();
  const setTheme = useSetTheme();
  const themeList = themes.data ?? [];

  return (
    <section className="panel p-4 sm:p-6">
      <h3 className="flex items-center gap-2 text-lg">
        <Mail className="size-4 text-primary" /> The look for each celebration
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        A saved theme belongs to a celebration, so each one can look entirely its own.
        Guests on a celebration with no theme of its own see the main saved look above.
      </p>

      {themeList.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Save a theme above first, then you can give it to a celebration.
        </p>
      ) : (invites.data ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No celebrations yet — create one under the Celebration tab.
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


/** Logo, background photo and accent colour for the celebration's own page and its sign-in page. */
function PageLook({ inviteId }: { inviteId: string }) {
  const qc = useQueryClient();
  const look = useQuery({
    queryKey: ["page-look", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("public_logo_url, public_bg_url, public_accent")
        .eq("id", inviteId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (patch: {
    public_logo_url?: string | null;
    public_bg_url?: string | null;
    public_accent?: string | null;
  }) => {
    const { error } = await supabase.from("invites").update(patch).eq("id", inviteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved.");
    qc.invalidateQueries({ queryKey: ["page-look", inviteId] });
    qc.invalidateQueries({ queryKey: ["public-celebration"] });
  };

  const upload = async (kind: "public_logo_url" | "public_bg_url", file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Keep images under 8 MB."); return; }
    setBusy(kind);
    const path = `${inviteId}/celebration-page/${kind}-${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-")}`;
    const up = await supabase.storage.from("event-images").upload(path, file, { upsert: true });
    if (up.error) {
      setBusy(null);
      toast.error(up.error.message);
      return;
    }
    const signed = await supabase.storage
      .from("event-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setBusy(null);
    if (signed.error || !signed.data) { toast.error("Could not save the image."); return; }
    await save({ [kind]: signed.data.signedUrl });
  };

  const d = look.data;
  const Img = ({ kind, label }: { kind: "public_logo_url" | "public_bg_url"; label: string }) => (
    <div className="space-y-2">
      <p className="text-sm">{label}</p>
      {d?.[kind] ? (
        <img src={d[kind]!} alt="" className="h-16 w-auto rounded border border-border object-contain" />
      ) : (
        <p className="text-xs text-muted-foreground">None — uses your usual branding.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Input
          type="file"
          accept="image/*"
          className="max-w-56"
          disabled={busy === kind}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(kind, f);
            e.target.value = "";
          }}
        />
        {d?.[kind] ? (
          <Button size="sm" variant="ghost" onClick={() => void save({ [kind]: null })}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-3 rounded-md border border-border/60 p-3">
      <p className="text-sm font-medium">How the page looks</p>
      <p className="text-xs text-muted-foreground">
        Shown on the celebration's page and on the sign-in page guests reach from it.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Img kind="public_logo_url" label="Logo" />
        <Img kind="public_bg_url" label="Background photo" />
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Accent colour
        <input
          type="color"
          value={d?.public_accent ?? "#8a5a2b"}
          onChange={(e) => void save({ public_accent: e.target.value })}
          className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
        />
        {d?.public_accent ? (
          <Button size="sm" variant="ghost" onClick={() => void save({ public_accent: null })}>
            Use default
          </Button>
        ) : null}
      </label>
    </div>
  );
}
