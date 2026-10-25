/** One shared, case-insensitive search for both Arrivals views. */
export function matchesArrivalSearch(query: string, fields: (string | null | undefined)[]): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || fields.some((value) => value?.toLowerCase().includes(needle));
}