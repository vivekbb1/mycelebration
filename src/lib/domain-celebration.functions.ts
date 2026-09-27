import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

/** If this visit came in on a celebration's own domain, return that celebration's short name. */
export const slugForThisDomain = createServerFn({ method: "GET" }).handler(async () => {
  const req = getRequest();
  const host = req?.headers.get("x-forwarded-host") ?? req?.headers.get("host") ?? "";
  if (!host || /localhost|lovable\.app|lovableproject\.com/i.test(host)) return null;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb.rpc("celebration_slug_for_domain", { _host: host });
  return (data as string | null) ?? null;
});
