import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/Card";
import { QueryState } from "@/components/QueryState";
import { HintTooltip } from "@/components/Tooltip";
import { formatNumber, formatPercent } from "@/lib/format";
import { RECOVERY_SEGMENTS } from "@/pages/mcp/overview/constants";
import { segmentClass } from "@/pages/mcp/overview/utils";
import { cn } from "@/lib/utils";
import type { RecoveryBreakdown } from "@/services/types";

interface RecoveryPanelProps {
  recovery: RecoveryBreakdown | null;
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/**
 * The corpus's headline number: of everything seen, what fraction the model got
 * past — and what fraction it only got past by patching a published config.
 */
export const RecoveryPanel = ({
  recovery,
  total,
  isLoading,
  isError,
  error,
  onRetry,
}: RecoveryPanelProps) => (
  <Card>
    <CardHeader>
      <CardTitle>Recovery</CardTitle>
      <CardDescription>
        “Worked around somebody else’s bug” and “was wrong, then was not” are
        different findings, so they are different segments.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={onRetry}
        isEmpty={!recovery || total === 0}
        emptyLabel="No incidents have been resolved either way yet"
      >
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {RECOVERY_SEGMENTS.map((segment) => {
            const value = recovery?.[segment.key] ?? 0;
            if (value <= 0) return null;
            return (
              <HintTooltip
                key={segment.key}
                label={`${segment.label} — ${formatNumber(value)} (${segment.hint})`}
              >
                <div
                  className={cn("h-full", segmentClass(segment.tone))}
                  style={{ width: `${(value / total) * 100}%` }}
                />
              </HintTooltip>
            );
          })}
        </div>

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RECOVERY_SEGMENTS.map((segment) => {
            const value = recovery?.[segment.key] ?? 0;
            return (
              <li
                key={segment.key}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
              >
                <span className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      segmentClass(segment.tone),
                    )}
                  />
                  {segment.label}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatNumber(value)} · {formatPercent(value, total)}
                </span>
              </li>
            );
          })}
        </ul>
      </QueryState>
    </CardContent>
  </Card>
);
