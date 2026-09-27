import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmailSettingsView = {
  ok: boolean;
  error?: string;
  provider?: string;
  fromEmail?: string | null;
  fromName?: string;
  ready?: {
    lovable: boolean;
    lovableDomain: string | null;
    resend: boolean;
    sendgrid: boolean;
    brevo: boolean;
  };
};

const saveSchema = z.object({
  provider: z.enum(["lovable", "resend", "sendgrid", "brevo", "none"]),
  fromEmail: z.string().trim().max(255).optional().or(z.literal("")),
  fromName: z.string().trim().max(100).optional().or(z.literal("")),
});

async function assertHost(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}

/** Current sending route plus which routes are ready to send. */
export const getEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailSettingsView> => {
    if (!(await assertHost(context))) return { ok: false, error: "Hosts only." };
    const { readEmailSettings, providerReadiness } = await import("@/lib/email.server");
    const settings = await readEmailSettings();
    return {
      ok: true,
      provider: settings.provider,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      ready: providerReadiness(),
    };
  });

/** Saves the sending route and sender name/address. */
export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }): Promise<EmailSettingsView> => {
    if (!(await assertHost(context))) return { ok: false, error: "Hosts only." };
    const email = (data.fromEmail ?? "").trim();
    if (email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
      return { ok: false, error: "That sender address doesn't look right." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_settings").upsert({
      id: "default",
      provider: data.provider,
      from_email: email || null,
      from_name: (data.fromName ?? "").trim() || "My Celebration",
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };

    const { readEmailSettings, providerReadiness } = await import("@/lib/email.server");
    const settings = await readEmailSettings();
    return {
      ok: true,
      provider: settings.provider,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      ready: providerReadiness(),
    };
  });

/** Sends a test email to prove the chosen route works. */
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ to: z.string().trim().email().max(255) }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; sent?: boolean; reason?: string; error?: string }> => {
    if (!(await assertHost(context))) return { ok: false, error: "Hosts only." };
    const { sendGuestEmail, emailShell } = await import("@/lib/email.server");
    const result = await sendGuestEmail({
      to: data.to,
      subject: "Test note from the wedding wardrobe",
      html: emailShell(
        `<div style="padding:28px"><h2 style="margin:0 0 12px">It works</h2>
         <p style="margin:0">If you can read this, invitations and confirmations will reach your guests.</p></div>`,
      ),
    });
    return { ok: true, ...result };
  });
