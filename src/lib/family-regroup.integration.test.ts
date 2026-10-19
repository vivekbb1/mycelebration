import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const sessionText = process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"];
describe("host family regrouping", () => {
  it("splits selected members and merges the remainder without losing their invitation records", { skip: !sessionText }, async () => {
    if (!sessionText) return;
    const session = JSON.parse(sessionText);
    const url = process.env["VITE_SUPABASE_URL"];
    const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Test backend not configured");
    const client = createClient<Database>(url, key, { accessToken: async () => session.access_token, auth: { persistSession: false } });
    const hosts = await client.from("celebration_hosts").select("invite_id").eq("user_id", session.user.id).limit(1);
    const inviteId = hosts.data?.[0]?.invite_id;
    if (!inviteId) throw new Error("A host session is required");
    const tag = `Regroup test ${crypto.randomUUID()}`;
    const destination = `${tag} split`;
    const source = await client.from("families").insert({ invite_id: inviteId, name: tag, code: crypto.randomUUID() }).select("id").single();
    if (source.error) throw source.error;
    try {
      const codes = await client.from("invite_codes").insert(["First", "Second"].map((name) => ({ invite_id: inviteId, family_id: source.data.id, household: tag, guest_name: `${tag} ${name}`, code: crypto.randomUUID() }))).select("id, guest_name");
      if (codes.error) throw codes.error;
      const first = codes.data[0]; const second = codes.data[1];
      if (!first || !second) throw new Error("Test guests not created");
      const split = await client.rpc("host_regroup_family_members", { _invite_id: inviteId, _source: tag, _member_ids: [first.id], _new_name: destination });
      if (split.error) throw split.error;
      strictEqual((await client.from("invite_codes").select("household").eq("id", first.id).single()).data?.household, destination);
      strictEqual((await client.from("invite_codes").select("household").eq("id", second.id).single()).data?.household, tag);
      const target = await client.from("families").select("id").eq("invite_id", inviteId).eq("name", destination).single();
      if (target.error) throw target.error;
      const merge = await client.rpc("host_regroup_family_members", { _invite_id: inviteId, _source: tag, _member_ids: [second.id], _target_id: target.data.id });
      if (merge.error) throw merge.error;
      strictEqual((await client.from("invite_codes").select("id").eq("invite_id", inviteId).eq("household", destination)).data?.length, 2);
      strictEqual((await client.from("families").select("id").eq("id", source.data.id)).data?.length, 0);
    } finally {
      for (const household of [tag, destination]) {
        await client.from("family_notes").delete().eq("invite_id", inviteId).eq("household", household);
        await client.from("invite_codes").delete().eq("invite_id", inviteId).eq("household", household);
        await client.from("families").delete().eq("invite_id", inviteId).eq("name", household);
      }
    }
  });
});