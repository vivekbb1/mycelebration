import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const LEVELS = ["L", "M", "Q", "H"] as const;

type Opts = {
  link: string;
  dark: string;
  light: string;
  clear: boolean;
  margin: number;
  level: (typeof LEVELS)[number];
  rounding: number; // 0..100
  logo: HTMLImageElement | null;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: number) {
  ctx.beginPath();
  if (r <= 0) ctx.rect(x, y, s, s);
  else ctx.roundRect(x, y, s, s, r);
  ctx.fill();
}

function render(width: number, o: Opts): string {
  const qr = QRCode.create(o.link, { errorCorrectionLevel: o.logo ? "H" : o.level });
  const n = qr.modules.size;
  const total = n + o.margin * 2;
  const cell = width / total;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = width;
  const ctx = canvas.getContext("2d")!;
  if (!o.clear) {
    ctx.fillStyle = o.light;
    ctx.fillRect(0, 0, width, width);
  }
  // logo hole, in modules
  const hole = o.logo ? Math.ceil(n * 0.22) | 1 : 0;
  const hs = Math.floor((n - hole) / 2);
  const inHole = (r: number, c: number) => hole > 0 && r >= hs - 1 && r < hs + hole + 1 && c >= hs - 1 && c < hs + hole + 1;

  ctx.fillStyle = o.dark;
  const radius = (cell / 2) * (o.rounding / 100);
  const pad = o.rounding > 0 ? cell * 0.04 : 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || inHole(r, c)) continue;
      roundRect(ctx, (c + o.margin) * cell + pad, (r + o.margin) * cell + pad, cell - pad * 2, radius);
    }
  }
  if (o.logo) {
    const size = hole * cell;
    const x = (hs + o.margin) * cell;
    const img = o.logo;
    const scale = Math.min(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, x + (size - w) / 2, x + (size - h) / 2, w, h);
  }
  return canvas.toDataURL("image/png");
}

export function CelebrationQr({ link, name }: { link: string; name: string }) {
  const [dark, setDark] = useState("#1f1a14");
  const [light, setLight] = useState("#ffffff");
  const [clear, setClear] = useState(true);
  const [margin, setMargin] = useState(2);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("M");
  const [rounding, setRounding] = useState(0);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState("");

  const opts: Opts = { link, dark, light, clear, margin, level, rounding, logo };

  useEffect(() => {
    try {
      setPreview(render(480, opts));
    } catch {
      setPreview("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, dark, light, clear, margin, level, rounding, logo]);

  const pickLogo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setLogo(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const download = (width: number, label: string) => {
    const a = document.createElement("a");
    a.href = render(width, opts);
    a.download = `${name || "celebration"}-qr-${label}.png`;
    a.click();
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium">QR code for this page</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        {preview ? (
          <img src={preview} alt="QR code" className="size-40 shrink-0 rounded border border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]" />
        ) : null}
        <div className="grid flex-1 grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Code colour
            <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="h-9 w-full" />
          </label>
          <label className="flex flex-col gap-1">
            Background
            <input type="color" value={light} disabled={clear} onChange={(e) => setLight(e.target.value)} className="h-9 w-full disabled:opacity-40" />
            <span className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} /> Transparent
            </span>
          </label>
          <label className="flex flex-col gap-1">
            Border
            <input type="range" min={0} max={8} value={margin} onChange={(e) => setMargin(+e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            Rounding
            <input type="range" min={0} max={100} step={10} value={rounding} onChange={(e) => setRounding(+e.target.value)} />
            <span className="text-xs text-muted-foreground">{rounding === 0 ? "Square" : rounding === 100 ? "Dots" : "Rounded"}</span>
          </label>
          <label className="flex flex-col gap-1">
            Sturdiness
            <select
              value={logo ? "H" : level}
              disabled={!!logo}
              onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])}
              className="h-9 rounded-md border border-input bg-background px-2 disabled:opacity-60"
            >
              <option value="L">Light</option>
              <option value="M">Standard</option>
              <option value="Q">Strong</option>
              <option value="H">Strongest (for print)</option>
            </select>
            {logo ? <span className="text-xs text-muted-foreground">Set to strongest so it scans with a logo</span> : null}
          </label>
          <div className="flex flex-col gap-1">
            Logo in the middle
            {logo ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setLogo(null)}>
                <X className="mr-1.5 size-3.5" /> Remove logo
              </Button>
            ) : (
              <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input px-3 text-xs hover:bg-muted">
                <ImagePlus className="mr-1.5 size-3.5" /> Upload logo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => download(2048, "hi-res")}>
          <Download className="mr-1.5 size-3.5" /> High-res PNG (print)
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => download(512, "lo-res")}>
          <Download className="mr-1.5 size-3.5" /> Low-res PNG (screen)
        </Button>
      </div>
    </div>
  );
}
