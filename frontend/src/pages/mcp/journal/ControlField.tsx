import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface IControlFieldProps {
  label: string;
  /** Omitted for Radix controls, which carry an `aria-label` instead. */
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/** A labelled control in the journal's filter bar. */
export const ControlField = ({
  label,
  htmlFor,
  children,
  className,
}: IControlFieldProps) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-medium text-muted-foreground"
    >
      {label}
    </label>
    {children}
  </div>
);
