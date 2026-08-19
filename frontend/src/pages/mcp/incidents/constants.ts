import type { IOption } from "@/components/FormSelect/types";
import type { TriageStatus } from "@/services/types";

/**
 * Radix Select reserves the empty string for "clear", so an "any" option needs
 * a real sentinel. `utils.ts#toQuery` maps it back to `undefined`.
 */
export const ANY = "__any__";

/** From `TRIGGER_KINDS` in server/src/modules/ingest/report.schema.ts. */
export const TRIGGER_OPTIONS: IOption[] = [
  { label: "Any trigger", value: ANY },
  { label: "BLOCKED", value: "BLOCKED" },
  { label: "INBOUND_NACK", value: "INBOUND_NACK" },
  { label: "OUTBOUND_NACK", value: "OUTBOUND_NACK" },
  { label: "SEND_FAILED", value: "SEND_FAILED" },
  { label: "VALIDATION_FINDINGS", value: "VALIDATION_FINDINGS" },
  { label: "VALIDATION_UNAVAILABLE", value: "VALIDATION_UNAVAILABLE" },
  { label: "CONFIG_DEFECT", value: "CONFIG_DEFECT" },
  { label: "AWAIT_TIMEOUT", value: "AWAIT_TIMEOUT" },
  { label: "RUN_ABANDONED", value: "RUN_ABANDONED" },
  { label: "INFRA_ERROR", value: "INFRA_ERROR" },
];

/** From `INCIDENT_STATES` in server/src/modules/ingest/report.schema.ts. */
export const STATE_OPTIONS: IOption[] = [
  { label: "Any state", value: ANY },
  { label: "OPEN", value: "OPEN" },
  { label: "RECOVERED", value: "RECOVERED" },
  { label: "RECOVERED_WITH_OVERRIDE", value: "RECOVERED_WITH_OVERRIDE" },
  { label: "ABANDONED", value: "ABANDONED" },
  { label: "UNRESOLVED", value: "UNRESOLVED" },
];

/** From `TriageStatusInput` in server/src/modules/query/query.schema.ts. */
export const TRIAGE_STATUSES: TriageStatus[] = [
  "new",
  "triaged",
  "planned",
  "in_progress",
  "fixed",
  "wontfix",
];

export const STATUS_OPTIONS: IOption[] = [
  { label: "Any status", value: ANY },
  ...TRIAGE_STATUSES.map((status) => ({ label: status, value: status })),
];

export const TRIAGE_STATUS_OPTIONS: IOption[] = TRIAGE_STATUSES.map(
  (status) => ({ label: status, value: status }),
);

export const SORT_OPTIONS: IOption[] = [
  { label: "Last seen", value: "last_seen" },
  { label: "First seen", value: "first_seen" },
  { label: "Occurrences", value: "occurrences" },
  { label: "Distinct runs", value: "runs" },
];

export const BOOLEAN_OPTIONS: IOption[] = [
  { label: "Either", value: ANY },
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
];

export const PAGE_SIZE_OPTIONS: IOption[] = [
  { label: "25 per page", value: "25" },
  { label: "50 per page", value: "50" },
  { label: "100 per page", value: "100" },
  { label: "200 per page", value: "200" },
];

export const DEFAULT_LIMIT = 50;

/**
 * The detail sheet's tabs.
 *
 * `issue` keeps its value — it is a Radix key, never in the URL, so renaming it
 * would touch `IncidentDetail` for no visible gain. The label is "Summary"
 * rather than "Report" because "Raw report" is four rows down, and a *report*
 * means one delivery everywhere else in this app.
 */
export const DETAIL_TABS = [
  { value: "issue", label: "Summary" },
  { value: "findings", label: "Findings" },
  { value: "narration", label: "Narration" },
  { value: "deliveries", label: "Deliveries" },
  { value: "raw", label: "Raw report" },
] as const;
