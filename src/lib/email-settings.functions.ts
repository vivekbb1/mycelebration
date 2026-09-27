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

const inviteSchema = z.object({ inviteId: z.string().uuid() });

const saveSchema = inviteSchema.extend({
  provider: z.enum(["lovable", "resend", "sendgrid", "brevo", "none"]),
  fromEmail: z.string().trim().max(255).optional().or(z.literal("")),
  fromName: z.string().trim().max(100).optional().or(z.literal("")),
});

async function isHostOf(context: { supabase: any }, inviteId: string) {
  const { data } = await context.supabase.rpc("is_celebration_host", { _invite_id: inviteId });
  return Boolean(data);
}

async function view(inviteId: string): Promise<EmailSettingsView> {
  const { readEmailSettings, providerReadiness } = await import("@/lib/email.server");
  const settings = await readEmailSettings(inviteId);
  return {
    ok: true,
    provider: settings.provider,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    ready: providerReadiness(),
  };
}

/** This celebration's sending route plus which routes are ready to send. */
export const getEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }): Promise<EmailSettingsView> => {
    if (!(await isHostOf(context, data.inviteId))) return { ok: false, error: "Hosts only." };
    return view(data.inviteId);
  });

/** Saves this celebration's sending route and sender name/address. */
export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }): Promise<EmailSettingsView> => {
    if (!(await isHostOf(context, data.inviteId))) return { ok: false, error: "Hosts only." };
    const email = (data.fromEmail ?? "").trim();
    if (email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
      return { ok: false, error: "That sender address doesn't look right." };
    }
    // Runs as the host, so the access rules keep it to their own celebration.
    const { error } = await context.supabase.from("celebration_email_settings").upsert({
      invite_id: data.inviteId,
      provider: data.provider,
      from_email: email || null,
      from_name: (data.fromName ?? "").trim() || "My Celebration",
    });
    if (error) return { ok: false, error: error.message };
    return view(data.inviteId);
  });

/** Sends a test email through this celebration's route. */
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    inviteSchema.extend({ to: z.string().trim().email().max(255) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; sent?: boolean; reason?: string; error?: string }> => {
    if (!(await isHostOf(context, data.inviteId))) return { ok: false, error: "Hosts only." };
    const { sendGuestEmail, emailShell } = await import("@/lib/email.server");
    const result = await sendGuestEmail({
      inviteId: data.inviteId,
      to: data.to,
      subject: "Test note from My Celebration",
      html: emailShell(
        `<div style="padding:28px"><h2 style="margin:0 0 12px">It works</h2>
         <p style="margin:0">If you can read this, invitations and confirmations will reach your guests.</p></div>`,
      ),
    });
    return { ok: true, ...result };
  });
