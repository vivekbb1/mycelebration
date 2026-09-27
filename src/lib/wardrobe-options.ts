/** The four wardrobes a guest can be dressed from. */
export const WARDROBES = [
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "boy", label: "Boy" },
  { value: "girl", label: "Girl" },
] as const;

export type WardrobeValue = (typeof WARDROBES)[number]["value"];

export const WARDROBE_VALUES: string[] = WARDROBES.map((w) => w.value);

export const isWardrobe = (v: unknown): v is WardrobeValue =>
  typeof v === "string" && WARDROBE_VALUES.includes(v);

export const wardrobeLabel = (v: string | null | undefined) =>
  WARDROBES.find((w) => w.value === v)?.label ?? (v === "kids" ? "Kids" : "Not set");
