import { Copy } from "lucide-react";
import { StatusBadge } from "@/components/Badge";
import { TableCell, TableRow } from "@/components/Table";
import { HintTooltip } from "@/components/Tooltip";
import { formatDateTime, formatTime, truncateMiddle } from "@/lib/format";
import {
  ackTone,
  isOffSequence,
  kindLabel,
  kindTone,
} from "@/pages/mcp/journal/utils";
import type { JournalRow } from "@/services/types";
import { cn } from "@/lib/utils";

interface IJournalRowItemProps {
  row: JournalRow;
  onCopy: (value: string, label: string) => void;
}

const EMPTY = <span className="text-muted-foreground">—</span>;

/**
 * One line of the wire log. ACK is green, NACK is red, and an off-sequence
 * condition tints the whole row amber — the point of this page is that those
 * three states are distinguishable without reading a word.
 */
export const JournalRowItem = ({ row, onCopy }: IJournalRowItemProps) => {
  const offSequence = isOffSequence(row);
  const overrides = row.overrides ?? [];
  const payloadId = row.payload_id;

  return (
    <TableRow
      className={cn(
        "align-top",
        offSequence && "bg-status-warn-soft/40",
        row.ack === "NACK" && "bg-status-error-soft/30",
      )}
    >
      <TableCell className="font-mono text-xs text-muted-foreground">
        {row.seq}
      </TableCell>

      <TableCell className="whitespace-nowrap">
        <HintTooltip label={formatDateTime(row.at)}>
          <span className="font-mono text-xs">{formatTime(row.at)}</span>
        </HintTooltip>
      </TableCell>

      <TableCell>
        <StatusBadge tone={kindTone(row.kind)} size="sm">
          {kindLabel(row.kind)}
        </StatusBadge>
      </TableCell>

      <TableCell className="whitespace-nowrap text-xs">
        {row.flow_id ? (
          <HintTooltip
            label={
              row.transaction_id
                ? `transaction ${row.transaction_id}`
                : "no transaction bound yet"
            }
          >
            <span>{row.flow_id}</span>
          </HintTooltip>
        ) : (
          EMPTY
        )}
      </TableCell>

      <TableCell className="font-mono text-xs whitespace-nowrap">
        {row.action ?? EMPTY}
      </TableCell>

      <TableCell>
        {row.ack ? (
          <StatusBadge tone={ackTone(row)} size="sm">
            {row.ack}
          </StatusBadge>
        ) : (
          EMPTY
        )}
      </TableCell>

      <TableCell className="font-mono text-xs">
        {row.nack_code ? (
          <StatusBadge tone={offSequence ? "warn" : "error"} size="sm">
            {row.nack_code}
          </StatusBadge>
        ) : (
          EMPTY
        )}
      </TableCell>

      <TableCell>
        {overrides.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {overrides.map((path) => (
              <HintTooltip
                key={path}
                label={`Payload patched at ${path} after the flow's own generator ran`}
              >
                <StatusBadge tone="info" size="sm" className="font-mono">
                  {truncateMiddle(path, 22)}
                </StatusBadge>
              </HintTooltip>
            ))}
          </div>
        ) : (
          EMPTY
        )}
      </TableCell>

      <TableCell className="max-w-[26rem] text-xs">
        <span className="block truncate" title={row.summary}>
          {row.summary || "—"}
        </span>
      </TableCell>

      <TableCell>
        {payloadId ? (
          <HintTooltip label={`${payloadId} — click to copy`}>
            <button
              type="button"
              onClick={() => onCopy(payloadId, "Payload id")}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Copy className="size-3" />
              {truncateMiddle(payloadId, 12)}
            </button>
          </HintTooltip>
        ) : (
          EMPTY
        )}
      </TableCell>
    </TableRow>
  );
};
