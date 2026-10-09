import { z } from "zod";

/**
 * The read API — the one contract two consumers share.
 *
 * The web app and Grafana's Infinity datasource both read through these shapes.
 * That is why they look the way they do:
 *
 * - **Flat, scalar-valued rows.** Infinity turns a JSON array into a table by
 *   reading top-level keys; a nested `triage: {status}` becomes an unusable
 *   column. So list rows are flattened (`triage_status`, `triage_notes`) and
 *   only the *detail* endpoints return nested documents.
 * - **`items` + `total`, never a bare array.** A bare array leaves the UI
 *   unable to page and Infinity unable to show "1–50 of 812".
 * - **Summaries in lists, bodies only on request.** A list of 50 incidents
 *   carrying 50 full `IssueReport`s is megabytes.
 */

/* -------------------------------------------------------------------------- */
/* Filters                                                                     */
/* -------------------------------------------------------------------------- */

export const IncidentListQuery = z.object({
  domain: z.string().optional(),
  version: z.string().optional(),
  flow_id: z.string().optional(),
  trigger: z.string().optional(),
  state: z.string().optional(),
  status: z.string().optional(),
  suppressed: z.coerce.boolean().optional(),
  narrated: z.coerce.boolean().optional(),
  /** ISO 8601. Filters on `last_seen_at`. */
  since: z.string().optional(),
  /** Substring match over code, flow, step and message. */
  search: z.string().optional(),
  sort: z
    .enum(["last_seen", "first_seen", "occurrences", "runs"])
    .default("last_seen"),
  limit: z.coerce.number().int().positive().max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});
export type IncidentListQuery = z.infer<typeof IncidentListQuery>;

/* -------------------------------------------------------------------------- */
/* Rows                                                                        */
/* -------------------------------------------------------------------------- */

export const IncidentRow = z.object({
  fingerprint: z.string(),
  domain: z.string(),
  version: z.string(),
  usecase: z.string().nullable(),
  flow_id: z.string(),
  trigger: z.string(),
  code: z.string(),
  step_key: z.string().nullable(),
  action: z.string().nullable(),

  occurrences_total: z.number(),
  distinct_runs: z.number(),
  installs: z.number(),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  latest_state: z.string(),
  narrated: z.boolean(),
  suppressed: z.boolean(),

  triage_status: z.string(),
  triage_assignees: z.array(z.string()),
  /** How many notes an operator has recorded. The array is on the detail view. */
  triage_notes: z.number(),
});
export type IncidentRow = z.infer<typeof IncidentRow>;

export const IncidentListResponse = z.object({
  items: z.array(IncidentRow),
  total: z.number(),
  limit: z.number(),
  skip: z.number(),
});
export type IncidentListResponse = z.infer<typeof IncidentListResponse>;

/** The detail view. `report` is the raw `IssueReport`, unmodelled on purpose. */
export const IncidentDetailResponse = z.object({
  incident: IncidentRow,
  state_counts: z.record(z.string(), z.number()),
  install_ids: z.array(z.string()),
  mock_roles: z.array(z.string()),
  suspected_causes: z.array(z.string()),
  latest_report: z.unknown().nullable(),
  /** A paste-ready human write-up of the incident. Not filed anywhere. */
  rendered_summary: z
    .object({ title: z.string(), body: z.string(), labels: z.array(z.string()) })
    .nullable(),
  /** Everything an operator recorded, oldest first. */
  triage_notes: z.array(
    z.object({
      at: z.string(),
      kind: z.enum(["status", "comment", "link", "dismiss"]),
      body: z.string(),
      reference: z.string().optional(),
      status: z.string().optional(),
    }),
  ),
  recent_reports: z.array(
    z.object({
      report_doc_id: z.string(),
      install_id: z.string(),
      generated_at: z.string(),
      state: z.string(),
      occurrences: z.number(),
      narrated: z.boolean(),
      session_id: z.string().nullable(),
      transaction_id: z.string().nullable(),
    }),
  ),
});
export type IncidentDetailResponse = z.infer<typeof IncidentDetailResponse>;

/* -------------------------------------------------------------------------- */
/* Facets                                                                      */
/* -------------------------------------------------------------------------- */

const FacetBucket = z.object({ key: z.string(), count: z.number() });

export const StatsResponse = z.object({
  incidents_total: z.number(),
  incidents_open: z.number(),
  incidents_untracked: z.number(),
  reports_total: z.number(),
  installs: z.number(),
  by_trigger: z.array(FacetBucket),
  by_state: z.array(FacetBucket),
  by_domain: z.array(FacetBucket),
  by_status: z.array(FacetBucket),
  top_flows: z.array(
    z.object({
      flow_id: z.string(),
      domain: z.string(),
      occurrences: z.number(),
      incidents: z.number(),
    }),
  ),
  /**
   * The corpus's headline number: of everything seen, what fraction the model
   * got past, and what fraction it only got past by patching a published
   * config. Those two are deliberately separate — one is a model problem, the
   * other is somebody else's bug.
   */
  recovery: z.object({
    recovered: z.number(),
    recovered_with_override: z.number(),
    abandoned: z.number(),
    open: z.number(),
    unresolved: z.number(),
  }),
});
export type StatsResponse = z.infer<typeof StatsResponse>;

