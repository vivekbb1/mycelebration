/** Web-address names that already belong to a page, so a celebration can't take them. */
export const RESERVED_SLUGS = new Set([
  "auth",
  "host",
  "hosts",
  "platform",
  "upgrade",
  "plan",
  "pay",
  "portal",
  "invite",
  "invitation",
  "schedule",
  "event",
  "outfits",
  "lookbook",
  "measurements",
  "summary",
  "confirm",
  "delivery",
  "atelier",
  "guest",
  "guests",
  "family",
  "api",
  "assets",
  "static",
  "favicon",
  "robots",
  "sitemap",
]);

/** Turn any name into a tidy web address: lower case, letters, numbers and dashes. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Plain-English reason the address can't be used, or null when it's fine. */
export function slugProblem(slug: string): string | null {
  if (slug.length < 3) return "Use at least 3 letters or numbers.";
  if (RESERVED_SLUGS.has(slug)) return "That name is already used by another page here.";
  return null;
}
