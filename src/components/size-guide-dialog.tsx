import { useState } from "react";
import { Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeasureDiagram, measurePoints } from "@/components/measure-diagram";
import { chartFor, fmtRange, HOW_TO, TIPS, type ChartForm } from "@/lib/size-charts";

export const MEASURE_LABEL: Record<string, string> = {
  height: "Height", bust: "Bust", under_bust: "Under-bust", chest: "Chest", neck: "Neck", waist: "Waist",
  hip: "Hip", shoulder: "Shoulder", sleeve_length: "Sleeve length", armhole: "Armhole",
  top_length: "Blouse / kurta length", bottom_length: "Skirt / trouser length", inseam: "Inseam",
};

export function SizeChartTable({ form, unit, highlight }: { form: ChartForm; unit: "cm" | "in"; highlight?: string | null }) {
  const rows = chartFor(form);
  const cols = form === "men" ? (["chest", "waist", "neck", "hip"] as const) : (["bust", "waist", "hip"] as const);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3">Size</th>
            {form === "women" ? <th className="py-2 pr-3">UK</th> : null}
            {cols.map((c) => <th key={c} className="py-2 pr-3">{MEASURE_LABEL[c]} ({unit})</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.size} className={`border-b border-border/60 ${highlight === row.size ? "bg-primary/10 font-medium" : ""}`}>
              <td className="py-1.5 pr-3">{row.size}</td>
              {form === "women" ? <td className="py-1.5 pr-3">{row.uk}</td> : null}
              {cols.map((c) => <td key={c} className="py-1.5 pr-3">{row[c] ? fmtRange(row[c]!, unit) : "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SizeGuideBody({ form, suggested, initialTab = "chart" }: { form: ChartForm; suggested?: string | null; initialTab?: string }) {
  const [unit, setUnit] = useState<"cm" | "in">("in");
  const pts = measurePoints(form);
  return (
    <Tabs defaultValue={initialTab}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="chart">Size chart</TabsTrigger>
        <TabsTrigger value="how">How to measure</TabsTrigger>
        <TabsTrigger value="tips">Tips</TabsTrigger>
      </TabsList>
      <TabsContent value="chart" className="space-y-3">
        <div className="flex gap-2">
          {(["in", "cm"] as const).map((u) => (
            <Button key={u} size="sm" variant={unit === u ? "default" : "outline"} onClick={() => setUnit(u)}>
              {u === "in" ? "Inches" : "Centimetres"}
            </Button>
          ))}
        </div>
        <SizeChartTable form={form} unit={unit} highlight={suggested} />
        <p className="text-xs text-muted-foreground">These are body measurements, not garment measurements.</p>
      </TabsContent>
      <TabsContent value="how" className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <MeasureDiagram form={form} />
        <ol className="space-y-2 text-sm">
          {pts.map((k, i) => (
            <li key={k}><span className="font-medium">{i + 1}. {MEASURE_LABEL[k]}:</span> <span className="text-muted-foreground">{HOW_TO[k]}</span></li>
          ))}
        </ol>
      </TabsContent>
      <TabsContent value="tips">
        <ul className="list-disc space-y-2 pl-5 text-sm">{TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
      </TabsContent>
    </Tabs>
  );
}

export function SizeGuideDialog({ form, suggested, label = "Size guide" }: { form: ChartForm; suggested?: string | null; label?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="h-auto gap-1 p-0"><Ruler className="size-4" /> {label}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Size guide — {form === "men" ? "Men" : "Women"}</DialogTitle></DialogHeader>
        <SizeGuideBody form={form} suggested={suggested} />
      </DialogContent>
    </Dialog>
  );
}
