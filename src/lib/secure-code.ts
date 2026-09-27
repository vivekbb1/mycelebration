const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Unguessable code characters from the browser/server crypto source. */
export function randomCode(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