/* -------------------------------------------------------------------------- */
/* Mirrored live state                                                         */
/* -------------------------------------------------------------------------- */

export const SessionRow = z.object({
  session_ref: z.string(),
  session_id: z.string().nullable(),
  install_id: z.string(),
  instance_id: z.string(),
  domain: z.string(),
  version: z.string(),
  usecase: z.string().nullable(),
  mock_role: z.string(),
  np_type: z.string(),
  subscriber_ref: z.string(),
  callback_url: z.string(),
  interaction_mode: z.string(),
  auto_advance: z.boolean(),
  created_at: z.string(),
  expires_at: z.string(),
  /** Derived from `expires_at`, since TTL expiry is silent in the engine. */
  active: z.boolean(),
  runs: z.number(),
});
export type SessionRow = z.infer<typeof SessionRow>;

export const RunRow = z.object({
  session_ref: z.string(),
  session_id: z.string().nullable(),
  flow_id: z.string(),
  attempt: z.number(),
  transaction_id: z.string().nullable(),
  status: z.string(),
  step_count: z.number().nullable(),
  started_at: z.string(),
  updated_at: z.string(),
});
export type RunRow = z.infer<typeof RunRow>;

export const JournalRow = z.object({
  session_ref: z.string(),
  seq: z.number(),
  at: z.string(),
  kind: z.string(),
  flow_id: z.string().nullable(),
  transaction_id: z.string().nullable(),
  action: z.string().nullable(),
  ack: z.string().nullable(),
  nack_code: z.string().nullable(),
  payload_id: z.string().nullable(),
  overrides: z.array(z.string()),
  summary: z.string(),
});
export type JournalRow = z.infer<typeof JournalRow>;

export const SessionListResponse = z.object({
  items: z.array(SessionRow),
  total: z.number(),
});
export const RunListResponse = z.object({
  items: z.array(RunRow),
  total: z.number(),
});
export const JournalListResponse = z.object({
  items: z.array(JournalRow),
  total: z.number(),
});

/* -------------------------------------------------------------------------- */
/* Triage actions                                                              */
/* -------------------------------------------------------------------------- */

export const TriageStatusInput = z.enum([
  "new",
  "triaged",
  "planned",
  "in_progress",
  "fixed",
  "wontfix",
]);

export const SetStatusBody = z.object({
  status: TriageStatusInput,
  /** Free text appended as a comment alongside the label change. */
  note: z.string().optional(),
});

export const CommentBody = z.object({
  body: z.string().min(1),
});

export const LinkFixBody = z.object({
  /** A PR URL, a branch name or a commit sha — whatever names the fix. */
  reference: z.string().min(1),
  note: z.string().optional(),
});

export const DismissBody = z.object({
  reason: z.string().min(1),
});

/**
 * Every triage action answers the same thing: where the incident now stands.
 *
 * There is no `synced` here, and deliberately no replacement for it. It existed
 * to say "the corpus recorded your intent but GitHub never heard about it" —
 * a half-success that cannot happen now that every action is one write inside
 * the request. A field that can only ever hold one value is noise.
 */
export const TriageResult = z.object({
  fingerprint: z.string(),
  status: z.string(),
  /** Notes on the incident after this action. */
  notes: z.number(),
  message: z.string(),
});
export type TriageResult = z.infer<typeof TriageResult>;

/* -------------------------------------------------------------------------- */
/* Health                                                                      */
/* -------------------------------------------------------------------------- */

export const HealthResponse = z.object({
  status: z.enum(["ok"]),
  uptimeSeconds: z.number(),
});

export const ReadinessResponse = z.object({
  status: z.enum(["ready", "degraded"]),
  checks: z.array(
    z.object({
      name: z.string(),
      ok: z.boolean(),
      optional: z.boolean(),
      detail: z.string().optional(),
    }),
  ),
});

/** What the web app needs to know about its own deployment at boot. */
export const ConfigResponse = z.object({
  /**
   * Whether MONGO_URL is set. Named `mcp_enabled` because this whole section is
   * called MCP; it says nothing about the Model Context Protocol, which this
   * service no longer speaks. Declared here because both handlers already
   * returned it and the schema did not — drift nothing was validating.
   */
  mcp_enabled: z.boolean(),
  grafana_url: z.string().nullable(),
  prometheus_url: z.string().nullable(),
  loki_url: z.string().nullable(),
});
