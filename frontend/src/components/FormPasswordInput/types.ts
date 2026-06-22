import type { UseFormRegisterReturn } from "react-hook-form";

interface IProps extends Omit<React.ComponentProps<"input">, "type"> {
  label: string;
  error?: string;
  registration?: UseFormRegisterReturn;
}

export type { IProps };
