import type { ComponentProps, ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

export interface IFormTextareaProps extends Omit<
  ComponentProps<"textarea">,
  "name" | "ref"
> {
  label?: ReactNode;
  registration?: UseFormRegisterReturn;
  error?: string | undefined;
  hint?: ReactNode;
  containerClassName?: string;
}
