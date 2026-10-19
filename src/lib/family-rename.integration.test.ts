import { it } from "node:test";
import { strictEqual } from "node:assert";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const sessionText = process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"];
it("allows capitalization corrections but detects a different family with the same name", { skip: !sessionText }, async () => {
  if (!sessionText) return;
  const session = JSON.parse(sessionText);
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Test backend not configured");
  const client = createClient<Database>(url, key, { accessToken: async () => session.access_token, auth: { persistSession: false } });
  const hosts = await client.from("celebration_hosts").select("invite_id").eq("user_id", session.user.id).limit(1);
  const inviteId = hosts.data?.[0]?.invite_id;
  if (!inviteId) throw new Error("A host session is required");
  const tag = crypto.randomUUID();
  const oldName = `kush family ${tag}`;
  const otherName = `Other Family ${tag}`;
  const rows = await client.from("families").insert([oldName, otherName].map((name) => ({ invite_id: inviteId, name, code: crypto.randomUUID() }))).select("id");
  if (rows.error) throw rows.error;
  try {
    const check = async (next: string) => {
      const result = await client.from("families").select("id", { count: "exact", head: true })
        .eq("invite_id", inviteId).ilike("name", next).neq("name", oldName);
      if (result.error) throw result.error;
      return result.count;
    };
    strictEqual(await check(`Kush Family ${tag}`), 0);
    strictEqual(await check(`other family ${tag}`), 1);
  } finally {
    const cleanup = await client.from("families").delete().in("id", rows.data.map((row) => row.id));
    if (cleanup.error) throw cleanup.error;
  }
});