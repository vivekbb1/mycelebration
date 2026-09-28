import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { PUBLIC_ORIGIN } from "@/lib/public-url";

/** Public details of an open family sign-up link (never the events or token list). */
export function useSignupLink(token: string | undefined) {
  return useQuery({
    queryKey: ["signup-link", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await supabase.rpc("signup_link_info", { _token: token! });
      return (data ?? null) as { label: string; name: string; slug: string | null } | null;
    },
  });
}

export function signupUrl(slug: string, token: string) {
  return `${PUBLIC_ORIGIN}/${slug}/register?t=${encodeURIComponent(token)}`;
}
