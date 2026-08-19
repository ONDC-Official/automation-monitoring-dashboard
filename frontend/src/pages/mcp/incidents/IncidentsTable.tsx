import { StickyNote, MessageSquare, EyeOff } from "lucide-react";
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
import { formatNumber, formatRelative, truncateMiddle } from "@/lib/format";
import { stateTone, triageTone, triggerTone } from "@/pages/mcp/incidents/utils";
import { cn } from "@/lib/utils";
import type { IncidentRow } from "@/services/types";

interface IncidentsTableProps {
  rows: IncidentRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onSelect: (fingerprint: string) => void;
  selected: string | null;
}

export const IncidentsTable = ({
  rows,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  selected,
}: IncidentsTableProps) => (
  <QueryState
    isLoading={isLoading}
    isError={isError}
    error={error}
    onRetry={onRetry}
    isEmpty={rows.length === 0}
    emptyLabel="No incident matches these filters"
  >
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Build</TableHead>
          <TableHead>Flow / step</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Triage</TableHead>
          <TableHead className="text-right">Occ.</TableHead>
          <TableHead className="text-right">Runs</TableHead>
          <TableHead className="text-right">Installs</TableHead>
          <TableHead>Last seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.fingerprint}
            onClick={() => onSelect(row.fingerprint)}
            data-state={selected === row.fingerprint ? "selected" : undefined}
            className={cn("cursor-pointer", row.suppressed && "opacity-60")}
          >
            <TableCell className="max-w-64">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-mono text-xs font-medium">
                  {row.code}
                </span>
                {row.suppressed ? (
                  <HintTooltip label="Suppressed — kept in the corpus, out of the triage queue">
                    <EyeOff className="size-3 shrink-0 text-muted-foreground" />
                  </HintTooltip>
                ) : null}
                {row.narrated ? (
                  <HintTooltip label="The model narrated this incident">
                    <MessageSquare className="size-3 shrink-0 text-muted-foreground" />
                  </HintTooltip>
                ) : null}
                {row.triage_notes > 0 ? (
                  <HintTooltip
                    label={`${row.triage_notes} triage note${
                      row.triage_notes === 1 ? "" : "s"
                    }`}
                  >
                    <StickyNote className="size-3 shrink-0 text-muted-foreground" />
                  </HintTooltip>
                ) : null}
              </div>
              <HintTooltip label={row.fingerprint}>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {truncateMiddle(row.fingerprint, 16)}
                </span>
              </HintTooltip>
            </TableCell>
            <TableCell>
              <StatusBadge tone={triggerTone(row.trigger)}>{row.trigger}</StatusBadge>
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              <div>{row.domain}</div>
              <div className="text-muted-foreground">
                {row.version}
                {row.usecase ? ` · ${row.usecase}` : ""}
              </div>
            </TableCell>
            <TableCell className="max-w-56 text-xs">
              <div className="truncate font-mono">{row.flow_id}</div>
              <div className="truncate font-mono text-muted-foreground">
                {row.step_key ?? row.action ?? "—"}
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge tone={stateTone(row.latest_state)}>
                {row.latest_state}
              </StatusBadge>
            </TableCell>
            <TableCell>
              <StatusBadge tone={triageTone(row.triage_status)}>
                {row.triage_status}
              </StatusBadge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(row.occurrences_total)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(row.distinct_runs)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(row.installs)}
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              <HintTooltip label={`First seen ${row.first_seen_at}`}>
                <span>{formatRelative(row.last_seen_at)}</span>
              </HintTooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </QueryState>
);
