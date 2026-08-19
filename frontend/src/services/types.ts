// API response types — mirrored from backend source definitions.
// BusinessType       → backend/src/redis/key-codec.ts
// ScanResult         → backend/src/redis/service.ts
// InspectResult      → backend/src/redis/service.ts
// DashboardRef       → backend/src/proxies/grafana.ts
// Remaining shapes   → backend route handler return values

export type BusinessType =
  | "MOCK_DATA"
  | "FLOW_STATUS"
  | "EXTRA_FLOW_STATUS"
  | "PLAYGROUND"
  | "TRANSACTION"
  | "SUBSCRIBER"
  | "SESSION"
  | "RUNNER_CONFIG"
  | "UNKNOWN";

/**
 * A dependency is up, down, or not configured at all.
 *
 * `"disabled"` is what `mongo` reports when the MCP section is switched off,
 * and it must never render as a failure — see `backend/src/routes/health.ts`.
 */
export type DepState = boolean | "disabled";

export interface HealthResponse {
  status: "ok" | "degraded";
  deps: {
    redisDb0: DepState;
    redisDb1: DepState;
    prometheus: DepState;
    loki: DepState;
    grafana: DepState;
    monitoredService: DepState;
    mongo: DepState;
  };
}

export interface DbsResponse {
  businessTypes: BusinessType[];
  dbs: Array<{ db: number; dbsize: number; label: string }>;
}

// Matches backend/src/redis/service.ts → ScanResult
export interface ScanResult {
  db: number;
  cursor: string; // '0' when iteration is complete
  keys: Array<{
    key: string;
    businessType: BusinessType;
    ttl: number; // -1 = no expiry, -2 = missing
    type: string; // redis type (string/hash/...)
  }>;
}

// Matches backend/src/redis/service.ts → InspectResult
export interface InspectResult {
  key: string;
  db: number;
  businessType: BusinessType;
  parts: Record<string, string>;
  type: string;
  ttl: number;
  sizeBytes: number;
  raw: unknown;
  decoded: unknown | null;
  validation: { ok: boolean; errors: string[] };
}

// Matches backend/src/proxies/grafana.ts → DashboardRef
export interface DashboardRef {
  uid: string;
  title: string;
  url: string;
  folderTitle?: string;
  tags: string[];
}

// Prometheus HTTP API passthrough
export interface PromResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
}

// Loki HTTP API passthrough
export interface LokiResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      stream: Record<string, string>;
      values: Array<[string, string]>;
    }>;
  };
}

// Backend error shape (backend/src/middlewares/error.ts)
export interface ApiErrorBody {
  /**
   * Free-form on purpose. Beyond the proxy's own `upstream_error` /
   * `internal_error`, the MCP section answers with the thrown error's name
   * (`BadRequestError`, `NotFoundError`) and with `mcp_disabled`.
   */
  error: string;
  message: string;
  upstream?: string;
  detail?: unknown;
  details?: unknown;
}


/* ========================================================================== */
/* MCP section — the corpus, triage and mirrored engine state.                 */
/*                                                                            */
/* Every shape below mirrors a backend contract and the annotation names the   */
/* file it mirrors. When the backend changes, edit this file first and let     */
/* TypeScript surface the call sites.                                          */
/*                                                                            */
/* `HealthResponse` and `ApiError` are deliberately NOT carried over from the  */
/* repo these came from: this app already owns both (the aggregate health of   */
/* every dependency, and the ApiError class in services/httpClient).           */
/* ========================================================================== */
/* -------------------------------------------------------------------------- */
/* Transport                                                                    */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Filters — mirrors server/src/modules/query/query.schema.ts (IncidentListQuery) */
/* -------------------------------------------------------------------------- */

export type IncidentSort = "last_seen" | "first_seen" | "occurrences" | "runs";

export interface IncidentListQuery {
  domain?: string;
  version?: string;
  flow_id?: string;
  trigger?: string;
  state?: string;
  status?: string;
  suppressed?: boolean;
  narrated?: boolean;
  /** ISO 8601. Filters on `last_seen_at`. */
  since?: string;
  /** Substring match over code, flow, step and message. */
  search?: string;
  sort?: IncidentSort;
  limit?: number;
  skip?: number;
}

/* -------------------------------------------------------------------------- */
/* Rows — mirrors server/src/modules/query/query.schema.ts                      */
/* -------------------------------------------------------------------------- */

/** Mirrors `IncidentRow` in server/src/modules/query/query.schema.ts. */
export interface IncidentRow {
  fingerprint: string;
  domain: string;
  version: string;
  usecase: string | null;
  flow_id: string;
  trigger: string;
  code: string;
  step_key: string | null;
  action: string | null;

  occurrences_total: number;
  distinct_runs: number;
  installs: number;
  first_seen_at: string;
  last_seen_at: string;
  latest_state: string;
  narrated: boolean;
  suppressed: boolean;

  triage_status: string;
  triage_assignees: string[];
  /** How many notes an operator has recorded. The array is on the detail view. */
  triage_notes: number;
}

