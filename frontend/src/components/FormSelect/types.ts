import type { Control, FieldValues, Path } from "react-hook-form";

interface IOption {
  label: string;
  value: string;
}

interface BaseProps {
  label?: string;
  error?: string;
  options: IOption[];
  placeholder?: string;
  triggerClassName?: string;
  size?: "sm" | "default";
}

interface RHFProps<T extends FieldValues> extends BaseProps {
  control: Control<T>;
  name: Path<T>;
  value?: never;
  onChange?: never;
}

interface ControlledProps extends BaseProps {
  control?: never;
  name?: never;
  value: string;
  onChange: (value: string) => void;
}

type IProps<T extends FieldValues> = RHFProps<T> | ControlledProps;

export type { IProps, IOption };
