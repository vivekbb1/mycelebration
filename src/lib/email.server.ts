// Server-only email transport for guest mail (invitations, reservation confirmations).
// Never throws: wedding actions must succeed even when mail is unavailable.
//
// The host picks the sending route on the host page (Email tab):
//   lovable  -> Lovable's own sending, using the sender domain set up for this project
//   resend / sendgrid / brevo -> the host's own third-party account (API key stored as a secret)

export type SendResult = { sent: boolean; reason?: string };

export type EmailProvider = "lovable" | "resend" | "sendgrid" | "brevo" | "none";

export const PROVIDER_KEYS: Record<Exclude<EmailProvider, "lovable" | "none">, string> = {
  resend: "RESEND_API_KEY",
  sendgrid: "SENDGRID_API_KEY",
  brevo: "BREVO_API_KEY",
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailShell(inner: string) {
  return `
<div style="font-family:Georgia,serif;background:#fdf1ec;color:#4a1f2b;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#fffaf5;border:1px solid #c9a84c55;border-radius:14px;overflow:hidden">
    ${inner}
  </div>
</div>`;
}

type Settings = {
  provider: EmailProvider;
  fromEmail: string | null;
  fromName: string;
};

/** Reads the host's chosen sending route. Falls back to Lovable sending. */
export async function readEmailSettings(): Promise<Settings> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("email_settings")
      .select("provider, from_email, from_name")
      .eq("id", "default")
      .maybeSingle();
    return {
      provider: (data?.provider as EmailProvider) ?? "lovable",
      fromEmail: data?.from_email ?? null,
      fromName: data?.from_name?.trim() || "The Wedding Wardrobe",
    };
  } catch {
    return { provider: "lovable", fromEmail: null, fromName: "The Wedding Wardrobe" };
  }
}

/** Which routes are ready to send right now, for the host's Email tab. */
export function providerReadiness() {
  const lovableDomain =
    process.env["LOVABLE_EMAIL_SENDER_DOMAIN"] ?? process.env["EMAIL_SENDER_DOMAIN"] ?? null;
  return {
    lovable: Boolean(lovableDomain && process.env["LOVABLE_API_KEY"]),
    lovableDomain,
    resend: Boolean(process.env[PROVIDER_KEYS.resend]),
    sendgrid: Boolean(process.env[PROVIDER_KEYS.sendgrid]),
    brevo: Boolean(process.env[PROVIDER_KEYS.brevo]),
  };
}

function textFrom(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<SendResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`Guest email failed [${res.status}]: ${detail.slice(0, 500)}`);
      return { sent: false, reason: `provider_error_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("Guest email threw", err);
    return { sent: false, reason: "network_error" };
  }
}

export async function sendGuestEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const settings = await readEmailSettings();
  const ready = providerReadiness();
  const { to, subject, html } = options;

  if (settings.provider === "none") return { sent: false, reason: "email_turned_off" };

  if (settings.provider === "lovable") {
    if (!ready.lovable) return { sent: false, reason: "lovable_domain_not_set_up" };
    const from = settings.fromEmail ?? `invitations@${ready.lovableDomain}`;
    return post(
      "https://api.lovable.dev/v1/email/send",
      { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}` },
      {
        from,
        sender_domain: ready.lovableDomain,
        to,
        subject,
        html,
        text: textFrom(html),
        purpose: "transactional",
        label: "wedding-wardrobe",
      },
    );
  }

  const fromEmail = settings.fromEmail;
  if (!fromEmail) return { sent: false, reason: "from_address_missing" };
  const fromHeader = `${settings.fromName} <${fromEmail}>`;

  if (settings.provider === "resend") {
    const key = process.env[PROVIDER_KEYS.resend];
    if (!key) return { sent: false, reason: "api_key_missing" };
    return post(
      "https://api.resend.com/emails",
      { Authorization: `Bearer ${key}` },
      { from: fromHeader, to: [to], subject, html },
    );
  }

  if (settings.provider === "sendgrid") {
    const key = process.env[PROVIDER_KEYS.sendgrid];
    if (!key) return { sent: false, reason: "api_key_missing" };
    return post(
      "https://api.sendgrid.com/v3/mail/send",
      { Authorization: `Bearer ${key}` },
      {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: settings.fromName },
        subject,
        content: [{ type: "text/html", value: html }],
      },
    );
  }

  if (settings.provider === "brevo") {
    const key = process.env[PROVIDER_KEYS.brevo];
    if (!key) return { sent: false, reason: "api_key_missing" };
    return post(
      "https://api.brevo.com/v3/smtp/email",
      { "api-key": key },
      {
        sender: { email: fromEmail, name: settings.fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
    );
  }

  return { sent: false, reason: "email_not_configured" };
}
