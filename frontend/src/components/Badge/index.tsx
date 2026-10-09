import { type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import badgeVariants, {
  statusBadgeVariants,
} from "@/components/Badge/variants";

const Badge = ({
  className,
  variant = "default",
  asChild = false,
  ...rest
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) => {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...rest}
    />
  );
};

/** The six states everything in the app classifies itself into. */
export type BadgeTone = NonNullable<
  VariantProps<typeof statusBadgeVariants>["tone"]
>;

export const StatusBadge = ({
  className,
  tone = "neutral",
  size = "default",
  ...rest
}: React.ComponentProps<"span"> & VariantProps<typeof statusBadgeVariants>) => (
  <span
    data-slot="status-badge"
    data-tone={tone}
    className={cn(statusBadgeVariants({ tone, size }), className)}
    {...rest}
  />
);

export default Badge;
