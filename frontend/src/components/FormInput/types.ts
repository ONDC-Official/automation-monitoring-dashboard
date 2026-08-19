import type { UseFormRegisterReturn } from "react-hook-form";

interface IProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  /** Helper text under the field. Suppressed while `error` is set. */
  hint?: string;
  registration?: UseFormRegisterReturn;
}

export type { IProps };
