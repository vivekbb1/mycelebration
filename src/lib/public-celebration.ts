import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PublicCelebration = {
  name: string;
  slug: string | null;
  intro: string | null;
  cover_logo_url: string | null;
  bg_url: string | null;
  accent: string | null;
  /** The celebration page's own wording (celebration_page.* keys). */
  texts?: Record<string, string> | null;
};

export async function fetchCelebrationBySlug(slug: string): Promise<PublicCelebration | null> {
  const { data, error } = await supabase.rpc("celebration_by_slug", { _slug: slug });
  if (error) return null;
  const row = (data ?? null) as PublicCelebration | null;
  return row?.name ? row : null;
}

export function useCelebrationBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["public-celebration", slug?.toLowerCase()],
    enabled: Boolean(slug),
    queryFn: () => fetchCelebrationBySlug(slug!),
    staleTime: 5 * 60_000,
  });
}

/** Only a plain hex colour is allowed through to inline styles. */
export function safeAccent(v: string | null | undefined) {
  return v && /^#[0-9a-f]{3,8}$/i.test(v) ? v : null;
}

/** Background image + accent colour for a celebration page, as inline styles. */
export function celebrationStyle(c: PublicCelebration | null | undefined): React.CSSProperties {
  if (!c) return {};
  const accent = safeAccent(c.accent);
  const style: Record<string, string> = {};
  if (c.bg_url && /^https:\/\//i.test(c.bg_url)) {
    style["backgroundImage"] = `linear-gradient(color-mix(in oklab, var(--background) 72%, transparent), color-mix(in oklab, var(--background) 88%, transparent)), url("${c.bg_url.replace(/"/g, "")}")`;
    style["backgroundSize"] = "cover";
    style["backgroundPosition"] = "center";
  }
  if (accent) {
    style["--primary"] = accent;
    style["--ring"] = accent;
  }
  return style as React.CSSProperties;
}
