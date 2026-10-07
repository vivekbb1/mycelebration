import type { ChartForm } from "@/lib/size-charts";

/** Numbered measuring points on a simple figure. Order matches `measurePoints(form)`. */
export function measurePoints(form: ChartForm) {
  return form === "men"
    ? ["chest", "neck", "shoulder", "sleeve_length", "waist", "hip", "top_length", "bottom_length", "inseam", "height"]
    : ["bust", "under_bust", "shoulder", "sleeve_length", "armhole", "waist", "hip", "top_length", "bottom_length", "height"];
}

const POS: Record<string, [number, number]> = {
  neck: [100, 46], shoulder: [100, 62], bust: [100, 86], chest: [100, 86], under_bust: [100, 100],
  armhole: [66, 74], sleeve_length: [44, 112], waist: [100, 124], hip: [100, 152], top_length: [138, 110],
  bottom_length: [138, 200], inseam: [92, 210], height: [176, 150],
};

export function MeasureDiagram({ form, highlight }: { form: ChartForm; highlight?: string | null }) {
  const pts = measurePoints(form);
  return (
    <svg viewBox="0 0 200 300" className="mx-auto h-64 w-auto text-muted-foreground" role="img" aria-label="Where to measure">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="100" cy="26" r="14" />
        <path d="M92 40 v8 M108 40 v8" />
        <path d={form === "men"
          ? "M70 58 L130 58 L150 140 L140 142 L124 84 L124 160 L118 280 L104 280 L100 180 L96 280 L82 280 L76 160 L76 84 L60 142 L50 140 Z"
          : "M74 58 L126 58 L146 140 L136 142 L122 84 L118 124 L132 170 L126 280 L104 280 L100 190 L96 280 L74 280 L68 170 L82 124 L78 84 L64 142 L54 140 Z"} />
        <line x1="176" y1="12" x2="176" y2="282" strokeDasharray="3 3" />
      </g>
      {pts.map((key, i) => {
        const [x, y] = POS[key] ?? [100, 100];
        const on = highlight === key;
        return (
          <g key={key}>
            <circle cx={x} cy={y} r={on ? 10 : 8} className={on ? "fill-primary" : "fill-foreground"} />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" className="fill-background font-semibold">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
