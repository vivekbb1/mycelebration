import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PUBLIC_ORIGIN } from "@/lib/public-url";

/**
 * Welcome email after a new Google / Microsoft / Apple sign-up, pointing the
 * guest back to their celebration link. Only sent for accounts created in the
 * last 15 minutes, so returning guests aren't emailed again. Never throws.
 */
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug?: string | null }) => ({
    slug: d?.slug && /^[a-z0-9-]{1,80}$/i.test(d.slug) ? d.slug.toLowerCase() : null,
  }))
  .handler(async ({ data, context }) => {
    try {
      const { data: u } = await context.supabase.auth.getUser();
      const user = u.user;
      if (!user?.email) return { sent: false, reason: "no_email" };
      const age = Date.now() - new Date(user.created_at).getTime();
      if (age > 15 * 60 * 1000) return { sent: false, reason: "not_new" };

      let name = "your celebration";
      let link = `${PUBLIC_ORIGIN}/guest/invite`;
      if (data.slug) {
        const { data: c } = await context.supabase.rpc("celebration_by_slug", { _slug: data.slug });
        const row = (Array.isArray(c) ? c[0] : c) as { slug?: string; name?: string } | null;
        if (row?.slug) {
          name = row.name ?? name;
          link = `${PUBLIC_ORIGIN}/${row.slug}`;
        }
      }

      const { escapeHtml, emailShell, sendGuestEmail } = await import("@/lib/email.server");
      const first = String(user.user_metadata?.["full_name"] ?? "").split(" ")[0];
      const html = emailShell(`
        <h1 style="font-size:24px;margin:0 0 12px">You're signed up${first ? `, ${escapeHtml(first)}` : ""}</h1>
        <p>Your account for <strong>${escapeHtml(name)}</strong> is ready.</p>
        <p>Whenever you want to reply, choose your outfit or send measurements, come back through your celebration link and sign in the same way you just did.</p>
        <p style="margin:24px 0"><a href="${link}" style="background:#8a6a2f;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">Open ${escapeHtml(name)}</a></p>
        <p style="font-size:13px;color:#666">Or copy this link: ${link}</p>
      `);
      return await sendGuestEmail({ to: user.email, subject: `Welcome to ${name}`, html });
    } catch (err) {
      console.error("Welcome email failed", err);
      return { sent: false, reason: "error" };
    }
  });