/** Mirrors `IncidentListResponse` in server/src/modules/query/query.schema.ts. */
export interface IncidentListResponse {
  items: IncidentRow[];
  total: number;
  limit: number;
  skip: number;
}

/** Mirrors `IncidentDetailResponse.recent_reports[]`. */
export interface IncidentReportSummary {
  report_doc_id: string;
  install_id: string;
  generated_at: string;
  state: string;
  occurrences: number;
  narrated: boolean;
  session_id: string | null;
  transaction_id: string | null;
}

/** Mirrors `IncidentDetailResponse.rendered_summary`. */
export interface RenderedSummary {
  title: string;
  body: string;
  labels: string[];
}

/** Mirrors `TriageNote` in backend/src/mcp/modules/corpus/corpus.schema.ts. */
export interface TriageNote {
  at: string;
  kind: "status" | "comment" | "link" | "dismiss";
  body: string;
  reference?: string;
  status?: string;
}

/**
 * Mirrors `IncidentDetailResponse` in server/src/modules/query/query.schema.ts.
 * `latest_report` is the raw `IssueReport`, unmodelled on purpose — it is
 * rendered by `JsonViewer`, never destructured.
 */
export interface IncidentDetailResponse {
  incident: IncidentRow;
  state_counts: Record<string, number>;
  install_ids: string[];
  mock_roles: string[];
  suspected_causes: string[];
  latest_report: unknown;
  rendered_summary: RenderedSummary | null;
  /** Everything an operator recorded, oldest first. */
  triage_notes: TriageNote[];
  recent_reports: IncidentReportSummary[];
}

/* -------------------------------------------------------------------------- */
/* The raw report — mirrors server/src/modules/ingest/report.schema.ts           */
/* -------------------------------------------------------------------------- */

/**
 * `IncidentDetailResponse.latest_report` is typed `unknown` by the read API on
 * purpose: ingest parses leniently so a report written by a version the server
 * has never seen is still stored verbatim. These shapes are therefore a
 * *reading* of that document, and every field is treated as optional at the
 * point of use — see `pages/reports/utils.ts#asIssueReport`.
 */
export interface ValidationFinding {
  layer: string;
  code: string;
  json_path: string;
  message: string;
  skip_if?: string;
}

export interface IncidentEvidence {
  message?: string;
  runner_logs?: string[];
  runner_stack?: string;
  sequence?: {
    expected_action?: string;
    expected_step_key?: string;
    received_action?: string;
    missed_steps?: string[];
  };
  delivery?: string;
  error_codes?: string[];
  http_status?: number;
  ack?: string;
  findings?: ValidationFinding[];
  unchecked?: Array<{ layer: string; reason: string }>;
  payload_shape?: unknown;
}

/** The model's own account. `null` — not absent — when it never answered. */
export interface Narration {
  diagnosis: string;
  attempted: string[];
  outcome: string;
  suspected_cause: string;
  /** "What would have let you resolve this faster" — the actionable field. */
  tooling_gap?: string;
  at: string;
}

export interface ReportJournalEntry {
  seq: number;
  kind: string;
  action?: string;
  ack?: string;
  nack_code?: string;
  summary: string;
}

/** Mirrors `IssueReport` in server/src/modules/ingest/report.schema.ts. */
export interface IssueReport {
  schema_version: number;
  report_id: string;
  generated_at: string;
  install_id: string;
  build: { domain: string; version: string; usecase?: string };
  mock_role: string;
  flow_id: string;
  attempt: number;
  incident: {
    trigger: string;
    code: string;
    step_key?: string;
    action?: string;
    occurrences: number;
    state: string;
    duration_ms?: number;
  };
  evidence: IncidentEvidence;
  journal: ReportJournalEntry[];
  narration?: Narration | null;
  correlation?: { session_id: string; transaction_id?: string };
}

/* -------------------------------------------------------------------------- */
/* Facets — mirrors server/src/modules/query/query.schema.ts (StatsResponse)     */
/* -------------------------------------------------------------------------- */

export interface FacetBucket {
  key: string;
  count: number;
}

export interface TopFlow {
  flow_id: string;
  domain: string;
  occurrences: number;
  incidents: number;
}

/**
 * The corpus's headline number. `recovered` and `recovered_with_override` are
 * deliberately separate: one is a model problem, the other is somebody else's
 * bug in a published config.
 */
export interface RecoveryBreakdown {
  recovered: number;
  recovered_with_override: number;
  abandoned: number;
  open: number;
  unresolved: number;
}

/** Mirrors `StatsResponse` in server/src/modules/query/query.schema.ts. */
export interface StatsResponse {
  incidents_total: number;
  incidents_open: number;
  incidents_untracked: number;
  reports_total: number;
  installs: number;
  by_trigger: FacetBucket[];
  by_state: FacetBucket[];
  by_domain: FacetBucket[];
  by_status: FacetBucket[];
  top_flows: TopFlow[];
  recovery: RecoveryBreakdown;
}

/* -------------------------------------------------------------------------- */
/* Mirrored live state — mirrors server/src/modules/query/query.schema.ts        */
/* -------------------------------------------------------------------------- */

