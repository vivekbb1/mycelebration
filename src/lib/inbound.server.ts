import { supabaseAdmin } from "@/integrations/supabase/client.server";

const digits = (s: string) => s.replace(/\D/g, "");

/** Find the guest a message came from, by email or phone. */
async function matchGuest(channel: "email" | "whatsapp", sender: string) {
  const { data } = await supabaseAdmin
    .from("invite_codes")
    .select("guest_name, household, email, phone")
    .not("household", "is", null);
  const rows = data ?? [];
  if (channel === "email") {
    const s = sender.trim().toLowerCase();
    return rows.find((r) => (r.email ?? "").trim().toLowerCase() === s) ?? null;
  }
  const s = digits(sender);
  if (s.length < 7) return null;
  return (
    rows.find((r) => {
      const p = digits(r.phone ?? "");
      return p.length >= 7 && (p === s || p.endsWith(s.slice(-10)) || s.endsWith(p.slice(-10)));
    }) ?? null
  );
}

/** Store an inbound email or WhatsApp in the family's Messages thread. */
export async function storeInbound(input: {
  channel: "email" | "whatsapp";
  sender: string;
  senderName?: string | null;
  subject?: string | null;
  body: string;
  externalId?: string | null;
}) {
  const body = input.body.trim().slice(0, 8000) || "(empty message)";
  const guest = await matchGuest(input.channel, input.sender);
  if (guest?.household) {
    const { error } = await supabaseAdmin.from("guest_messages").insert({
      household: guest.household,
      author_name: guest.guest_name ?? input.senderName ?? input.sender,
      from_host: false,
      body,
      channel: input.channel,
      subject: input.subject ?? null,
      external_id: input.externalId ?? null,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { matched: true };
  }
  const { error } = await supabaseAdmin.from("inbound_unmatched").insert({
    channel: input.channel,
    sender: input.sender,
    sender_name: input.senderName ?? null,
    subject: input.subject ?? null,
    body,
    external_id: input.externalId ?? null,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  return { matched: false };
}
