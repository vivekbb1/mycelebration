import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eraser } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Host action: delete one guest's measurement set so they can start again. */
export function ClearMeasurementsButton({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    if (!window.confirm(`Clear all measurements for ${name}? They'll need to enter them again.`)) return;
    setBusy(true);
    const { error, count } = await supabase.from("measurements").delete({ count: "exact" }).eq("id", id);
    setBusy(false);
    if (error || count === 0) {
      toast.error("Couldn't clear these measurements.");
      return;
    }
    toast.success(`Measurements cleared for ${name}.`);
    for (const key of ["all-measurements", "family-measurements", "guest-measurements"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  return (
    <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={busy} className="h-8 shrink-0 gap-1.5 text-xs">
      <Eraser className="size-3.5" />
      {busy ? "Clearing…" : "Clear"}
    </Button>
  );
}
