import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Branding = {
  id: string;
  heading_font: string;
  body_font: string;
  base_font_size: number;
  heading_scale: number;
  radius: number;
  color_background: string;
  color_foreground: string;
  color_primary: string;
  color_primary_foreground: string;
  color_accent: string;
  color_surface: string;
  color_border: string;
  logo_url: string | null;
  logo_height: number;
  favicon_url: string | null;
};

export const BRANDING_DEFAULTS: Omit<Branding, "id"> = {
  heading_font: "Marcellus",
  body_font: "Karla",
  base_font_size: 16,
  heading_scale: 1,
  radius: 0.4,
  color_background: "#f9efe8",
  color_foreground: "#57302c",
  color_primary: "#b08637",
  color_primary_foreground: "#fdfaf6",
  color_accent: "#3f7a53",
  color_surface: "#fdf7f2",
  color_border: "#e4d3c6",
  logo_url: null,
  logo_height: 40,
  favicon_url: null,
};

/** Headings and body text the host can pick from — all loaded from Google Fonts. */
export const HEADING_FONTS = [
  "Marcellus",
  "Cormorant Garamond",
  "Playfair Display",
  "Libre Baskerville",
  "Lora",
  "Italiana",
  "Great Vibes",
  "Tenor Sans",
];

export const BODY_FONTS = [
  "Karla",
  "Inter",
  "Work Sans",
  "Nunito Sans",
  "Jost",
  "Mulish",
  "Lato",
  "Source Sans 3",
];

export function fontStack(name: string, serif: boolean) {
  return `"${name}", ${serif ? "ui-serif, Georgia, serif" : "ui-sans-serif, system-ui, sans-serif"}`;
}

export function fontHref(heading: string, body: string) {
  const fam = (n: string) => `family=${n.trim().replace(/\s+/g, "+")}:wght@400;500;600;700`;
  return `https://fonts.googleapis.com/css2?${fam(heading)}&${fam(body)}&display=swap`;
}

/** Live branding settings; falls back to the built-in look until the row loads. */
export function useBranding() {
  const query = useQuery({
    queryKey: ["branding"],
    staleTime: 60_000,
    queryFn: async (): Promise<Branding> => {
      const { data, error } = await supabase
        .from("branding")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw error;
      return { id: "default", ...BRANDING_DEFAULTS, ...(data ?? {}) } as Branding;
    },
  });

  return { branding: query.data ?? { id: "default", ...BRANDING_DEFAULTS }, query };
}

/** Applies branding to the live document: colours, fonts, text size, corners, favicon. */
export function applyBranding(b: Branding) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);

  set("--background", b.color_background);
  set("--foreground", b.color_foreground);
  set("--surface", b.color_surface);
  set("--surface-foreground", b.color_foreground);
  set("--card", b.color_surface);
  set("--card-foreground", b.color_foreground);
  set("--popover", b.color_surface);
  set("--popover-foreground", b.color_foreground);
  set("--primary", b.color_primary);
  set("--primary-foreground", b.color_primary_foreground);
  set("--gold", b.color_primary);
  set("--ring", b.color_primary);
  set("--accent", b.color_accent);
  set("--accent-foreground", b.color_primary_foreground);
  set("--emerald", b.color_accent);
  set("--border", b.color_border);
  set("--input", b.color_border);
  set("--radius", `${b.radius}rem`);
  set("--font-display", fontStack(b.heading_font, true));
  set("--font-sans", fontStack(b.body_font, false));

  root.style.fontSize = `${b.base_font_size}px`;
  set("--heading-scale", String(b.heading_scale));

  const id = "branding-fonts";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const href = fontHref(b.heading_font, b.body_font);
  if (link.href !== href) link.href = href;

  if (b.favicon_url) {
    let icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = b.favicon_url;
  }
}

/** Mount once near the top of the app so every page wears the host's branding. */
export function BrandingProvider() {
  const { branding } = useBranding();
  useEffect(() => {
    applyBranding(branding);
  }, [branding]);
  return null;
}
