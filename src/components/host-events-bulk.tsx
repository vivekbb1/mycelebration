import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Field = "rsvp_by" | "outfit_choose_by" | "outfit_ready_by" | "dress_code" | "venue";
type Selection = "keep" | "on" | "off";

/** Applies the same dates or details to several events at once. Blank boxes are left as they are. */
export function HostEventsBulk({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<Field, string>>({
    rsvp_by: "",
    outfit_choose_by: "",
    outfit_ready_by: "",
    dress_code: "",
    venue: "",
  });
  const [selection, setSelection] = useState<Selection>("keep");
  const [busy, setBusy] = useState(false);
  const [clearOutfitDates, setClearOutfitDates] = useState(false);

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const apply = async () => {
    const patch: Record<string, unknown> = {};
    (Object.keys(values) as Field[]).forEach((k) => {
      const v = values[k].trim();
      if (v) patch[k] = v;
    });
    if (clearOutfitDates) {
      patch["outfit_choose_by"] = null;
      patch["outfit_ready_by"] = null;
    }
    if (selection !== "keep") patch["outfit_selection"] = selection === "on";
    if (Object.keys(patch).length === 0) {
      toast.error("Fill in at least one box to change.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("events")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .in("id", ids);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} event${ids.length === 1 ? "" : "s"} updated.`);
    await queryClient.invalidateQueries({ queryKey: ["events"] });
    onDone();
  };

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 sm:p-4">
      <p className="text-sm">
        Change {ids.length} selected event{ids.length === 1 ? "" : "s"}
        <span className="block text-xs text-muted-foreground">
          Only boxes you fill in are changed.
        </span>
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="b-rsvp">RSVP by</Label>
          <Input id="b-rsvp" type="date" value={values.rsvp_by} onChange={set("rsvp_by")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="b-choose">Choose looks by</Label>
          <Input
            id="b-choose"
            type="date"
            value={values.outfit_choose_by}
            onChange={set("outfit_choose_by")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="b-ready">Outfit ready by</Label>
          <Input
            id="b-ready"
            type="date"
            value={values.outfit_ready_by}
            onChange={set("outfit_ready_by")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="b-sel">Guests choose an outfit</Label>
          <select
            id="b-sel"
            value={selection}
            onChange={(e) => setSelection(e.target.value as Selection)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="keep">Leave as is</option>
            <option value="on">Yes</option>
            <option value="off">No, own outfit</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="b-dress">Dress code</Label>
          <Input id="b-dress" maxLength={200} value={values.dress_code} onChange={set("dress_code")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="b-venue">Venue</Label>
          <Input id="b-venue" maxLength={160} value={values.venue} onChange={set("venue")} />
        </div>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={clearOutfitDates}
          onChange={(e) => setClearOutfitDates(e.target.checked)}
        />
        <span>
          Clear "Choose looks by" and "Outfit ready by" dates
          <span className="block text-xs text-muted-foreground">
            Useful for events where guests wear their own outfit.
          </span>
        </span>
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button onClick={apply} disabled={busy} className="sm:flex-1">
          {busy ? "Saving…" : "Apply to selected"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
