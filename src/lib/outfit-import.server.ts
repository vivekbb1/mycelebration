/**
 * Background wardrobe import. Looks are queued in the database and a worker
 * adds them one by one; each run wakes the next from inside the database, so
 * the host can close the browser.
 */
import { HOST, detail, slugFromUrl } from "@/lib/pernia.functions";

const BUDGET_MS = 25_000;

/** Public preview pages sit behind sign-in, so use the stable preview address. */
export function workerBase(origin: string) {
  if (/id-preview--|localhost|127\.0\.0\.1/.test(origin)) {
    return "https://project--27eb28b6-5e52-4115-8de4-83dd0945252f-dev.lovable.app";
  }
  return origin.replace(/\/+$/, "");
}

export async function wakeWorker(base: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).rpc("wake_outfit_import_worker", { _base_url: base });
}

export async function checkWorkerKey(provided: string | null) {
  if (!provided) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("import_worker_key").select("token").eq("id", 1).maybeSingle();
  return Boolean(data?.token) && data.token === provided;
}

async function bump(db: any, jobId: string, field: "imported" | "skipped" | "failed") {
  const { data: job } = await db.from("outfit_import_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return;
  const next = { [field]: (job[field] ?? 0) + 1 } as Record<string, unknown>;
  const done = job.imported + job.skipped + job.failed + 1 >= job.total;
  if (done) {
    next['status'] = "done";
    next['finished_at'] = new Date().toISOString();
  }
  await db.from("outfit_import_jobs").update(next).eq("id", jobId);
}

async function importOne(db: any, job: any, rawSlug: string): Promise<"imported" | "skipped" | "failed"> {
  let slug: string;
  try {
    slug = slugFromUrl(rawSlug);
  } catch {
    return "failed";
  }
  const { data: dup } = await db.from("outfits").select("id").eq("invite_id", job.invite_id).eq("boutique_url", `${HOST}/${slug}`).limit(1);
  if (dup?.length) return "skipped";
  let look;
  try {
    look = await detail(slug);
  } catch {
    return "failed";
  }
  if (look.sku) {
    const { data: dupSku } = await db.from("outfits").select("id").eq("invite_id", job.invite_id).eq("source_sku", look.sku).limit(1);
    if (dupSku?.length) return "skipped";
  }
  const { copyImages } = await import("@/lib/outfit-images.server");
  const images = await copyImages(look.sku || look.slug.replace(/\.html$/, ""), look.images);
  const { error } = await db.from("outfits").insert({
    title: look.title,
    designer: look.designer,
    boutique_url: look.url,
    image_url: images[0] ?? null,
    images,
    color_family: look.color,
    garment_type: look.garmentType,
    silhouette: look.silhouette,
    price_note: look.price ? `₹${look.price}` : null,
    price_inr: look.priceInr || null,
    source_sku: look.sku || null,
    gender: job.gender ?? look.gender,
    notes: look.description || null,
    event_id: job.event_id,
    boutique_id: job.boutique_id,
    invite_id: job.invite_id,
  });
  if (error) return error.code === "23505" ? "skipped" : "failed";
  return "imported";
}

/** Works through queued looks for about 25 seconds, then hands over. */
export async function runImportWorker(base: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < BUDGET_MS) {
    const { data: claimed } = await db.rpc("claim_outfit_import_item");
    const item = Array.isArray(claimed) ? claimed[0] : null;
    if (!item) break;
    const { data: job } = await db.from("outfit_import_jobs").select("*").eq("id", item.job_id).maybeSingle();
    let result: "imported" | "skipped" | "failed" = "failed";
    try {
      result = job ? await importOne(db, job, item.slug) : "failed";
    } catch {
      result = "failed";
    }
    await db.from("outfit_import_items").update({ status: result }).eq("id", item.item_id);
    await bump(db, item.job_id, result);
    processed += 1;
  }
  const { count } = await db
    .from("outfit_import_items")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending"]);
  if ((count ?? 0) > 0) await wakeWorker(base);
  return { processed, remaining: count ?? 0 };
}
