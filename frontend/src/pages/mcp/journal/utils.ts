import type { BadgeTone } from "@/components/Badge";
import type { JournalRow } from "@/services/types";
import { KIND_LABELS, OFF_SEQUENCE_CODES } from "@/pages/mcp/journal/constants";

/**
 * Pure helpers for the wire log. The colour rules live here rather than in the
 * row so they can be reasoned about in one place: ACK is green, NACK is red,
 * and anything off-sequence is amber.
 */

const OFF_SEQUENCE = new Set(OFF_SEQUENCE_CODES);

/** True when the row's kind or NACK code names an out-of-sequence condition. */
export const isOffSequence = (row: JournalRow) =>
  OFF_SEQUENCE.has(row.kind) ||
  (row.nack_code !== null && OFF_SEQUENCE.has(row.nack_code));

/** The tone of the ACK cell. Fixed and load-bearing — do not widen. */
export const ackTone = (row: JournalRow): BadgeTone => {
  if (row.ack === "ACK") return "ok";
  if (row.ack === "NACK") return "error";
  return isOffSequence(row) ? "warn" : "neutral";
};

export const kindTone = (kind: string): BadgeTone => {
  if (kind === "INBOUND_NACK") return "error";
  if (kind === "INBOUND_ACK" || kind === "FLOW_COMPLETE") return "ok";
  if (OFF_SEQUENCE.has(kind) || kind === "FLOW_RESTARTED") return "warn";
  if (
    kind === "OUTBOUND_SENT" ||
    kind === "CHAIN_SENT" ||
    kind === "FORM_SUBMITTED" ||
    kind === "TRANSACTION_BOUND"
  ) {
    return "info";
  }
  return "neutral";
};

export const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind;

/**
 * The free-text filter searches everything the row can show, including the
 * fields the table truncates — an operator pasting a full transaction id must
 * still find its line.
 */
export const matchesTextFilter = (row: JournalRow, text: string) => {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    String(row.seq),
    row.kind,
    row.flow_id,
    row.transaction_id,
    row.action,
    row.ack,
    row.nack_code,
    row.payload_id,
    row.summary,
    ...(row.overrides ?? []),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
};

/**
 * Seq is the session journal's own monotonic counter, so it is the only honest
 * ordering — `at` is a timestamp and two entries can share one.
 */
export const sortBySeq = (rows: JournalRow[]) =>
  [...rows].sort((a, b) => a.seq - b.seq);

/** The kinds actually present, so the filter never offers an empty result. */
export const presentKinds = (rows: JournalRow[]) =>
  [...new Set(rows.map((row) => row.kind))].sort((a, b) => a.localeCompare(b));

/** `after_seq` is a cursor: blank or nonsense means "from the beginning". */
export const parseAfterSeq = (value: string) => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
