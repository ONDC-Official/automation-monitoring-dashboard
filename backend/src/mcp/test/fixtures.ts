import type { IncidentDoc } from "@/mcp/modules/corpus/corpus.schema.js";
import type { IssueReport } from "@/mcp/modules/ingest/report.schema.js";

/**
 * Test data, modelled on a real spooled report.
 *
 * The shape is the one from the two live runs on 2026-07-31 that gave up on
 * TRV11 `search2_METRO_201`: a published config assigning `context.bpp_uri` a
 * list where a string belongs, the outbound gate refusing the payload, and the
 * run stranded. That is the report this whole service exists to collect, so it
 * is the one the tests are written against.
 *
 * Builders take plain overrides and merge shallowly per section. Nothing here
 * is clever on purpose — a fixture that computes its own fields hides the very
 * value a failing assertion needs to show you.
 */

let counter = 0;

/** Unique per call, so two reports in one test are two runs unless told otherwise. */
function nextReportId(): string {
  counter += 1;
  return `inc_00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

/**
 * Overrides are spelled out field by field rather than as `Partial<IssueReport>`.
 *
 * Every schema in `report.schema.ts` is `.loose()`, so its inferred type carries
 * an index signature — spreading a `Partial` of one widens each named field to
 * `unknown` and the fixture stops type-checking anything at all.
 */
export interface ReportOverrides {
  report_id?: string;
  generated_at?: string;
  install_id?: string;
  flow_id?: string;
  attempt?: number;
  mock_role?: string;
  build?: { domain?: string; version?: string; usecase?: string };
  incident?: {
    trigger?: string;
    code?: string;
    step_key?: string;
    action?: string;
    occurrences?: number;
    state?: string;
    duration_ms?: number;
  };
  narration?: IssueReport["narration"];
  correlation?: { session_id: string; transaction_id?: string };
}

export function makeReport(overrides: ReportOverrides = {}): IssueReport {
  return {
    schema_version: 1,
    report_id: overrides.report_id ?? nextReportId(),
    generated_at: overrides.generated_at ?? "2026-07-31T09:14:02.114Z",
    install_id: overrides.install_id ?? "install_a1b2c3",

    build: {
      domain: "ONDC:TRV11",
      version: "2.0.0",
      usecase: "METRO",
      ...overrides.build,
    },
    mock_role: overrides.mock_role ?? "BAP",

    flow_id: overrides.flow_id ?? "search2_METRO_201",
    attempt: overrides.attempt ?? 1,

    incident: {
      trigger: "VALIDATION_FINDINGS",
      code: "INVALID_BPP_URI",
      step_key: "search2_METRO_201_select",
      action: "select",
      occurrences: 1,
      state: "OPEN",
      duration_ms: 1_842,
      ...overrides.incident,
    },

    evidence: {
      message:
        "outbound gate refused the generated payload before anything was sent",
      findings: [
        {
          layer: "L0",
          code: "SCHEMA_TYPE",
          json_path: "$.context.bpp_uri",
          message: "at '/context/bpp_uri': got array, want string",
        },
        {
          layer: "L1",
          code: "REQUIRED_CONTEXT_FIELD",
          json_path: "$.context.bpp_id",
          message: "bpp_id is required on select",
        },
      ],
      unchecked: [
        { layer: "context", reason: "no check registered for this layer yet" },
      ],
      http_status: 200,
    },

    journal: [
      {
        seq: 11,
        kind: "OUTBOUND_SENT",
        action: "search",
        summary: "sent search to https://np.example.com/ondc",
      },
      {
        seq: 12,
        kind: "INBOUND_ACK",
        action: "on_search",
        ack: "ACK",
        summary: "accepted on_search",
      },
      {
        seq: 13,
        kind: "ATTENTION",
        action: "select",
        summary: "outbound gate blocked select on 2 findings",
      },
    ],

    narration: overrides.narration ?? null,
    ...(overrides.correlation !== undefined
      ? { correlation: overrides.correlation }
      : {}),
  };
}

export interface NarrationOverrides {
  diagnosis?: string;
  attempted?: string[];
  outcome?: string;
  suspected_cause?: string;
  tooling_gap?: string;
  at?: string;
}

/** A model's account of the same incident, for the `narrated` path. */
export function makeNarration(
  overrides: NarrationOverrides = {},
): NonNullable<IssueReport["narration"]> {
  return {
    diagnosis:
      "the published config assigns sessionData?.bppUri to context.bpp_uri without indexing [0]",
    attempted: [
      "re-ran flow_proceed with dry_run to inspect the generated payload",
      "patched $.context.bpp_uri with payload_overrides",
    ],
    outcome: "worked_around",
    suspected_cause: "flow_config",
    tooling_gap:
      "nothing named the config expression that produced the offending value",
    at: "2026-07-31T09:16:40.002Z",
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Incidents                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One incident document, matching the report above.
 *
 * `Partial<IncidentDoc>` works here where it does not for `makeReport`:
 * `IncidentDoc` is a hand-written interface with no index signature, so a
 * spread narrows rather than widens.
 */
export function makeIncident(
  overrides: Partial<IncidentDoc> = {},
): IncidentDoc {
  return {
    _id: "a".repeat(64),
    domain: "ONDC:TRV11",
    version: "2.0.0",
    usecase: "METRO",
    flow_id: "search2_METRO_201",
    trigger: "VALIDATION_FINDINGS",
    code: "INVALID_BPP_URI",
    step_key: "search2",
    action: "search",
    occurrences_total: 7,
    deliveries: 3,
    distinct_runs: 2,
    install_ids: ["inst_abc123456789"],
    mock_roles: ["BAP"],
    first_seen_at: "2026-07-31T10:00:00.000Z",
    last_seen_at: "2026-08-01T12:00:00.000Z",
    latest_state: "OPEN",
    state_counts: { OPEN: 3 },
    narrated: true,
    suspected_causes: ["flow_config"],
    latest_report_doc_id: "inst:rep:2026-08-01T12:00:00.000Z",
    suppressed: false,
    triage: {
      status: "untracked",
      assignees: [],
      resolution: undefined,
      notes: [],
      updated_at: undefined,
    },
    ...overrides,
  };
}
