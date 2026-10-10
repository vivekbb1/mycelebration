import { createFileRoute } from "@tanstack/react-router";

/** Nightly shop stock refresh, woken by the database scheduler. */
export const Route = createFileRoute("/api/public/stock-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkWorkerKey } = await import("@/lib/outfit-import.server");
        if (!(await checkWorkerKey(request.headers.get("x-worker-key")))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runStockRefresh } = await import("@/lib/stock-refresh.server");
        return Response.json(await runStockRefresh());
      },
    },
  },
});
