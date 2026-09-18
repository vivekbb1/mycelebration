import { supabase } from "@/integrations/supabase/client";

/**
 * Shared records (wording, branding, the schedule, the delivery plan) are edited by
 * several hosts at once. Every save carries the timestamp of the copy the host is
 * looking at; if the row moved on in the meantime nothing is written and the host is
 * told to refresh, so one host's save can never quietly wipe another's.
 */
export class StaleSaveError extends Error {
  constructor(what: string) {
    super(`Someone else updated ${what} while you were editing. Refresh to see their version, then save again.`);
    this.name = "StaleSaveError";
  }
}

type Table = "branding" | "branding_presets" | "events" | "logistics" | "site_content" | "invites";

/**
 * Updates one row only when its updated_at still matches what the editor loaded.
 * `expected` of null/undefined means "the row had no timestamp" and skips the check.
 */
export async function guardedUpdate(opts: {
  table: Table;
  /** Column that identifies the row — "id" for most, "key" for wording. */
  idColumn: string;
  id: string;
  expectedUpdatedAt: string | null | undefined;
  patch: Record<string, unknown>;
  /** Plain-language name of the thing, used in the clash message. */
  label: string;
}): Promise<void> {
  const { table, idColumn, id, expectedUpdatedAt, patch, label } = opts;
  let q = supabase
    .from(table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ ...patch, updated_at: new Date().toISOString() } as any)
    .eq(idColumn, id);
  if (expectedUpdatedAt) q = q.eq("updated_at", expectedUpdatedAt);

  const { data, error } = await q.select(idColumn);
  if (error) throw error;
  if (!data || data.length === 0) throw new StaleSaveError(label);
}
