import { it } from "node:test";
import { strictEqual, deepStrictEqual, ok } from "node:assert";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

it("link ranges include the boundaries, preserve old choices and host selection confirms without replacement", async () => {
  const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
  const url = process.env["VITE_SUPABASE_URL"], key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Test backend not configured");
  const client = createClient<Database>(url, key, { accessToken: async () => minted.session.access_token, auth: { persistSession: false } });
  const host = await client.from("celebration_hosts").select("invite_id").eq("user_id", minted.session.user.id).limit(1).single();
  if (host.error) throw host.error;
  const inviteId = host.data.invite_id, name = `Selection verification ${crypto.randomUUID()}`;
  const event = await client.from("events").insert({ invite_id: inviteId, name, outfit_selection: true }).select("id").single();
  if (event.error) throw event.error;
  let linkId: string | undefined, familyId: string | undefined, memberId: string | undefined;
  let outfitIds: string[] = [];
  try {
    const link = await client.from("signup_links").insert({ invite_id: inviteId, label: name, token: crypto.randomUUID(), event_ids: [event.data.id], outfit_max_price: 35000 }).select("id").single();
    if (link.error) throw link.error;
    linkId = link.data.id;
    const fam = await client.from("families").insert({ invite_id: inviteId, name, code: crypto.randomUUID(), signup_link_id: linkId }).select("id").single();
    if (fam.error) throw fam.error;
    familyId = fam.data.id;
    const member = await client.from("invite_codes").insert({ invite_id: inviteId, family_id: familyId, household: name, code: crypto.randomUUID(), guest_name: name, gender: "men" }).select("id").single();
    if (member.error) throw member.error;
    memberId = member.data.id;
    const prices = [29999, 30000, 35000, 35001, 60000, 60001];
    const outfits = await client.from("outfits").insert(prices.map((price) => ({ invite_id: inviteId, event_id: event.data.id, title: `${name} ${price}`, gender: "men", price_inr: price }))).select("id, price_inr");
    if (outfits.error) throw outfits.error;
    outfitIds = outfits.data.map((o) => o.id);
    const idAt = (price: number) => { const id = outfits.data.find((o) => o.price_inr === price)?.id; if (!id) throw new Error("Fixture missing"); return id; };
    strictEqual((await client.rpc("member_outfit_allowed", { _member: memberId, _outfit: idAt(35000) })).data, true);
    strictEqual((await client.rpc("member_outfit_allowed", { _member: memberId, _outfit: idAt(35001) })).data, false);
    const denied = await client.rpc("host_choose_outfit", { _member: memberId, _outfit: idAt(35001) });
    ok(denied.error);
    const access = await client.from("household_event_invites").insert({ invite_id: inviteId, household: name, event_id: event.data.id, outfit_selection: false });
    if (access.error) throw access.error;
    const notOffered = await client.rpc("host_choose_outfit", { _member: memberId, _outfit: idAt(35000), _size: "L" });
    ok(notOffered.error?.message.includes("not offered outfits"));
    await client.from("household_event_invites").delete().eq("event_id", event.data.id).eq("household", name);
    // No explicit family restrictions must allow globally enabled events, like Oscar's family.
    const choose = await client.rpc("host_choose_outfit", { _member: memberId, _outfit: idAt(35000), _size: "L" });
    if (choose.error) throw choose.error;
    const before = await client.from("reservations").select("id, status, outfit_id, size_choice, member_code_id").eq("id", choose.data).single();
    if (before.error) throw before.error;
    strictEqual(before.data.status, "confirmed"); strictEqual(before.data.size_choice, "L"); strictEqual(before.data.member_code_id, memberId);
    const again = await client.rpc("host_choose_outfit", { _member: memberId, _outfit: idAt(30000), _size: "M" });
    ok(again.error);
    await client.from("signup_links").update({ outfit_min_price: 30000, outfit_max_price: 60000 }).eq("id", linkId);
    for (const [price, expected] of [[29999, false], [30000, true], [60000, true], [60001, false]] as const) {
      strictEqual((await client.rpc("member_outfit_allowed", { _member: memberId, _outfit: idAt(price) })).data, expected);
    }
    await client.from("signup_links").update({ outfit_min_price: 40000 }).eq("id", linkId);
    const gallery = await client.rpc("guest_outfit_ids", { _member: memberId });
    if (gallery.error) throw gallery.error;
    ok(gallery.data.includes(idAt(35000)));
    const after = await client.from("reservations").select("id, status, outfit_id, size_choice, member_code_id").eq("id", choose.data).single();
    deepStrictEqual(after.data, before.data);
  } finally {
    if (memberId) await client.from("reservations").delete().eq("member_code_id", memberId);
    await client.from("household_event_invites").delete().eq("event_id", event.data.id);
    if (memberId) await client.from("invite_codes").delete().eq("id", memberId);
    if (familyId) await client.from("families").delete().eq("id", familyId);
    if (linkId) await client.from("signup_links").delete().eq("id", linkId);
    if (outfitIds.length) await client.from("outfits").delete().in("id", outfitIds);
    await client.from("events").delete().eq("id", event.data.id);
  }
});