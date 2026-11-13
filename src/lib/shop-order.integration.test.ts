import { it } from "node:test";
import { strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createClient, type PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
type SizeOrder = Pick<Database["public"]["Tables"]["wardrobe_orders"]["Row"], "items" | "payments" | "documents" | "status">;

it("placed orders confirm looks and expose actual ordered sizes without replacing guest selections", async () => {
  const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
  const url = process.env["VITE_SUPABASE_URL"], key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Test backend not configured");
  const client = createClient<Database>(url, key, { accessToken: async () => minted.session.access_token, auth: { persistSession: false } });
  const host = await client.from("celebration_hosts").select("invite_id").eq("user_id", minted.session.user.id).limit(1).single();
  if (host.error) throw host.error;
  const outfit = await client.from("outfits").insert({ invite_id: host.data.invite_id, title: `Order verification ${crypto.randomUUID()}`, gender: "men" }).select("id").single();
  if (outfit.error) throw outfit.error;
  let reservationId: string | undefined;
  let orderId: string | undefined;
  try {
    const reserved = await client.from("reservations").insert({ invite_id: host.data.invite_id, outfit_id: outfit.data.id, guest_id: minted.session.user.id, guest_name: "Order verification", status: "reserved", size_choice: "M" }).select("id, size_choice, outfit_id, member_code_id").single();
    if (reserved.error) throw reserved.error;
    const choice = reserved.data;
    reservationId = choice.id;
    const saved = await client.from("wardrobe_orders").insert({ invite_id: host.data.invite_id, reference: `verification-${crypto.randomUUID()}`, status: "placed", items: [{ reservationId: choice.id, price: 100, discount: 0, measurements: { unit: "cm", height: 170 }, size: choice.size_choice, orderedSize: "L" }] }).select("id, status").single();
    if (saved.error) throw saved.error;
    orderId = saved.data.id;
    strictEqual(saved.data.status, "placed");
    const after = await client.from("reservations").select("status, size_choice, ordered_size, outfit_id, member_code_id").eq("id", choice.id).single();
    if (after.error) throw after.error;
    strictEqual(after.data.status, "confirmed");
    strictEqual(after.data.ordered_size, "L");
    strictEqual(after.data.size_choice, choice.size_choice);
    strictEqual(after.data.outfit_id, choice.outfit_id);
    strictEqual(after.data.member_code_id, choice.member_code_id);
    for (const [status, orderedSize] of [["placed", "XL"], ["shipped", "XXL"], ["delivered", "Custom tailored"]] as const) {
      const latest: PostgrestSingleResponse<SizeOrder> = await client.from("wardrobe_orders").select("items, payments, documents, status").eq("id", orderId).single();
      if (latest.error) throw latest.error;
      const items = latest.data.items as unknown as { reservationId: string; orderedSize: string }[];
      const changed: PostgrestSingleResponse<SizeOrder> = await client.from("wardrobe_orders").update({ status, items: items.map((i) => ({ ...i, orderedSize })) }).eq("id", orderId).select("items, payments, documents, status").single();
      if (changed.error) throw changed.error;
      strictEqual(changed.data.status, status);
      strictEqual(JSON.stringify(changed.data.payments), JSON.stringify(latest.data.payments));
      strictEqual(JSON.stringify(changed.data.documents), JSON.stringify(latest.data.documents));
      const guest = await client.from("reservations").select("ordered_size, size_choice, outfit_id, member_code_id, status").eq("id", choice.id).single();
      if (guest.error) throw guest.error;
      strictEqual(guest.data.ordered_size, orderedSize);
      strictEqual(guest.data.size_choice, "M");
      strictEqual(guest.data.outfit_id, choice.outfit_id);
      strictEqual(guest.data.member_code_id, choice.member_code_id);
      strictEqual(guest.data.status, "confirmed");
    }
    const cancelled = await client.from("wardrobe_orders").update({ status: "cancelled" }).eq("id", orderId);
    if (cancelled.error) throw cancelled.error;
    const released = await client.from("reservations").select("ordered_size, status, size_choice").eq("id", choice.id).single();
    if (released.error) throw released.error;
    strictEqual(released.data.ordered_size, null);
    strictEqual(released.data.status, "confirmed");
    strictEqual(released.data.size_choice, "M");
  } finally {
    if (orderId) {
      const removed = await client.from("wardrobe_orders").delete().eq("id", orderId);
      if (removed.error) throw removed.error;
    }
    if (reservationId) {
      const removed = await client.from("reservations").delete().eq("id", reservationId);
      if (removed.error) throw removed.error;
    }
    const removedOutfit = await client.from("outfits").delete().eq("id", outfit.data.id);
    if (removedOutfit.error) throw removedOutfit.error;
  }
});