/** Tags are kept as a comma list on each guest and shown as hashtags. */
export function splitTags(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((t) => t.trim().replace(/^#+/, "").toLowerCase())
    .filter(Boolean);
}

/** Tidy one typed tag: no hash, no double spaces, lower case, 40 characters. */
export function normaliseTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase().slice(0, 40);
}
