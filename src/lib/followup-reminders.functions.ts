import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReminderResult = {
  ok: boolean;
  error?: string;
  due?: number;
  hosts?: number;
  sent?: number;
  skipped?: string[];
};

/** Lets a host send the follow-up reminder emails right away. */
export const sendFollowUpReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReminderResult> => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin");
    if (isAdmin !== true) return { ok: false, error: "Only the platform team can send every reminder at once." };

    const { runFollowUpReminders } = await import("./followup-reminders.server");
    try {
      const run = await runFollowUpReminders();
      return { ok: true, ...run };
    } catch (err) {
      console.error("Follow-up reminders failed", err);
      return { ok: false, error: "The reminders could not be sent just now." };
    }
  });
