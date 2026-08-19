import { QueryState } from "@/components/QueryState";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/Table";
import { formatNumber } from "@/lib/format";
import { JOURNAL_COLUMNS } from "@/pages/mcp/journal/constants";
import { JournalRowItem } from "@/pages/mcp/journal/JournalRowItem";
import type { JournalRow } from "@/services/types";

interface IJournalTableProps {
  rows: JournalRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onCopy: (value: string, label: string) => void;
  /** Rows the request returned, before the client-side filters ran. */
  returned: number;
  /** Entries the session's journal holds in total. */
  total: number;
  filtered: boolean;
}

export const JournalTable = ({
  rows,
  isLoading,
  isError,
  error,
  onRetry,
  onCopy,
  returned,
  total,
  filtered,
}: IJournalTableProps) => (
  <QueryState
    isLoading={isLoading}
    isError={isError}
    error={error}
    isEmpty={rows.length === 0}
    emptyLabel={
      filtered
        ? "No entries match these filters"
        : "This session has journalled nothing yet"
    }
    loadingLabel="Reading the wire log…"
    onRetry={onRetry}
  >
    <Table>
      <TableHeader>
        <TableRow>
          {JOURNAL_COLUMNS.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <JournalRowItem key={row.seq} row={row} onCopy={onCopy} />
        ))}
      </TableBody>
      <TableCaption>
        Showing {formatNumber(rows.length)} of {formatNumber(returned)} fetched
        · {formatNumber(total)} in this session's journal. Ordered by seq, the
        journal's own counter — not by timestamp.
      </TableCaption>
    </Table>
  </QueryState>
);
