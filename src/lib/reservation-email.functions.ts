import { PUBLIC_ORIGIN } from "@/lib/public-url";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendResult = { sent: boolean; reason?: string };

/**
 * Sends the guest a confirmation email for a reservation: outfit photo, size
 * guidance and the host-managed delivery details. Never throws — reserving must
 * succeed even if the mail provider is unavailable.
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
    const claims = context.claims as { email?: string } | null;
    const to = claims?.email;
    if (!to) return { sent: false, reason: "no_email" };

    const { data: outfit, error } = await context.supabase
      .from("outfits")
      .select("title, designer, image_url, size_note, price_note, garment_type, event_id")
      .eq("id", data.outfitId)
      .maybeSingle();
    if (error || !outfit) return { sent: false, reason: "outfit_not_found" };

    let functionName = "";
    let functionWhen = "";
    if (outfit.event_id) {
      const { data: ev } = await context.supabase
        .from("events")
        .select("name, event_date, start_time, venue")
        .eq("id", outfit.event_id)
        .maybeSingle();
      functionName = ev?.name ?? "";
      functionWhen = [ev?.event_date, ev?.start_time, ev?.venue].filter(Boolean).join(" · ");
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: plan } = await context.supabase
      .from("logistics")
      .select("hotel_name, checkin_note, measurements_deadline, team_name, team_whatsapp")
      .limit(1)
      .maybeSingle();

    const { escapeHtml, emailShell, sendGuestEmail } = await import("@/lib/email.server");

    const origin = PUBLIC_ORIGIN;
    const image = outfit.image_url
      ? outfit.image_url.startsWith("http")
        ? outfit.image_url
        : `${origin}${outfit.image_url}`
      : null;

    const rows: Array<[string, string]> = [
      ["Function", functionName || "—"],
      ["When & where", functionWhen || "Details in the portal"],
      ["Designer", outfit.designer ?? "—"],
      ["Garment", outfit.garment_type ?? "—"],
      ["Size", outfit.size_note ?? "Made to your measurements"],
    ];

    const arrival = [
      plan?.checkin_note ??
        "Your outfit is pressed, labelled and placed in your hotel room before you check in — the events team handles the rest.",
      plan?.hotel_name ? `Hotel: ${plan.hotel_name}.` : null,
      plan?.team_name
        ? `Questions? Ask ${plan.team_name}${plan.team_whatsapp ? ` on ${plan.team_whatsapp}` : ""}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    const html = emailShell(`
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
        <p style="margin:0 0 6px;color:#caa04b">When you arrive</p>
        <p style="margin:0;color:#c9c3b5">${escapeHtml(arrival)}</p>
      </div>
      <div style="margin-top:22px;font-size:14px">
        <p style="margin:0 0 6px;color:#caa04b">Next step</p>
        <p style="margin:0;color:#c9c3b5">
          ${escapeHtml(plan?.measurements_deadline ?? "Send your measurements so tailoring can begin.")}
          <a href="${origin}/guest/measurements" style="color:#f3ecdf">${origin}/guest/measurements</a>
        </p>
      </div>
    </div>`);

    return sendGuestEmail({
      to,
      subject: `Confirmed: ${outfit.title}${functionName ? ` for the ${functionName}` : ""}`,
      html,
    });
  });
