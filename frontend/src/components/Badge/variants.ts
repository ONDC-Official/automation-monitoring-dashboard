import { cva } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * The status badge — a sibling of `Badge`, not a variant of it.
 *
 * `Badge` classifies by emphasis (primary, secondary, destructive…);
 * `StatusBadge` classifies by *state*, on the fixed house palette: green =
 * ok/up, amber = warn/degraded, red = down/error. Nothing invents a fourth
 * status colour.
 *
 * Kept separate rather than added as a `tone` axis because `badgeVariants`
 * sets `defaultVariants.variant: 'default'` — a caller passing only `tone`
 * would still get `bg-primary` underneath, and the two axes would fight on
 * every usage.
 */
export const statusBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium [&_svg]:size-3 [&_svg]:pointer-events-none",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        ok: "border-status-ok/30 bg-status-ok-soft text-status-ok",
        warn: "border-status-warn/30 bg-status-warn-soft text-status-warn",
        error: "border-status-error/30 bg-status-error-soft text-status-error",
        info: "border-primary/30 bg-primary/10 text-primary",
        outline: "border-border bg-transparent text-foreground",
      },
      size: {
        sm: "px-1 py-0 text-[10px]",
        default: "",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "default",
    },
  }
);

export default badgeVariants;
