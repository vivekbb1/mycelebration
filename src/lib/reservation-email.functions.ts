import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendResult = { sent: boolean; reason?: string };

/**
 * Sends the guest a confirmation email for a reservation: outfit photo, size
 * guidance and pickup details. Never throws — reserving must succeed even if
 * the mail provider is unavailable.
 */
export const sendReservationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { outfitId: string }) => {
    if (typeof data?.outfitId !== "string" || data.outfitId.length > 64) {
      throw new Error("Invalid outfit");
    }
    return { outfitId: data.outfitId };
  })
  .handler(async ({ data, context }): Promise<SendResult> => {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["RESERVATION_EMAIL_FROM"] ?? "onboarding@resend.dev";

    const claims = context.claims as { email?: string } | null;
    const to = claims?.email;
    if (!to) return { sent: false, reason: "no_email" };
    if (!apiKey) return { sent: false, reason: "email_not_configured" };

    const { data: outfit, error } = await context.supabase
      .from("outfits")
      .select("title, designer, image_url, size_note, price_note, garment_type, event_id")
      .eq("id", data.outfitId)
      .maybeSingle();
    if (error || !outfit) return { sent: false, reason: "outfit_not_found" };

    let functionName = "";
    let functionDate = "";
    if (outfit.event_id) {
      const { data: ev } = await context.supabase
        .from("events")
        .select("name, event_date, venue")
        .eq("id", outfit.event_id)
        .maybeSingle();
      functionName = ev?.name ?? "";
      functionDate = [ev?.event_date, ev?.venue].filter(Boolean).join(" · ");
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const origin = new URL(getRequest().url).origin;
    const image = outfit.image_url
      ? outfit.image_url.startsWith("http")
        ? outfit.image_url
        : `${origin}${outfit.image_url}`
      : null;

    const rows: Array<[string, string]> = [
      ["Function", functionName || "—"],
      ["When & where", functionDate || "Details in the portal"],
      ["Designer", outfit.designer ?? "—"],
      ["Garment", outfit.garment_type ?? "—"],
      ["Size", outfit.size_note ?? "Made to your measurements"],
    ];

    const html = `
<div style="font-family:Georgia,serif;background:#0e1230;color:#f3ecdf;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#151a3c;border:1px solid #caa04b33;border-radius:14px;overflow:hidden">
    ${image ? `<img src="${image}" alt="${escapeHtml(outfit.title)}" width="560" style="width:100%;display:block" />` : ""}
    <div style="padding:26px">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#caa04b;margin:0">Reservation confirmed</p>
      <h1 style="font-size:24px;margin:12px 0 6px">${escapeHtml(outfit.title)}</h1>
      <p style="color:#c9c3b5;font-size:14px;margin:0 0 18px">
        ${escapeHtml(profile?.full_name || "Dear guest")}, this look is now locked for you — no other guest can reserve it.
      </p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 0;color:#8f8b80">${escapeHtml(k)}</td><td style="padding:6px 0;text-align:right">${escapeHtml(v)}</td></tr>`,
          )
          .join("")}
      </table>
      <div style="margin-top:22px;padding-top:18px;border-top:1px solid #ffffff1a;font-size:14px">
        <p style="margin:0 0 6px;color:#caa04b">Pickup</p>
        <p style="margin:0;color:#c9c3b5">Tue 10 Feb 2027, 2–8 pm — wardrobe suite at Devi Ratn, Jaipur.
        Late arrivals can collect Wed 11 Feb, 9–11:30 am. Tailoring, delivery and the outfit are our gift.</p>
      </div>
      <div style="margin-top:22px;font-size:14px">
        <p style="margin:0 0 6px;color:#caa04b">Next step</p>
        <p style="margin:0;color:#c9c3b5">Send your measurements by 20 December 2026:
        <a href="${origin}/measurements" style="color:#f3ecdf">${origin}/measurements</a></p>
      </div>
    </div>
  </div>
</div>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `The Wedding Wardrobe <${from}>`,
          to: [to],
          subject: `Confirmed: ${outfit.title}${functionName ? ` for the ${functionName}` : ""}`,
          html,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`Reservation email failed [${res.status}]: ${body}`);
        return { sent: false, reason: `provider_error_${res.status}` };
      }
      return { sent: true };
    } catch (err) {
      console.error("Reservation email threw", err);
      return { sent: false, reason: "network_error" };
    }
  });

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
