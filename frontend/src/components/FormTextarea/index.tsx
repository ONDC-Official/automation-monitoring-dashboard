import { useId } from "react";
import { Textarea } from "@/components/Textarea";
import type { IFormTextareaProps } from "@/components/FormTextarea/types";
import { cn } from "@/lib/utils";

export const FormTextarea = ({
  label,
  registration,
  error,
  hint,
  className,
  containerClassName,
  id,
  ...props
}: IFormTextareaProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div
      data-slot="form-textarea"
      className={cn("flex flex-col gap-1.5", containerClassName)}
    >
      {label ? (
        <label
          htmlFor={fieldId}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
        </label>
      ) : null}
      <Textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={className}
        {...registration}
        {...props}
      />
      {error ? (
        <p className="text-xs text-status-error">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
};
