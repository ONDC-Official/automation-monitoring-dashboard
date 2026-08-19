import type { ReactNode } from "react";
import { Card, CardContent, CardDescription } from "@/components/Card";
import { QueryState } from "@/components/QueryState";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ISummaryTilesProps {
  total: number;
  active: number;
  expired: number;
  runs: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  /** The runs count comes from a second query; it fails independently. */
  runsIsLoading: boolean;
  runsIsError: boolean;
  runsError: unknown;
  onRetryRuns: () => void;
}

/** The four headline counts, derived in `useSessionsPage`. */
export const SummaryTiles = ({
  total,
  active,
  expired,
  runs,
  isLoading,
  isError,
  error,
  onRetry,
  runsIsLoading,
  runsIsError,
  runsError,
  onRetryRuns,
}: ISummaryTilesProps) => {
  const tiles: Array<{
    key: string;
    label: string;
    value: ReactNode;
    tone?: string;
  }> = [
    { key: "total", label: "Sessions mirrored", value: formatNumber(total) },
    {
      key: "active",
      label: "Active",
      value: formatNumber(active),
      tone: "text-status-ok",
    },
    {
      key: "expired",
      label: "Expired",
      value: formatNumber(expired),
      tone: "text-status-idle",
    },
    {
      key: "runs",
      label: "Flow runs",
      value: (
        <QueryState
          isLoading={runsIsLoading}
          isError={runsIsError}
          error={runsError}
          onRetry={onRetryRuns}
          loadingLabel="…"
          className="py-0 text-xs"
        >
          {formatNumber(runs)}
        </QueryState>
      ),
    },
  ];

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      loadingLabel="Loading sessions…"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.key} className="gap-2 py-3">
            <CardContent className="flex flex-col gap-1">
              <CardDescription>{tile.label}</CardDescription>
              <div
                className={cn(
                  "text-2xl font-semibold tabular-nums tracking-tight",
                  tile.tone,
                )}
              >
                {tile.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </QueryState>
  );
};
