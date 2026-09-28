import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Hosts (owner or co-host) of at least one celebration, from celebration_hosts. */
export function useIsAnyHost() {
  return useQuery({
    queryKey: ["is-any-host"],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_any_host");
      return data === true;
    },
  });
}

/** Runs the whole platform. Only for operator pages. */
export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ["is-platform-admin"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_platform_admin");
      return data === true;
    },
  });
}
