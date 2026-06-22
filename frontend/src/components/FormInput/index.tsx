import { cn } from "@/lib/utils";
import { Input } from "@/components/Input";
import type { IProps } from "./types";

const FormInput = ({
  label,
  error,
  registration,
  id,
  className,
  ...rest
}: IProps) => {
  const inputId = id ?? registration?.name;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
      )}
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(className)}
        {...registration}
        {...rest}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default FormInput;
