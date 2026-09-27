import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useGuestEvent } from "@/lib/guest-event";
import { useSelectedEvent } from "@/lib/selected-event";

export type ContentRow = {
  key: string;
  value: string;
  default_value: string;
  label: string;
  group_name: string;
  page_name: string;
  kind: string;
  sort_order: number;
  updated_at: string | null;
  /** The platform-wide wording, before any celebration's own change. */
  base_value?: string;
  /** True when the celebration has its own wording for this line. */
  overridden?: boolean;
};

export const SITE_CONTENT_KEY = ["site-content"];

/**
 * Every visible line of copy lives in `site_content` (platform-wide), and each
 * celebration can reword guest and host lines in `celebration_content`.
 * Pass `inviteId: null` to read the platform wording only; leave it out to use
 * the celebration being viewed (host's selection, else the guest's).
 */
export function useSiteContent(opts: { inviteId?: string | null } = {}) {
  const selected = useSelectedEvent().inviteId;
  const guest = useGuestEvent().inviteId;
  const inviteId = opts.inviteId === undefined ? selected || guest || null : opts.inviteId;

  const query = useQuery({
    queryKey: SITE_CONTENT_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_content")
        .select(
          "key, value, default_value, label, group_name, page_name, kind, sort_order, updated_at",
        )
        .order("page_name")
        .order("group_name")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ContentRow[];
    },
  });

  const own = useQuery({
    queryKey: [...SITE_CONTENT_KEY, "celebration", inviteId],
    enabled: Boolean(inviteId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("celebration_content")
        .select("key, value, updated_at")
        .eq("invite_id", inviteId!);
      if (error) return [];
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const mine = new Map((own.data ?? []).map((r) => [r.key, r]));
    return (query.data ?? []).map((row) => {
      const o = inviteId ? mine.get(row.key) : undefined;
      return {
        ...row,
        base_value: row.value,
        overridden: Boolean(o),
        value: o?.value ?? row.value,
        updated_at: o?.updated_at ?? row.updated_at,
      };
    });
  }, [query.data, own.data, inviteId]);

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of rows) m.set(row.key, row.value);
    return m;
  }, [rows]);

  const t = (key: string, fallback: string) => {
    const value = map.get(key);
    return value && value.trim() ? value : fallback;
  };

  return { t, rows, inviteId, isLoading: query.isLoading };
}

// Keeps useContext import meaningful for tooling that tree-shakes hooks.
void useContext;
