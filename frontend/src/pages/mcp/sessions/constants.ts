/** Static data for the sessions page. Nothing here reads state. */

export const SESSION_TABS = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
] as const;

export type SessionTab = (typeof SESSION_TABS)[number]["value"];

export const DEFAULT_SESSION_TAB: SessionTab = "active";

export const PAGE_TITLE = "Sessions";

export const PAGE_DESCRIPTION =
  "Mirrored mock-NP sessions from the automation-mcp engine — the participant under test, the build it is running, and every flow run opened against it.";

/** Column labels, in render order, for `SessionsTable`. */
export const SESSION_COLUMNS = [
  "Session",
  "Build",
  "Mock role",
  "NP type",
  "Mode",
  "Auto-advance",
  "Created",
  "Expires",
  "Runs",
  "State",
] as const;

/** Column labels, in render order, for `RunsTable`. */
export const RUN_COLUMNS = [
  "Flow",
  "Attempt",
  "Transaction",
  "Status",
  "Steps",
  "Started",
  "Updated",
] as const;

/**
 * Field label + `SessionRow` key pairs for the drill-in definition list. Kept as
 * data so the sheet is a map, not ten hand-written rows.
 */
export const SESSION_SUMMARY_FIELDS = [
  { key: "callback_url", label: "Callback URL", mono: true },
  { key: "subscriber_ref", label: "Subscriber ref", mono: true },
  { key: "session_id", label: "Session id", mono: true },
  { key: "install_id", label: "Install id", mono: true },
  { key: "instance_id", label: "Instance id", mono: true },
  { key: "interaction_mode", label: "Interaction mode", mono: false },
] as const;

export const SESSIONS_EMPTY_LABEL = "No sessions have been mirrored yet";

export const ACTIVE_SESSIONS_EMPTY_LABEL = "No active sessions right now";

export const EXPIRED_SESSIONS_EMPTY_LABEL = "No sessions have expired yet";

export const RUNS_EMPTY_LABEL = "No flow runs opened on this session yet";

/** A run exists before its transaction does — that is not a missing value. */
export const UNBOUND_LABEL = "unbound";
