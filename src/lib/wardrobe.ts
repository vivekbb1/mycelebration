import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Some families are local and only ever RSVP — the hosts switch the wardrobe
 * off for them, and the outfit and measurement steps disappear.
 */
export function useNeedsWardrobe() {
  const query = useQuery({
    queryKey: ["my-family-needs-wardrobe"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_family_needs_wardrobe");
      if (error) throw error;
      return data !== false;
    },
    staleTime: 60_000,
  });

  // Default to showing the wardrobe until we know otherwise.
  return { needsWardrobe: query.data !== false, isLoading: query.isLoading };
}
