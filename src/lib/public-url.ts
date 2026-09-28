// The public address guests are sent to. Links in emails and copied invite
// links always use this, so nobody receives a preview address.
export const PUBLIC_ORIGIN = "https://mycelebration.app";

/** Sign-in link carrying the invitation code and the celebration's web address. */
export function authLink(code: string, slug?: string | null): string {
  const params = new URLSearchParams({ code });
  if (slug) params.set("c", slug);
  return `${PUBLIC_ORIGIN}/auth?${params.toString()}`;
}
