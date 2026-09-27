import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

const LEVELS = ["L", "M", "Q", "H"] as const;

export function CelebrationQr({ link, name }: { link: string; name: string }) {
  const [dark, setDark] = useState("#1f1a14");
  const [light, setLight] = useState("#ffffff");
  const [margin, setMargin] = useState(2);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("M");
  const [preview, setPreview] = useState("");

  const opts = (width: number) => ({
    width,
    margin,
    errorCorrectionLevel: level,
    color: { dark, light },
  });

  useEffect(() => {
    QRCode.toDataURL(link, opts(240)).then(setPreview).catch(() => setPreview(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, dark, light, margin, level]);

  const download = async (width: number, label: string) => {
    const url = await QRCode.toDataURL(link, opts(width));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "celebration"}-qr-${label}.png`;
    a.click();
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium">QR code for this page</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        {preview ? (
          <img src={preview} alt="QR code" className="size-40 shrink-0 rounded border border-border" />
        ) : null}
        <div className="grid flex-1 grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Code colour
            <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="h-9 w-full" />
          </label>
          <label className="flex flex-col gap-1">
            Background
            <input type="color" value={light} onChange={(e) => setLight(e.target.value)} className="h-9 w-full" />
          </label>
          <label className="flex flex-col gap-1">
            Border
            <input type="range" min={0} max={8} value={margin} onChange={(e) => setMargin(+e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            Sturdiness
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])}
              className="h-9 rounded-md border border-input bg-background px-2"
            >
              <option value="L">Light</option>
              <option value="M">Standard</option>
              <option value="Q">Strong</option>
              <option value="H">Strongest (for print)</option>
            </select>
          </label>
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
