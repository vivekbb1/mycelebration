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
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, error: "Only a host can do this." };

    const { runFollowUpReminders } = await import("./followup-reminders.server");
    try {
      const run = await runFollowUpReminders();
      return { ok: true, ...run };
    } catch (err) {
      console.error("Follow-up reminders failed", err);
      return { ok: false, error: "The reminders could not be sent just now." };
    }
  });
