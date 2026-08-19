import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Textarea = ({
  className,
  ...props
}: ComponentProps<"textarea">) => (
  <textarea
    data-slot="textarea"
    className={cn(
      "flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow]",
      "placeholder:text-muted-foreground",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-invalid:border-status-error aria-invalid:ring-status-error/25",
      className,
    )}
    {...props}
  />
);
