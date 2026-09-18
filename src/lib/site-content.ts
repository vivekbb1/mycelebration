import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

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
};

export const SITE_CONTENT_KEY = ["site-content"];

/**
 * Every visible line of copy lives in `site_content` so the hosts can reword
 * anything. Components always pass the original wording as a fallback, so the
 * site reads correctly before the rows load.
 */
export function useSiteContent() {
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

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of query.data ?? []) m.set(row.key, row.value);
    return m;
  }, [query.data]);

  const t = (key: string, fallback: string) => {
    const value = map.get(key);
    return value && value.trim() ? value : fallback;
  };

  return { t, rows: query.data ?? [], isLoading: query.isLoading };
}
