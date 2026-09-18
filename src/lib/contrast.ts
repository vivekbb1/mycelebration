import type { Branding } from "@/lib/branding";

type Draft = Omit<Branding, "id">;

/** Turns #abc or #aabbcc into 0–255 channels; falls back to white on nonsense. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [255, 255, 255];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: [number, number, number]) {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours: 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

function mix(hex: string, towards: [number, number, number], amount: number) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([
    r + (towards[0] - r) * amount,
    g + (towards[1] - g) * amount,
    b + (towards[2] - b) * amount,
  ]);
}

/**
 * Nudges `colour` darker or lighter (whichever direction helps) until it reads
 * clearly against `against`, keeping as much of the original hue as possible.
 */
export function suggestReadable(colour: string, against: string, target: number) {
  const towards: [number, number, number] =
    luminance(against) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(colour, towards, step / 20);
    if (contrastRatio(candidate, against) >= target) return candidate;
  }
  return rgbToHex(towards);
}

export type ContrastIssue = {
  key: keyof Draft;
  label: string;
  /** What it sits on. */
  onLabel: string;
  ratio: number;
  target: number;
  suggestion: string;
  large: boolean;
};

type Pair = {
  key: keyof Draft;
  against: keyof Draft;
  label: string;
  onLabel: string;
  /** Large text (headings, big numbers) passes at 3:1; normal text needs 4.5:1. */
  large?: boolean;
};

const PAIRS: Pair[] = [
  { key: "color_foreground", against: "color_background", label: "Text", onLabel: "the page" },
  { key: "color_foreground", against: "color_surface", label: "Text", onLabel: "cards" },
  {
    key: "color_primary_foreground",
    against: "color_primary",
    label: "Text on buttons",
    onLabel: "the accent colour",
  },
  {
    key: "color_primary",
    against: "color_background",
    label: "Accent",
    onLabel: "the page",
    large: true,
  },
  {
    key: "color_primary",
    against: "color_surface",
    label: "Accent",
    onLabel: "cards",
    large: true,
  },
  {
    key: "color_accent",
    against: "color_surface",
    label: "Second accent",
    onLabel: "cards",
    large: true,
  },
  {
    key: "color_border",
    against: "color_surface",
    label: "Lines",
    onLabel: "cards",
    large: true,
  },
];

/** Every colour pairing that would be hard to read, worst first. */
export function findContrastIssues(draft: Draft): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  for (const p of PAIRS) {
    const colour = String(draft[p.key] ?? "");
    const against = String(draft[p.against] ?? "");
    if (!colour || !against) continue;
    const target = p.large ? 3 : 4.5;
    const ratio = contrastRatio(colour, against);
    if (ratio + 0.005 < target) {
      issues.push({
        key: p.key,
        label: p.label,
        onLabel: p.onLabel,
        ratio,
        target,
        large: !!p.large,
        suggestion: suggestReadable(colour, against, target),
      });
    }
  }
  return issues.sort((a, b) => a.ratio - b.ratio);
}
