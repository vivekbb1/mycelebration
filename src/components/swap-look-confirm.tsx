import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Asks a guest whether to release their current look for an event and take a new one. */
export function useSwapLookConfirm() {
  const [text, setText] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback((message: string) => {
    setText(message);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setText(null);
  };

  const dialog = (
    <AlertDialog open={text !== null} onOpenChange={(o) => !o && finish(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Swap your look?</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>Keep current look</AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(true)}>Release and choose this one</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}
