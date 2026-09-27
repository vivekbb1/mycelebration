import { createFileRoute } from "@tanstack/react-router";

/** Background wardrobe import worker, woken by the database. */
export const Route = createFileRoute("/api/public/outfit-import-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkWorkerKey, runImportWorker, workerBase } = await import("@/lib/outfit-import.server");
        if (!(await checkWorkerKey(request.headers.get("x-worker-key")))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const result = await runImportWorker(workerBase(new URL(request.url).origin));
        return Response.json(result);
      },
    },
  },
});
