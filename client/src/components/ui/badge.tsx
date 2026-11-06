import * as React from "react";
import { cn } from "@/lib/utils";

/** A status pill. `tone` comes from lib/format#statusTone so every surface agrees. */
export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & { tone?: string }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        tone ?? "bg-secondary text-secondary-foreground ring-border",
        className,
      )}
      {...props}
    />
  );
}
