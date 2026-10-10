import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SizeGuideDialog } from "@/components/size-guide-dialog";
import { checkOutfitSizes } from "@/lib/outfit-sizes.functions";
import { formFor, hasChart, MADE_TO_MEASURE, STANDARD_SIZES, suggestSize, type ShopSize } from "@/lib/size-charts";

type Measure = Record<string, unknown> | null | undefined;

/** Lets a guest pick a size (or Made to measure) before reserving a look. */
export function SizePickDialog({
  outfit,
  gender,
  person,
  measure,
  onCancel,
  onConfirm,
}: {
  outfit: { id: string; title: string; sizes?: unknown } | null;
  gender: string | null;
  person: string;
  measure: Measure;
  onCancel: () => void;
  onConfirm: (size: string) => Promise<void> | void;
}) {
  const check = useServerFn(checkOutfitSizes);
  const navigate = useNavigate();
  const [sizes, setSizes] = useState<ShopSize[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  const form = formFor(gender);
  const chart = hasChart(gender);
  const suggestion = chart ? suggestSize(measure as never, form) : null;
  const usual = (measure?.["usual_size"] as string | null) ?? null;
  const hasMeasurements = Boolean(
    measure && ["bust", "chest", "waist", "hip", "height"].some((k) => measure[k] != null),
  );

  useEffect(() => {
    if (!outfit) return;
    setSizes((outfit.sizes as ShopSize[] | null) ?? null);
    setChoice(null);
    setWarn(null);
    setLoading(true);
    check({ data: { outfitId: outfit.id } })
      .then((r) => setSizes(r.sizes ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [outfit?.id]);

  const list: ShopSize[] = chart
    ? (sizes && sizes.length ? sizes : STANDARD_SIZES.map((label) => ({ label, available: true })))
    : [];
  const preferred = suggestion?.size ?? usual;

  useEffect(() => {
    if (choice || !list.length) return;
    const p = list.find((s) => s.label === preferred && s.available);
    if (p) setChoice(p.label);
  }, [list.length, preferred]);

  const confirm = async () => {
    if (!outfit || !choice) return;
    setBusy(true);
    setWarn(null);
    if (choice !== MADE_TO_MEASURE) {
      try {
        const r = await check({ data: { outfitId: outfit.id } });
        if (r.sizes) {
          setSizes(r.sizes);
          const s = r.sizes.find((x) => x.label === choice);
          if (s && !s.available) {
            setBusy(false);
            setWarn(`${choice} has just sold out. Choose another size or Made to measure.`);
            setChoice(null);
            return;
          }
        }
      } catch {
        /* shop unreachable — go ahead with the saved list */
      }
    }
    await onConfirm(choice);
    setBusy(false);
    // Made to measure can't be tailored without numbers — take them straight to the form.
    if (choice === MADE_TO_MEASURE && !hasMeasurements) navigate({ to: "/guest/measurements" });
  };

  return (
    <Dialog open={outfit !== null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a size for {person}</DialogTitle>
          <DialogDescription className="line-clamp-2">{outfit?.title}</DialogDescription>
        </DialogHeader>

        {chart ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {suggestion
                ? <>Suggested for {person}: <span className="font-medium text-foreground">{suggestion.size}</span>{suggestion.between ? " (between sizes — we picked the larger)" : ""}</>
                : usual ? <>Usual size: <span className="font-medium text-foreground">{usual}</span></> : "Pick the size you normally wear."}
            </p>
            <SizeGuideDialog form={form} suggested={suggestion?.size ?? usual} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Children's looks are made to measure.</p>
        )}

        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Checking stock with the shop…</p>
        ) : null}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {list.map((s) => {
            const on = choice === s.label;
            return (
              <button
                key={s.label}
                type="button"
                disabled={!s.available}
                onClick={() => setChoice(s.label)}
                className={`rounded-md border px-2 py-2 text-sm transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground"
                    : s.available ? "border-border hover:border-primary" : "cursor-not-allowed border-border text-muted-foreground line-through opacity-50"
                }`}
              >
                <span className="block font-medium">{s.label}{s.label === preferred && s.available ? " ★" : ""}</span>
                <span className="block text-[10px] opacity-80">
                  {!s.available ? "Sold out" : s.ready_to_ship ? "In stock" : s.ships_by ? `Made to order · by ${s.ships_by}` : sizes ? "Available" : ""}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setChoice(MADE_TO_MEASURE)}
            className={`col-span-3 rounded-md border px-2 py-2 text-sm sm:col-span-4 ${
              choice === MADE_TO_MEASURE ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
            }`}
          >
            Made to measure
          </button>
        </div>

        {warn ? <p className="text-sm text-destructive">{warn}</p> : null}
        {!hasMeasurements ? (
          <p className="rounded-md bg-secondary p-3 text-xs">
            {choice === MADE_TO_MEASURE
              ? `Made to measure needs ${person}'s measurements. After reserving, we'll take you to the measurements form.`
              : `Add ${person}'s measurements so we can check the fit.`}{" "}
            <Link to="/guest/measurements" className="underline">Add measurements</Link>
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={confirm} disabled={!choice || busy}>{busy ? "Reserving…" : choice === MADE_TO_MEASURE && !hasMeasurements ? "Reserve & add measurements" : "Reserve"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
