import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertHost(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_any_host");
  if (!data) throw new Error("Forbidden");
}

/** Queues looks to be added in the background. */
export const startOutfitImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { slugs: string[]; eventId?: string | null; boutiqueId?: string | null; gender?: string | null }) => ({
      slugs: [...new Set((Array.isArray(data?.slugs) ? data.slugs : []).map(String))].slice(0, 2000),
      eventId: data?.eventId ? String(data.eventId) : null,
      boutiqueId: data?.boutiqueId ? String(data.boutiqueId) : null,
      gender: ["men", "women", "unisex", "kids"].includes(String(data?.gender)) ? String(data?.gender) : null,
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertHost(ctx);
    if (!data.slugs.length) throw new Error("Nothing selected");
    const { data: job, error } = await ctx.supabase
      .from("outfit_import_jobs")
      .insert({
        created_by: ctx.userId,
        event_id: data.eventId,
        boutique_id: data.boutiqueId,
        gender: data.gender,
        total: data.slugs.length,
      })
      .select("id")
      .single();
    if (error) throw new Error("Couldn't start the import");
    for (let i = 0; i < data.slugs.length; i += 500) {
      const rows = data.slugs.slice(i, i + 500).map((slug) => ({ job_id: job.id, slug }));
      const { error: e } = await ctx.supabase.from("outfit_import_items").insert(rows);
      if (e) throw new Error("Couldn't queue the looks");
    }
    const { wakeWorker, workerBase } = await import("@/lib/outfit-import.server");
    const origin = new URL(getRequest().url).origin;
    await wakeWorker(workerBase(origin));
    return { id: job.id as string, total: data.slugs.length };
  });

/** Recent background imports, newest first. */
export const listOutfitImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await assertHost(ctx);
    const { data } = await ctx.supabase
      .from("outfit_import_jobs")
      .select("id,total,imported,skipped,failed,status,created_at,finished_at")
      .order("created_at", { ascending: false })
      .limit(5);
    return (data ?? []) as Array<{
      id: string;
      total: number;
      imported: number;
      skipped: number;
      failed: number;
      status: string;
      created_at: string;
      finished_at: string | null;
    }>;
  });

/** Stops a running import; looks already added stay. */
export const cancelOutfitImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertHost(ctx);
    await ctx.supabase
      .from("outfit_import_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });
