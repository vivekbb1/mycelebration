/**
 * Keeps our own copy of outfit photos so the lookbook never depends on the
 * shop's website. Files live in the private "outfit-images" bucket and are
 * served through /api/public/outfit-image/<path>.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const OWN_IMAGE_PREFIX = "/api/public/outfit-image/";

export async function copyImages(key: string, urls: string[], max = 6): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const safeKey = (key || crypto.randomUUID()).replace(/[^a-z0-9\-_]/gi, "").slice(0, 60) || crypto.randomUUID();
  const out: string[] = [];
  for (const [i, url] of urls.slice(0, max).entries()) {
    if (url.startsWith(OWN_IMAGE_PREFIX)) {
      out.push(url);
      continue;
    }
    try {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      const type = res.headers.get("content-type") ?? "image/jpeg";
      if (!res.ok || !type.startsWith("image/")) throw new Error("bad image");
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const path = `${safeKey}/${i}.${ext}`;
      const { error } = await supabaseAdmin.storage
        .from("outfit-images")
        .upload(path, await res.arrayBuffer(), { contentType: type, upsert: true });
      if (error) throw error;
      out.push(`${OWN_IMAGE_PREFIX}${path}`);
    } catch {
      out.push(url); // keep the original if the copy fails
    }
  }
  return out;
}
