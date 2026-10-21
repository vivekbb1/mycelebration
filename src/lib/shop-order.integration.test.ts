import { it } from "node:test";
import { strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

it("hosts can place an order for a reserved look without confirming or changing the guest selection", async () => {
  const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
  const url = process.env["VITE_SUPABASE_URL"], key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Test backend not configured");
  const client = createClient<Database>(url, key, { accessToken: async () => minted.session.access_token, auth: { persistSession: false } });
  const host = await client.from("celebration_hosts").select("invite_id").eq("user_id", minted.session.user.id).limit(1).single();
  if (host.error) throw host.error;
  const choices = await client.from("reservations").select("id, status, size_choice, outfit_id, member_code_id").eq("invite_id", host.data.invite_id).eq("status", "reserved");
  if (choices.error) throw choices.error;
  const orders = await client.from("wardrobe_orders").select("items").eq("invite_id", host.data.invite_id).neq("status", "cancelled");
  if (orders.error) throw orders.error;
  const used = new Set(orders.data.flatMap((o) => (o.items as { reservationId: string }[]).map((i) => i.reservationId)));
  const choice = choices.data.find((r) => !used.has(r.id));
  if (!choice) throw new Error("A reserved look not already ordered is required");
  let orderId: string | undefined;
  try {
    const saved = await client.from("wardrobe_orders").insert({ invite_id: host.data.invite_id, reference: `verification-${crypto.randomUUID()}`, status: "placed", items: [{ reservationId: choice.id, price: 100, discount: 0, measurements: { unit: "cm", height: 170 }, size: choice.size_choice, orderedSize: "L" }] }).select("id, status").single();
    if (saved.error) throw saved.error;
    orderId = saved.data.id;
    strictEqual(saved.data.status, "placed");
    const after = await client.from("reservations").select("status, size_choice, outfit_id, member_code_id").eq("id", choice.id).single();
    if (after.error) throw after.error;
    strictEqual(after.data.status, "reserved");
    strictEqual(after.data.size_choice, choice.size_choice);
    strictEqual(after.data.outfit_id, choice.outfit_id);
    strictEqual(after.data.member_code_id, choice.member_code_id);
  } finally {
    if (orderId) {
      const removed = await client.from("wardrobe_orders").delete().eq("id", orderId);
      if (removed.error) throw removed.error;
    }
  }
});