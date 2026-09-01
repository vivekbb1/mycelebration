// Server-only email transport for guest mail (invitations, reservation confirmations).
// Never throws: wedding actions must succeed even when mail is unavailable.

export type SendResult = { sent: boolean; reason?: string };

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailShell(inner: string) {
  return `
<div style="font-family:Georgia,serif;background:#0e1230;color:#f3ecdf;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#151a3c;border:1px solid #caa04b33;border-radius:14px;overflow:hidden">
    ${inner}
  </div>
</div>`;
}

export async function sendGuestEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESERVATION_EMAIL_FROM"];
  if (!apiKey) return { sent: false, reason: "email_not_configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `The Wedding Wardrobe <${from ?? "onboarding@resend.dev"}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Guest email failed [${res.status}]: ${body}`);
      return { sent: false, reason: `provider_error_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("Guest email threw", err);
    return { sent: false, reason: "network_error" };
  }
}
