import { StatusBadge } from "@/components/Badge";
import { QueryState } from "@/components/QueryState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/Table";
import { HintTooltip } from "@/components/Tooltip";
import {
  formatDateTime,
  formatNumber,
  formatRelative,
  truncateMiddle,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  RUNS_EMPTY_LABEL,
  RUN_COLUMNS,
  UNBOUND_LABEL,
} from "@/pages/mcp/sessions/constants";
import { runStatusTone } from "@/pages/mcp/sessions/utils";
import type { RunRow } from "@/services/types";

interface IRunsTableProps {
  runs: RunRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/** Every flow run opened against one session, newest attempt included. */
export const RunsTable = ({
  runs,
  isLoading,
  isError,
  error,
  onRetry,
}: IRunsTableProps) => (
  <QueryState
    isLoading={isLoading}
    isError={isError}
    error={error}
    isEmpty={runs.length === 0}
    emptyLabel={RUNS_EMPTY_LABEL}
    loadingLabel="Loading runs…"
    onRetry={onRetry}
  >
    <Table>
      <TableHeader>
        <TableRow>
          {RUN_COLUMNS.map((column) => (
            <TableHead
              key={column}
              className={cn(
                (column === "Attempt" || column === "Steps") && "text-right",
              )}
            >
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={`${run.flow_id}::${run.attempt}`}>
            <TableCell className="text-xs font-medium">{run.flow_id}</TableCell>

            <TableCell className="text-right text-xs tabular-nums">
              {formatNumber(run.attempt)}
            </TableCell>

            <TableCell>
              {run.transaction_id ? (
                <HintTooltip label={run.transaction_id}>
                  <span className="font-mono text-xs">
                    {truncateMiddle(run.transaction_id, 16)}
                  </span>
                </HintTooltip>
              ) : (
                <HintTooltip label="A run exists before its transaction does — the id is minted by whoever sends the flow's first action.">
                  <StatusBadge tone="outline" size="sm">
                    {UNBOUND_LABEL}
                  </StatusBadge>
                </HintTooltip>
              )}
            </TableCell>

            <TableCell>
              <StatusBadge tone={runStatusTone(run.status)} size="sm">
                {run.status}
              </StatusBadge>
            </TableCell>

            <TableCell className="text-right text-xs tabular-nums">
              {formatNumber(run.step_count)}
            </TableCell>

            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
              <HintTooltip label={formatDateTime(run.started_at)}>
                <span>{formatRelative(run.started_at)}</span>
              </HintTooltip>
            </TableCell>

            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
              <HintTooltip label={formatDateTime(run.updated_at)}>
                <span>{formatRelative(run.updated_at)}</span>
              </HintTooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </QueryState>
);
