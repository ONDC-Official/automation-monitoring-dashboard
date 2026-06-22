import type { UseFormRegisterReturn } from "react-hook-form";

interface IProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  registration?: UseFormRegisterReturn;
}

export type { IProps };
