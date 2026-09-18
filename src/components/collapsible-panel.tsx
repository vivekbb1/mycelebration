import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";

/**
 * A panel that folds away on a phone and stays open on a laptop, so long host
 * forms don't push the lists they belong to off the screen.
 */
export function CollapsiblePanel({
  title,
  subtitle,
  children,
  className = "",
  defaultOpen,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean | undefined;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? defaultOpen ?? !isMobile;

  return (
    <section className={`panel h-fit p-4 sm:p-6 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!shown)}
        aria-expanded={shown}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left md:cursor-default"
      >
        <span className="min-w-0">
          <span className="block truncate text-lg sm:text-xl">{title}</span>
          {subtitle ? (
            <span className="mt-1 block text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform md:hidden ${
            shown ? "rotate-180" : ""
          }`}
        />
      </button>
      {shown ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
