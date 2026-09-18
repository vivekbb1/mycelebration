import { createFileRoute } from "@tanstack/react-router";

/**
 * Called on a schedule (daily) to email hosts about guest follow-ups that are
 * due, near or overdue. Requires the shared reminder secret.
 */
export const Route = createFileRoute("/api/public/followup-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["FOLLOWUP_CRON_SECRET"];
        const provided =
          request.headers.get("x-followup-secret") ??
          new URL(request.url).searchParams.get("secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runFollowUpReminders } = await import("@/lib/followup-reminders.server");
        const result = await runFollowUpReminders();
        return Response.json(result);
      },
    },
  },
});
