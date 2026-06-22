import { Controller } from "react-hook-form";
import type { FieldValues } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select";
import type { IProps } from "@/components/FormSelect/types";

const FormSelect = <T extends FieldValues>({
  label,
  error,
  options,
  placeholder,
  triggerClassName,
  size,
  ...rest
}: IProps<T>) => {
  const renderSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={triggerClassName} size={size}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium">{label}</label>}
      {"control" in rest ? (
        <Controller
          control={rest.control!}
          name={rest.name!}
          render={({ field }) => renderSelect(field.value, field.onChange)}
        />
      ) : (
        renderSelect(rest.value, rest.onChange)
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default FormSelect;
