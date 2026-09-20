import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendResult = { sent: boolean; reason?: string };

function prettyDate(value: string | null) {
  if (!value) return "date to follow";
  const d = new Date(value.length > 10 ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(value.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

const KIND_LABEL: Record<string, string> = {
  pickup: "Pick-up",
  dropoff: "Drop-off",
  transfer: "Transfer",
};

/**
 * Sends one guest their car and hotel details: who is collecting them, when,
 * and the room they've been given. Host-only.
 */
export const sendArrivalDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { inviteId: string }) => {
    if (typeof data?.inviteId !== "string" || data.inviteId.length > 64) {
      throw new Error("Invalid guest");
    }
    return { inviteId: data.inviteId };
  })
  .handler(async ({ data, context }): Promise<SendResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { sent: false, reason: "forbidden" };

    const { data: guest } = await context.supabase
      .from("invite_codes")
      .select("guest_name, email, household")
      .eq("id", data.inviteId)
      .maybeSingle();

    if (!guest) return { sent: false, reason: "guest_not_found" };
    if (!guest.email) return { sent: false, reason: "no_email" };
    if (!guest.household) return { sent: false, reason: "nothing_to_send" };

    const [{ data: rides }, { data: stays }] = await Promise.all([
      context.supabase
        .from("guest_transport")
        .select("kind, driver_name, driver_phone, vehicle, from_place, to_place, scheduled_at, flight, notes")
        .eq("household", guest.household)
        .order("scheduled_at", { ascending: true }),
      context.supabase
        .from("guest_stays")
        .select("hotel_name, hotel_address, room_number, room_type, checkin_date, checkout_date, host_contact, notes")
        .eq("household", guest.household),
    ]);

    if ((rides ?? []).length === 0 && (stays ?? []).length === 0) {
      return { sent: false, reason: "nothing_to_send" };
    }

    const { escapeHtml, emailShell, sendGuestEmail } = await import("@/lib/email.server");

    const rideRows = (rides ?? [])
      .map(
        (r) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e4d3c6">
          <p style="margin:0;font-size:15px;color:#57302c">${escapeHtml(KIND_LABEL[r.kind] ?? r.kind)}${
            r.scheduled_at ? ` · ${escapeHtml(prettyDate(r.scheduled_at))}` : ""
          }</p>
          <p style="margin:3px 0 0;font-size:13px;color:#8a6a62">
            ${[r.from_place, r.to_place].filter(Boolean).map((p) => escapeHtml(String(p))).join(" → ")}
            ${r.flight ? `<br/>Flight ${escapeHtml(r.flight)}` : ""}
            ${r.driver_name ? `<br/>Driver: ${escapeHtml(r.driver_name)}${r.driver_phone ? ` · ${escapeHtml(r.driver_phone)}` : ""}` : ""}
            ${r.vehicle ? `<br/>Car: ${escapeHtml(r.vehicle)}` : ""}
            ${r.notes ? `<br/>${escapeHtml(r.notes)}` : ""}
          </p>
        </td></tr>`,
      )
      .join("");

    const stayRows = (stays ?? [])
      .map(
        (s) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e4d3c6">
          <p style="margin:0;font-size:15px;color:#57302c">${escapeHtml(s.hotel_name ?? "Your hotel")}${
            s.room_number ? ` · Room ${escapeHtml(s.room_number)}` : ""
          }</p>
          <p style="margin:3px 0 0;font-size:13px;color:#8a6a62">
            ${s.hotel_address ? `${escapeHtml(s.hotel_address)}<br/>` : ""}
            Check in ${escapeHtml(prettyDate(s.checkin_date))} · Check out ${escapeHtml(prettyDate(s.checkout_date))}
            ${s.room_type ? `<br/>${escapeHtml(s.room_type)}` : ""}
            ${s.host_contact ? `<br/>Any trouble, call ${escapeHtml(s.host_contact)}` : ""}
            ${s.notes ? `<br/>${escapeHtml(s.notes)}` : ""}
          </p>
        </td></tr>`,
      )
      .join("");

    const html = emailShell(`
    <div style="padding:30px">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#b08637;margin:0">Getting you there</p>
      <h1 style="font-size:26px;margin:12px 0 10px;color:#57302c">${escapeHtml(guest.guest_name)}, here are your travel and hotel details</h1>
      ${
        rideRows
          ? `<h2 style="font-size:17px;color:#57302c;margin:22px 0 6px">Your car</h2>
             <table style="width:100%;border-collapse:collapse">${rideRows}</table>`
          : ""
      }
      ${
        stayRows
          ? `<h2 style="font-size:17px;color:#57302c;margin:22px 0 6px">Where you're staying</h2>
             <table style="width:100%;border-collapse:collapse">${stayRows}</table>`
          : ""
      }
      <p style="color:#8a6a62;font-size:13px;line-height:1.6;margin:22px 0 0">
        Anything you'd like changed, just reply to this email and we'll sort it.
      </p>
    </div>`);

    return sendGuestEmail({
      to: guest.email,
      subject: `${guest.guest_name}, your car and hotel details`,
      html,
    });
  });
