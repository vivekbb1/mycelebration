export function validateOutfitJpeg(bytes: Uint8Array): void {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error("Choose a valid JPG photo.");
  }
  if (bytes.length > 5 * 1024 * 1024) throw new Error("Choose a JPG photo smaller than 5 MB.");
}