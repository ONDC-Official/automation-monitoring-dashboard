import { Card } from "@/components/Card";
import { HintTooltip } from "@/components/Tooltip";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: number | null;
  hint: string;
  isLoading?: boolean;
  className?: string;
}

export const StatTile = ({
  label,
  value,
  hint,
  isLoading,
  className,
}: StatTileProps) => (
  <HintTooltip label={hint}>
    <Card className={cn("gap-1 py-3", className)}>
      <div className="px-4 text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "px-4 text-2xl font-semibold tabular-nums",
          isLoading && "animate-pulse text-muted-foreground",
        )}
      >
        {isLoading ? "—" : formatNumber(value)}
      </div>
    </Card>
  </HintTooltip>
);
