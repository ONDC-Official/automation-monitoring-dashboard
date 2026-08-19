/** Static data for the journal page. Nothing here reads state. */

/**
 * Radix's Select reserves the empty string for "no value", so the "everything"
 * option needs a real sentinel of its own.
 */
export const ALL_KINDS = "__all__";

export const LIMIT_OPTIONS = [50, 100, 200, 500];

export const DEFAULT_LIMIT = 200;

/** The poll interval `useJournal` uses when the tail is live. */
export const LIVE_POLL_SECONDS = 10;

/**
 * The engine's journal kinds (`RecordService#journal`), given readable labels.
 * An unknown kind is rendered verbatim rather than hidden — a kind this page
 * has not heard of is exactly the thing worth seeing.
 */
export const KIND_LABELS: Record<string, string> = {
  INBOUND_ACK: "Inbound ACK",
  INBOUND_NACK: "Inbound NACK",
  OUTBOUND_SENT: "Outbound sent",
  CHAIN_SENT: "Chained send",
  CHAIN_PAUSED: "Chain paused",
  FORM_SUBMITTED: "Form submitted",
  TRANSACTION_BOUND: "Transaction bound",
  FLOW_COMPLETE: "Flow complete",
  FLOW_RESTARTED: "Flow restarted",
  EXPECTATION_REARMED: "Expectation re-armed",
  ATTENTION: "Attention",
  POSSIBLY_RELATED: "Possibly related",
};

/**
 * Conditions that mean "this landed somewhere the flow was not expecting it".
 * They are amber, never red: the call did arrive and was recorded, and an
 * unexpected call is one of the most valuable things a compliance run catches.
 */
export const OFF_SEQUENCE_CODES = [
  "OUT_OF_SEQUENCE",
  "ATTENTION",
  "POSSIBLY_RELATED",
  "TRANSACTION_MISMATCH",
  "CHAIN_PAUSED",
  "EXPECTATION_REARMED",
];

export const JOURNAL_COLUMNS = [
  "Seq",
  "At",
  "Kind",
  "Flow",
  "Action",
  "ACK",
  "NACK code",
  "Overrides",
  "Summary",
  "Payload",
];
