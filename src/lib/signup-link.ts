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

/** Set just before an Apple / Google / Microsoft sign-in from a sign-up link, so the app can return there. */
export const PENDING_REGISTER = "mc-pending-register";
/** The last open sign-up link this browser visited, offered again if the family isn't registered yet. */
export const LAST_REGISTER = "mc-last-register";

/** Returns (and clears) the sign-up page to go back to after a social sign-in, if recent. */
export function takePendingRegister(): string | null {
  const raw = localStorage.getItem(PENDING_REGISTER);
  if (!raw) return null;
  localStorage.removeItem(PENDING_REGISTER);
  try {
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number };
    if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
    if (!at || Date.now() - at > 30 * 60_000) return null;
    return path;
  } catch {
    return null;
  }
}

export function signupUrl(slug: string, token: string) {
  return `${PUBLIC_ORIGIN}/${slug}/register?t=${encodeURIComponent(token)}`;
}
