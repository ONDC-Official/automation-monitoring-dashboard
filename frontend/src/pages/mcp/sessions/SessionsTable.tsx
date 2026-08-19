import type { KeyboardEvent } from "react";
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
import { SESSION_COLUMNS } from "@/pages/mcp/sessions/constants";
import {
  formatBuild,
  sessionStateLabel,
  sessionTone,
} from "@/pages/mcp/sessions/utils";
import type { SessionRow } from "@/services/types";

interface ISessionsTableProps {
  sessions: SessionRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  emptyLabel: string;
  onRetry: () => void;
  onSelect: (sessionRef: string) => void;
}

export const SessionsTable = ({
  sessions,
  isLoading,
  isError,
  error,
  emptyLabel,
  onRetry,
  onSelect,
}: ISessionsTableProps) => {
  const handleKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    sessionRef: string,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(sessionRef);
  };

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={sessions.length === 0}
      emptyLabel={emptyLabel}
      loadingLabel="Loading sessions…"
      onRetry={onRetry}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {SESSION_COLUMNS.map((column) => (
              <TableHead
                key={column}
                className={cn(
                  (column === "Runs" || column === "Auto-advance") &&
                    "text-right",
                )}
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow
              key={session.session_ref}
              tabIndex={0}
              onClick={() => onSelect(session.session_ref)}
              onKeyDown={(event) => handleKeyDown(event, session.session_ref)}
              className="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <TableCell>
                <HintTooltip label={session.session_ref}>
                  <span className="font-mono text-xs text-foreground">
                    {truncateMiddle(session.session_ref, 16)}
                  </span>
                </HintTooltip>
              </TableCell>

              <TableCell>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    {formatBuild(session.domain, session.version)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {session.usecase ?? "—"}
                  </span>
                </div>
              </TableCell>

              <TableCell className="text-xs">
                <StatusBadge tone="info" size="sm">
                  {session.mock_role}
                </StatusBadge>
              </TableCell>

              <TableCell className="text-xs text-muted-foreground">
                {session.np_type}
              </TableCell>

              <TableCell className="text-xs text-muted-foreground">
                {session.interaction_mode}
              </TableCell>

              <TableCell className="text-right">
                <StatusBadge
                  tone={session.auto_advance ? "ok" : "neutral"}
                  size="sm"
                  className="ml-auto"
                >
                  {session.auto_advance ? "on" : "off"}
                </StatusBadge>
              </TableCell>

              <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                <HintTooltip label={formatDateTime(session.created_at)}>
                  <span>{formatRelative(session.created_at)}</span>
                </HintTooltip>
              </TableCell>

              <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                <HintTooltip label={formatDateTime(session.expires_at)}>
                  <span>{formatRelative(session.expires_at)}</span>
                </HintTooltip>
              </TableCell>

              <TableCell className="text-right text-xs tabular-nums">
                {formatNumber(session.runs)}
              </TableCell>

              <TableCell>
                <StatusBadge tone={sessionTone(session.active)} size="sm">
                  {sessionStateLabel(session.active)}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </QueryState>
  );
};
