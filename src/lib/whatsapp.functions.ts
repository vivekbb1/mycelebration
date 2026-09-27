import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  inviteId: z.string().uuid(),
  template: z.string().min(1).max(120).regex(/^[a-z0-9_]+$/),
  language: z.string().min(2).max(10),
  withName: z.boolean(),
  households: z.array(z.string().max(200)).max(5000).nullable(),
});

/**
 * Sends an approved WhatsApp template to every guest of a celebration who has a
 * mobile number (optionally only chosen families). Host-only.
 */
export const sendWhatsAppBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, reason: "forbidden" };

    const token = process.env["WHATSAPP_ACCESS_TOKEN"];
    const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
    if (!token || !phoneId) return { ok: false as const, reason: "not_configured" };

    let q = context.supabase
      .from("invite_codes")
      .select("guest_name, household, phone")
      .eq("invite_id", data.inviteId)
      .not("phone", "is", null);
    if (data.households) q = q.in("household", data.households);
    const { data: guests, error } = await q;
    if (error) return { ok: false as const, reason: error.message };

    const seen = new Set<string>();
    const failures: { name: string; error: string }[] = [];
    let sent = 0;
    for (const g of guests ?? []) {
      const to = (g.phone ?? "").replace(/\D/g, "");
      if (to.length < 8 || seen.has(to)) continue;
      seen.add(to);
      const template: Record<string, unknown> = { name: data.template, language: { code: data.language } };
      if (data.withName) {
        template["components"] = [
          { type: "body", parameters: [{ type: "text", text: g.guest_name || "there" }] },
        ];
      }
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template }),
      });
      if (res.ok) sent++;
      else {
        const body = await res.text();
        let msg = body;
        try {
          msg = JSON.parse(body)?.error?.message ?? body;
        } catch {}
        failures.push({ name: g.guest_name ?? to, error: msg.slice(0, 200) });
      }
    }

    await context.supabase.from("whatsapp_broadcasts").insert({
      invite_id: data.inviteId,
      template_name: data.template,
      language: data.language,
      sent_count: sent,
      failed_count: failures.length,
      failures,
      created_by: context.userId,
    });
    return { ok: true as const, sent, failed: failures.length, failures };
  });