/** Mirrors `SessionRow` in server/src/modules/query/query.schema.ts. */
export interface SessionRow {
  session_ref: string;
  session_id: string | null;
  install_id: string;
  instance_id: string;
  domain: string;
  version: string;
  usecase: string | null;
  mock_role: string;
  np_type: string;
  subscriber_ref: string;
  callback_url: string;
  interaction_mode: string;
  auto_advance: boolean;
  created_at: string;
  expires_at: string;
  /** Derived from `expires_at`, since TTL expiry is silent in the engine. */
  active: boolean;
  runs: number;
}

/** Mirrors `RunRow` in server/src/modules/query/query.schema.ts. */
export interface RunRow {
  session_ref: string;
  session_id: string | null;
  flow_id: string;
  attempt: number;
  transaction_id: string | null;
  status: string;
  step_count: number | null;
  started_at: string;
  updated_at: string;
}

/** Mirrors `JournalRow` in server/src/modules/query/query.schema.ts. */
export interface JournalRow {
  session_ref: string;
  seq: number;
  at: string;
  kind: string;
  flow_id: string | null;
  transaction_id: string | null;
  action: string | null;
  ack: string | null;
  nack_code: string | null;
  payload_id: string | null;
  overrides: string[];
  summary: string;
}

/** Mirrors `SessionListResponse` in server/src/modules/query/query.schema.ts. */
export interface SessionListResponse {
  items: SessionRow[];
  total: number;
}

/** Mirrors `RunListResponse` in server/src/modules/query/query.schema.ts. */
export interface RunListResponse {
  items: RunRow[];
  total: number;
}

/** Mirrors `JournalListResponse` in server/src/modules/query/query.schema.ts. */
export interface JournalListResponse {
  items: JournalRow[];
  total: number;
}

export interface JournalListQuery {
  after_seq?: number;
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/* Triage actions — mirrors server/src/modules/query/query.schema.ts             */
/* -------------------------------------------------------------------------- */

/** Mirrors `TriageStatusInput` in server/src/modules/query/query.schema.ts. */
export type TriageStatus =
  "new" | "triaged" | "planned" | "in_progress" | "fixed" | "wontfix";

/** Mirrors `SetStatusBody` in server/src/modules/query/query.schema.ts. */
export interface SetStatusBody {
  status: TriageStatus;
  /** Free text appended as a comment alongside the label change. */
  note?: string;
}

/** Mirrors `CommentBody` in server/src/modules/query/query.schema.ts. */
export interface CommentBody {
  body: string;
}

/** Mirrors `LinkFixBody` in server/src/modules/query/query.schema.ts. */
export interface LinkFixBody {
  /** A PR URL, a branch name or a commit sha — whatever names the fix. */
  reference: string;
  note?: string;
}

/** Mirrors `DismissBody` in server/src/modules/query/query.schema.ts. */
export interface DismissBody {
  reason: string;
}

/** Mirrors `TriageResult` in server/src/modules/query/query.schema.ts. */
export interface TriageResult {
  fingerprint: string;
  status: string;
  /** Notes on the incident after this action. */
  notes: number;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Health — mirrors server/src/modules/query/query.schema.ts                     */
/* -------------------------------------------------------------------------- */

/** Mirrors `ConfigResponse` in server/src/modules/query/query.schema.ts. */
export interface ConfigResponse {
  /**
   * Whether this deployment has the MCP section configured (`MONGO_URL` set).
   *
   * Configuration, not liveness: a configured-but-unreachable Mongo stays
   * `true`, keeps the nav visible and lets each page show its own error.
   * Hiding the nav on a transient outage would make the UI lie about what the
   * deployment *is*.
   */
  mcp_enabled: boolean;
  grafana_url: string | null;
  prometheus_url: string | null;
  loki_url: string | null;
}

/* -------------------------------------------------------------------------- */
/* Prometheus — mirrors the upstream HTTP API (/api/v1/query_range)             */
/* -------------------------------------------------------------------------- */

export interface PromMatrixResult {
  metric: Record<string, string>;
  values: Array<[number, string]>;
}

export interface PromRangeResponse {
  status: "success" | "error";
  data?: {
    resultType: string;
    result: PromMatrixResult[];
  };
  errorType?: string;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/* Loki — mirrors the upstream HTTP API (/loki/api/v1/query_range)              */
/* -------------------------------------------------------------------------- */

export interface LokiStream {
  stream: Record<string, string>;
  /** `[ns epoch as string, line]`. */
  values: Array<[string, string]>;
}

export interface LokiRangeResponse {
  status: "success" | "error";
  data?: {
    resultType: string;
    result: LokiStream[];
    stats?: unknown;
  };
  /* Loki answers HTTP 200 with `status: "error"` for a query it parsed but
     could not run, and the reason is only in these fields. */
  errorType?: string;
  error?: string;
}

/** One flattened Loki line, sorted and labelled — what `LogsList` renders. */
export interface LogLine {
  id: string;
  timestampNs: string;
  at: string;
  line: string;
  labels: Record<string, string>;
  level: string | null;
}
