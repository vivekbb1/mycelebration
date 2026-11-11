import { describe, expect, it } from "vitest";
import { validateOutfitJpeg } from "../src/lib/outfit-photo";

describe("custom outfit JPG photos", () => {
  it("accepts JPG image bytes", () => {
    expect(() => validateOutfitJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).not.toThrow();
  });
  it("rejects other content renamed as a JPG", () => {
    expect(() => validateOutfitJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow("valid JPG");
  });
  it("rejects photos above the upload limit", () => {
    const bytes = new Uint8Array(5 * 1024 * 1024 + 1);
    bytes.set([0xff, 0xd8, 0xff]);
    expect(() => validateOutfitJpeg(bytes)).toThrow("5 MB");
  });
});